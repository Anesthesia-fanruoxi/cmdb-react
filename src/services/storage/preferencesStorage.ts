/**
 * 偏好设置存储
 * 文件：preferences.dat
 * 存储：主题、窗口大小、侧边栏宽度（以用户名为 key）
 */

import { getStorageData, updateStorageData } from './core';
import type { PreferencesData, MultiUserData, WindowBounds } from './types';

const FILE = 'preferences.dat';

// 默认偏好
const defaultPreferences: PreferencesData = {
  avatar: '',
  theme: 'dark',
  windowBounds: { x: 100, y: 100, width: 1200, height: 800 },
  sidebarWidth: 220,
};

/**
 * 获取所有用户的偏好数据
 */
function getAllPreferences(): MultiUserData<PreferencesData> {
  return getStorageData<MultiUserData<PreferencesData>>(FILE);
}

/**
 * 获取指定用户的偏好
 */
export function getPreferences(username: string): PreferencesData {
  const all = getAllPreferences();
  return { ...defaultPreferences, ...all[username] };
}

/**
 * 保存用户偏好
 */
export async function savePreferences(
  username: string,
  prefs: PreferencesData
): Promise<void> {
  const all = getAllPreferences();
  all[username] = prefs;
  await updateStorageData(FILE, all);
}

/**
 * 更新用户偏好（部分更新）
 */
export async function updatePreferences(
  username: string,
  updates: Partial<PreferencesData>
): Promise<void> {
  const current = getPreferences(username);
  const newPrefs = { ...current, ...updates };
  await savePreferences(username, newPrefs);
}

/**
 * 获取用户主题
 */
export function getUserTheme(username: string): 'light' | 'dark' {
  return getPreferences(username).theme;
}

/**
 * 设置用户主题
 */
export async function setUserTheme(
  username: string,
  theme: 'light' | 'dark'
): Promise<void> {
  await updatePreferences(username, { theme });
}

/**
 * 获取用户头像
 */
export function getUserAvatar(username: string): string {
  return getPreferences(username).avatar;
}

/**
 * 设置用户头像
 */
export async function setUserAvatar(username: string, avatar: string): Promise<void> {
  await updatePreferences(username, { avatar });
}

/**
 * 获取窗口位置大小
 */
export function getWindowBounds(username: string): WindowBounds {
  return getPreferences(username).windowBounds;
}

/**
 * 设置窗口位置大小
 */
export async function setWindowBounds(
  username: string,
  bounds: WindowBounds
): Promise<void> {
  await updatePreferences(username, { windowBounds: bounds });
}

/**
 * 获取侧边栏宽度
 */
export function getSidebarWidth(username: string): number {
  return getPreferences(username).sidebarWidth;
}

/**
 * 设置侧边栏宽度
 */
export async function setSidebarWidth(username: string, width: number): Promise<void> {
  await updatePreferences(username, { sidebarWidth: width });
}

/**
 * 删除用户偏好
 */
export async function removePreferences(username: string): Promise<void> {
  const all = getAllPreferences();
  delete all[username];
  await updateStorageData(FILE, all);
}
