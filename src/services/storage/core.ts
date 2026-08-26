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

/**
 * 异步存储写入按文件合并。当前 IPC 尚未完成时，只保留最新快照，
 * 避免输入期间不断堆积 save_store_async 请求。
 */
type PendingAsyncSave = {
  data: Record<string, unknown> | null;
  scheduled: boolean;
  inFlight: Promise<void> | null;
  idleCallbackId: number | null;
  timeoutId: ReturnType<typeof setTimeout> | null;
};

const pendingAsyncSaves: Map<StorageFile, PendingAsyncSave> = new Map();

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

function logStoragePerf(event: string, details: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.warn(`[StoragePerf] ${event}`, details);
  }
}

function clearScheduledSave(state: PendingAsyncSave): void {
  if (state.idleCallbackId !== null && typeof window !== 'undefined') {
    const idleWindow = window as Window & {
      cancelIdleCallback?: (id: number) => void;
    };
    idleWindow.cancelIdleCallback?.(state.idleCallbackId);
    state.idleCallbackId = null;
  }

  if (state.timeoutId !== null) {
    clearTimeout(state.timeoutId);
    state.timeoutId = null;
  }

  state.scheduled = false;
}

function dispatchAsyncSave(file: StorageFile, state: PendingAsyncSave): void {
  if (state.inFlight || !state.data) return;

  const data = state.data;
  state.data = null;

  const stringifyStarted = performance.now();
  const plaintext = JSON.stringify(data);
  const stringifyMs = performance.now() - stringifyStarted;

  if (stringifyMs >= 8) {
    logStoragePerf('stringify', {
      file,
      bytes: plaintext.length,
      ms: Number(stringifyMs.toFixed(1)),
    });
  }

  const invokeStarted = performance.now();
  const request = invoke<void>('save_store_async', { file, plaintext })
    .then(() => {
      const invokeMs = performance.now() - invokeStarted;
      if (invokeMs >= 32) {
        logStoragePerf('ipc-ack', {
          file,
          bytes: plaintext.length,
          ms: Number(invokeMs.toFixed(1)),
        });
      }
    })
    .catch((error) => {
      console.error(`[AsyncSave] save failed for ${file}:`, error);
    })
    .finally(() => {
      if (state.inFlight === request) {
        state.inFlight = null;
      }

      if (state.data) {
        scheduleAsyncSaveFlush(file, state);
      } else {
        pendingAsyncSaves.delete(file);
      }
    });

  state.inFlight = request;
}

/**
 * Defer the request and stringify only when the snapshot is sent.
 */
function scheduleAsyncSaveFlush(file: StorageFile, state: PendingAsyncSave): void {
  if (state.scheduled || state.inFlight || !state.data) return;
  state.scheduled = true;

  const flush = () => {
    state.scheduled = false;
    state.idleCallbackId = null;
    state.timeoutId = null;
    dispatchAsyncSave(file, state);
  };

  const idleWindow = typeof window !== 'undefined'
    ? window as Window & {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      }
    : null;

  if (idleWindow?.requestIdleCallback) {
    state.idleCallbackId = idleWindow.requestIdleCallback(flush, { timeout: 2000 });
  } else if (typeof window !== 'undefined') {
    state.timeoutId = window.setTimeout(flush, 0);
  } else {
    flush();
  }
}

export function saveStorageDataAsync(file: StorageFile, data: Record<string, unknown>): void {
  if (!isTauriEnv()) return;

  // Update the memory cache first so readers see the latest value.
  memoryCache.set(file, data);

  let state = pendingAsyncSaves.get(file);
  if (!state) {
    state = {
      data,
      scheduled: false,
      inFlight: null,
      idleCallbackId: null,
      timeoutId: null,
    };
    pendingAsyncSaves.set(file, state);
  } else {
    // Keep only the latest snapshot while a request is pending.
    state.data = data;
  }

  scheduleAsyncSaveFlush(file, state);
}

/**
 * Flush snapshots that have not been sent yet,
 * then wait for the Rust worker queue to reach disk.
 */
