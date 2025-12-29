/**
 * 本地存储工具
 * 使用 Tauri Store 插件 + Rust 端设备密钥加密
 * 所有敏感数据都使用设备绑定的密钥加密
 */

import { load, Store } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';

// 存储文件名
const STORE_FILE = 'settings.dat';

// 存储键名
const TOKEN_KEY = 'token';
const USER_INFO_KEY = 'userInfo';
const USER_NAME_KEY = 'user_name';
const USER_ID_KEY = 'userId';
const THEME_KEY = 'app-theme';
const LAST_LOGIN_KEY = 'lastLoginUsername';

// Store 实例
let storeInstance: Store | null = null;

// 内存缓存（存储解密后的数据）
const memoryCache: Map<string, string> = new Map();

// 是否已初始化
let isInitialized = false;

/**
 * 检测是否在 Tauri 环境中运行
 */
function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * 使用设备密钥加密
 */
async function encryptWithDevice(plaintext: string): Promise<string> {
  if (!isTauriEnv()) {
    return btoa(encodeURIComponent(plaintext));
  }
  return invoke<string>('encrypt_data', { plaintext });
}

/**
 * 使用设备密钥解密
 */
async function decryptWithDevice(encrypted: string): Promise<string> {
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
 * 初始化存储（应用启动时调用一次）
 */
export async function initStorage(): Promise<void> {
  if (isInitialized) return;

  if (isTauriEnv()) {
    try {
      storeInstance = await load(STORE_FILE, { defaults: {} });
      const entries = await storeInstance.entries<string>();
      
      // 解密所有数据到内存
      for (const [key, value] of entries) {
        if (typeof value === 'string' && key !== THEME_KEY) {
          try {
            const decrypted = await decryptWithDevice(value);
            memoryCache.set(key, decrypted);
          } catch {
            // 解密失败，可能是旧数据或损坏
            console.warn(`解密 ${key} 失败，已跳过`);
          }
        } else if (key === THEME_KEY) {
          memoryCache.set(key, value as string);
        }
      }
    } catch (error) {
      console.error('初始化存储失败:', error);
    }
  } else {
    // 浏览器环境
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          try {
            const decrypted = await decryptWithDevice(value);
            memoryCache.set(key, decrypted);
          } catch {
            memoryCache.set(key, value);
          }
        }
      }
    }
  }

  isInitialized = true;
}

/**
 * 异步写入（加密后存储）
 */
async function setEncryptedAsync(key: string, value: unknown): Promise<void> {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  memoryCache.set(key, text);

  const encrypted = await encryptWithDevice(text);

  if (isTauriEnv() && storeInstance) {
    await storeInstance.set(key, encrypted);
    await storeInstance.save();
  } else {
    localStorage.setItem(key, encrypted);
  }
}

/**
 * 同步读取字符串（从内存缓存）
 */
function getFromCache(key: string): string | null {
  return memoryCache.get(key) || null;
}

/**
 * 同步读取对象（从内存缓存）
 */
function getObjectFromCache<T>(key: string): T | null {
  const value = memoryCache.get(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * 删除键
 */
function removeKey(key: string): void {
  memoryCache.delete(key);
  if (isTauriEnv() && storeInstance) {
    storeInstance.delete(key).then(() => storeInstance?.save());
  } else {
    localStorage.removeItem(key);
  }
}

// ==================== Token ====================

export function getToken(): string | null {
  return getFromCache(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  memoryCache.set(TOKEN_KEY, token);
  await setEncryptedAsync(TOKEN_KEY, token);
}

export function removeToken(): void {
  removeKey(TOKEN_KEY);
}

// ==================== 用户信息 ====================

export function getUserInfo<T = unknown>(): T | null {
  return getObjectFromCache<T>(USER_INFO_KEY);
}

export async function setUserInfo<T>(userInfo: T): Promise<void> {
  memoryCache.set(USER_INFO_KEY, JSON.stringify(userInfo));
  await setEncryptedAsync(USER_INFO_KEY, userInfo);
}

export function removeUserInfo(): void {
  removeKey(USER_INFO_KEY);
}

// ==================== 用户名 ====================

export function getUserName(): string | null {
  return getFromCache(USER_NAME_KEY);
}

export async function setUserName(userName: string): Promise<void> {
  memoryCache.set(USER_NAME_KEY, userName);
  await setEncryptedAsync(USER_NAME_KEY, userName);
}

export function removeUserName(): void {
  removeKey(USER_NAME_KEY);
}

// ==================== 用户ID ====================

export function getUserId(): string | null {
  return getFromCache(USER_ID_KEY);
}

export async function setUserId(userId: string): Promise<void> {
  memoryCache.set(USER_ID_KEY, userId);
  await setEncryptedAsync(USER_ID_KEY, userId);
}

export function removeUserId(): void {
  removeKey(USER_ID_KEY);
}

// ==================== 上次登录用户名 ====================

export function getLastLoginUsername(): string | null {
  return getFromCache(LAST_LOGIN_KEY);
}

export async function setLastLoginUsername(username: string): Promise<void> {
  memoryCache.set(LAST_LOGIN_KEY, username);
  await setEncryptedAsync(LAST_LOGIN_KEY, username);
}

// ==================== 主题（不加密） ====================

export function getTheme(): 'light' | 'dark' {
  return (memoryCache.get(THEME_KEY) as 'light' | 'dark') || 'light';
}

export function setTheme(theme: 'light' | 'dark'): void {
  memoryCache.set(THEME_KEY, theme);
  if (isTauriEnv() && storeInstance) {
    storeInstance.set(THEME_KEY, theme).then(() => storeInstance?.save());
  } else {
    localStorage.setItem(THEME_KEY, theme);
  }
}

// ==================== 清除数据 ====================

export function clearUserData(): void {
  removeToken();
  removeUserInfo();
  removeUserName();
  removeUserId();
}
