/**
 * 登录历史服务
 * 调用 Rust 后端管理登录历史
 */

import { invoke } from '@tauri-apps/api/core';
import { isTauriEnv } from './machine';

/**
 * 添加登录历史
 */
export async function addLoginHistory(username: string): Promise<void> {
  if (!isTauriEnv()) return;
  await invoke('add_login_history', { username });
}

/**
 * 获取登录历史
 */
export async function getLoginHistory(): Promise<string[]> {
  if (!isTauriEnv()) return [];
  return invoke<string[]>('get_login_history');
}

/**
 * 获取最后登录用户
 */
export async function getLastUser(): Promise<string> {
  if (!isTauriEnv()) return '';
  return invoke<string>('get_last_user');
}

/**
 * 清除登录历史
 */
export async function clearLoginHistory(): Promise<void> {
  if (!isTauriEnv()) return;
  await invoke('clear_login_history');
}