export async function flushStorageWrites(): Promise<void> {
  if (!isTauriEnv()) return;

  while (true) {
    for (const [file, state] of pendingAsyncSaves) {
      clearScheduledSave(state);
      dispatchAsyncSave(file, state);
    }

    const requests = Array.from(pendingAsyncSaves.values())
      .map((state) => state.inFlight)
      .filter((request): request is Promise<void> => request !== null);
    if (requests.length > 0) {
      await Promise.all(requests);
    }

    const hasPendingData = Array.from(pendingAsyncSaves.values())
      .some((state) => state.data !== null || state.inFlight !== null || state.scheduled);
    if (!hasPendingData) break;
  }

  const started = performance.now();
  await invoke<void>('flush_store_save_queue');
  const ms = performance.now() - started;
  if (ms >= 32) {
    logStoragePerf('backend-flush', { ms: Number(ms.toFixed(1)) });
  }
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
 * 物理删除存储文件。
 * 注意：不要用 store.clear()+save——文件不存在时 load 会先创建空的 `{}`。
 */
async function deleteStoreFile(file: StorageFile): Promise<void> {
  if (!isTauriEnv()) return;

  // Cancel queued snapshots and wait for an in-flight write before deleting the file.
  const pending = pendingAsyncSaves.get(file);
  if (pending) {
    clearScheduledSave(pending);
    pending.data = null;
    if (pending.inFlight) await pending.inFlight;
    pendingAsyncSaves.delete(file);
  }

  storeInstances.delete(file);
  memoryCache.delete(file);

  try {
    await invoke<void>('delete_store_file', { file });
  } catch (error) {
    console.warn(`[Storage] delete failed for ${file}:`, error);
  }
}

// ==================== Public API ====================

export function waitForStorageInit(): Promise<void> {
  if (isInitialized) return Promise.resolve();
  return initPromise;
}

/**
 * 初始化所有存储文件（并行优化版）
 * 5 个文件独立解密，使用 Promise.all 同时加载
 * 预期提速：3-5 倍（从 ~500ms 降至 ~100-150ms）
 */
export async function initAllStorage(): Promise<void> {
  if (isInitialized) return;

  const files: StorageFile[] = [
    'app.dat',
    'tokens.dat',
    'profiles.dat',
    // states.dat 保留用于兼容旧版本，states/ 目录存储拆分后的状态数据
    'states.dat',
    'states/index.dat',
    'states/navigation.dat',
    'states/page-states.dat',
    'states/sqlSearch/index.dat',
    'states/sqlMetadata/index.dat',
    'preferences.dat',
    // credentials.dat 由 Rust 端负责管理
  ];

  // ✅ 并行解密所有文件（无依赖关系）
  const loadPromises = files.map(file => loadAndDecrypt(file));
  const results = await Promise.all(loadPromises);

  // 写入各自的内存缓存
  files.forEach((file, index) => {
    memoryCache.set(file, results[index]);
  });

  // 将旧 states.dat 中的数据迁移到 states/ 分片文件
  try {
    const { migrateLegacyStates } = await import('./stateShardStorage');
    await migrateLegacyStates();
    const { loadSqlSearchTabFiles } = await import('./sqlSearchStorage');
    const { loadSqlMetadataFiles } = await import('./sqlMetadataStorage');
    await Promise.all([loadSqlSearchTabFiles(), loadSqlMetadataFiles()]);
  } catch (error) {
    console.warn('[Storage] state shard migration failed:', error);
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
 * 懒加载单个存储文件（未在启动阶段预加载的动态文件使用，如 sqlMetadata/<项目>.dat）
 * 已缓存时直接返回，不重复解密
 */
export async function ensureStorageFileLoaded(file: StorageFile): Promise<void> {
  if (memoryCache.has(file)) return;
  const data = await loadAndDecrypt(file);
  memoryCache.set(file, data);
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
  memoryCache.delete('states/index.dat');
  memoryCache.delete('states/navigation.dat');
  memoryCache.delete('states/page-states.dat');
  memoryCache.delete('states/sqlSearch/index.dat');
  memoryCache.delete('states/sqlMetadata/index.dat');
  memoryCache.delete('preferences.dat');
  // Clear dynamic SQL tab and metadata file caches.
  for (const key of Array.from(memoryCache.keys())) {
    if (key.startsWith('states/sqlSearch/') || key.startsWith('states/sqlMetadata/')) {
      memoryCache.delete(key);
    }
  }
  // credentials.dat 保留，用于下次自动登录
}
