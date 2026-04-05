/**
 * 存储核心模块
 * 提供多文件存储的基础能力：加载、加密、解密、保存
 */

import { load, Store } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';
import type { StorageFile } from './types';

// 存储实例缓存
const storeInstances: Map<StorageFile, Store> = new Map();

// 内存缓存（存储解密后的数据）
const memoryCache: Map<StorageFile, Record<string, unknown>> = new Map();

// 初始化状态
let isInitialized = false;
let initPromiseResolve: (() => void) | null = null;
const initPromise = new Promise<void>((resolve) => {
  initPromiseResolve = resolve;
});

/**
 * 检测是否在 Tauri 环境中运行
 */
export function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * 使用设备密钥加密
 */
export async function encryptData(plaintext: string): Promise<string> {
  if (!isTauriEnv()) {
    return btoa(encodeURIComponent(plaintext));
  }
  return invoke<string>('encrypt_data', { plaintext });
}

/**
 * 使用设备密钥解密
 */
export async function decryptData(encrypted: string): Promise<string> {
  if (!isTauriEnv()) {
    try {
      return decodeURIComponent(atob(encrypted));
    } catch {
      return '';
    }
  }
  return invoke<string>('decrypt_data', { encrypted });
}

/**
 * 加载单个存储文件
 */
async function loadStoreFile(file: StorageFile): Promise<Store> {
  const existing = storeInstances.get(file);
  if (existing) return existing;

  const store = await load(file, { defaults: {} });
  storeInstances.set(file, store);
  return store;
}

/**
 * 从文件加载并解密数据到内存
 */
async function loadAndDecrypt(file: StorageFile): Promise<Record<string, unknown>> {
  if (!isTauriEnv()) {
    return {};
  }

  try {
    const store = await loadStoreFile(file);
    const encrypted = await store.get<string>('data');
    
    if (!encrypted) {
      return {};
    }

    const decrypted = await decryptData(encrypted);
    return JSON.parse(decrypted);
  } catch (error) {
    console.warn(`加载 ${file} 失败:`, error);
    return {};
  }
}

/**
 * 加密并保存数据到文件（异步后台，不等待返回，不阻塞主线程）
 */
export function saveStorageDataAsync(file: StorageFile, data: Record<string, unknown>): void {
  if (!isTauriEnv()) return;

  // 先更新内存缓存
  memoryCache.set(file, data);

  const jsonStr = JSON.stringify(data);
  // fire-and-forget：invoke 不 await，Rust 后台线程处理加密+写文件
  invoke('save_store_async', { file, plaintext: jsonStr }).catch((err) => {
    console.error(`[AsyncSave] 后台保存 ${file} 失败:`, err);
  });
}

/**
 * 加密并保存数据到文件
 */
async function encryptAndSave(file: StorageFile, data: Record<string, unknown>): Promise<void> {
  if (!isTauriEnv()) {
    return;
  }

  try {
    const store = await loadStoreFile(file);
    const jsonStr = JSON.stringify(data);
    const encrypted = await encryptData(jsonStr);
    
    await store.set('data', encrypted);
    await store.save();
  } catch (error) {
    console.error(`保存 ${file} 失败:`, error);
    throw error;
  }
}

/**
 * 删除存储文件
 */
async function deleteStoreFile(file: StorageFile): Promise<void> {
  if (!isTauriEnv()) {
    return;
  }

  try {
    const store = await loadStoreFile(file);
    await store.clear();
    await store.save();
    memoryCache.delete(file);
  } catch (error) {
    console.warn(`删除 ${file} 失败:`, error);
  }
}

// ==================== 公共 API ====================

/**
 * 等待存储初始化完成
 */
export function waitForStorageInit(): Promise<void> {
  if (isInitialized) return Promise.resolve();
  return initPromise;
}

/**
 * 初始化所有存储文件
 */
export async function initAllStorage(): Promise<void> {
  if (isInitialized) return;

  const files: StorageFile[] = [
    'app.dat',
    'tokens.dat',
    'profiles.dat',
    'states.dat',
    'preferences.dat',
    // credentials.dat 由 Rust 端管理，不在此初始化
  ];

  for (const file of files) {
    const data = await loadAndDecrypt(file);
    memoryCache.set(file, data);
  }

  isInitialized = true;
  if (initPromiseResolve) {
    initPromiseResolve();
  }
}

/**
 * 获取存储数据（从内存缓存）
 */
export function getStorageData<T>(file: StorageFile): T {
  const data = memoryCache.get(file) || {};
  return data as T;
}

/**
 * 设置存储数据（写入内存并持久化）
 */
export async function setStorageData<T extends Record<string, unknown>>(
  file: StorageFile,
  data: T
): Promise<void> {
  memoryCache.set(file, data);
  await encryptAndSave(file, data);
}

/**
 * 更新存储数据（合并更新）
 */
export async function updateStorageData<T extends Record<string, unknown>>(
  file: StorageFile,
  updates: Partial<T>
): Promise<void> {
  const current = getStorageData<T>(file);
  const newData = { ...current, ...updates };
  await setStorageData(file, newData);
}

/**
 * 删除存储文件
 */
export async function removeStorageFile(file: StorageFile): Promise<void> {
  await deleteStoreFile(file);
}

/**
 * 检查存储文件是否存在数据
 */
export function hasStorageData(file: StorageFile): boolean {
  const data = memoryCache.get(file);
  return data !== undefined && Object.keys(data).length > 0;
}

/**
 * 清空内存缓存（退出登录时使用）
 */
export function clearMemoryCache(): void {
  // 只清空用户相关的缓存，保留 app.dat
  memoryCache.delete('tokens.dat');
  memoryCache.delete('profiles.dat');
  memoryCache.delete('states.dat');
  memoryCache.delete('preferences.dat');
  // credentials.dat 保留，用于下次自动登录
}
