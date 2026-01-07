/**
 * Token 存储
 * 文件：tokens.dat
 * 存储：单用户 token，支持"保存登录状态"开关
 */

import { getStorageData, setStorageData, removeStorageFile, hasStorageData } from './core';
import type { TokenData } from './types';

const FILE = 'tokens.dat';

/**
 * 获取 Token 数据
 */
export function getTokenData(): TokenData | null {
  const data = getStorageData<TokenData>(FILE);
  if (!data || !data.token) {
    return null;
  }
  return data;
}

/**
 * 获取 Token
 */
export function getToken(): string | null {
  const data = getTokenData();
  return data?.token || null;
}

/**
 * 获取 Token 对应的用户名
 */
export function getTokenUsername(): string | null {
  const data = getTokenData();
  return data?.username || null;
}

/**
 * 检查 Token 是否过期
 */
export function isTokenExpired(): boolean {
  const data = getTokenData();
  if (!data) return true;
  return Date.now() > data.expireAt;
}

/**
 * 检查是否有有效 Token
 */
export function hasValidToken(): boolean {
  return hasStorageData(FILE) && !isTokenExpired();
}

/**
 * 保存 Token（仅当用户勾选"保存登录状态"时调用）
 */
export async function saveToken(
  token: string,
  username: string,
  expireAt?: number
): Promise<void> {
  // 默认过期时间：7天
  const defaultExpire = Date.now() + 7 * 24 * 60 * 60 * 1000;
  
  await setStorageData<TokenData>(FILE, {
    token,
    username,
    expireAt: expireAt || defaultExpire,
  });
}

/**
 * 删除 Token（退出登录时调用）
 */
export async function removeToken(): Promise<void> {
  await removeStorageFile(FILE);
}
