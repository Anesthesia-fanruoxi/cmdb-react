/**
 * 用户数据存储
 * 文件：profiles.dat
 * 存储：用户信息、权限、菜单（以用户名为 key）
 */

import { getStorageData, updateStorageData } from './core';
import type { ProfileData, MultiUserData, UserInfo, MenuItem } from './types';

const FILE = 'profiles.dat';

/**
 * 获取所有用户的 Profile 数据
 */
function getAllProfiles(): MultiUserData<ProfileData> {
  return getStorageData<MultiUserData<ProfileData>>(FILE);
}

/**
 * 获取指定用户的 Profile
 */
export function getProfile(username: string): ProfileData | null {
  const all = getAllProfiles();
  return all[username] || null;
}

/**
 * 保存用户 Profile
 */
export async function saveProfile(username: string, profile: ProfileData): Promise<void> {
  const all = getAllProfiles();
  all[username] = profile;
  await updateStorageData(FILE, all);
}

/**
 * 更新用户 Profile（部分更新）
 */
export async function updateProfile(
  username: string,
  updates: Partial<ProfileData>
): Promise<void> {
  const current = getProfile(username);
  const newProfile = { ...current, ...updates } as ProfileData;
  await saveProfile(username, newProfile);
}

/**
 * 获取用户信息
 */
export function getUserInfo(username: string): UserInfo | null {
  const profile = getProfile(username);
  return profile?.userInfo || null;
}

/**
 * 获取用户权限
 */
export function getPermissions(username: string): string[] {
  const profile = getProfile(username);
  return profile?.permissions || [];
}

/**
 * 获取用户菜单
 */
export function getMenus(username: string): MenuItem[] {
  const profile = getProfile(username);
  return profile?.menus || [];
}

/**
 * 删除用户 Profile
 */
export async function removeProfile(username: string): Promise<void> {
  const all = getAllProfiles();
  delete all[username];
  await updateStorageData(FILE, all);
}
