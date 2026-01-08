/**
 * App 公共存储
 * 文件：app.dat
 * 存储：登录历史、最后用户、默认主题、更新信息等
 */

import { getStorageData, updateStorageData } from './core';
import type { AppData, UpdateInfo } from './types';

const FILE = 'app.dat';

// 默认更新信息
const defaultUpdateInfo: UpdateInfo = {
  latestVersion: '',
  downloadedVersion: '',
  downloadedPath: '',
  downloadStatus: 'none',
  downloadProgress: 0,
  changelog: '',
  lastCheckTime: 0,
};

// 默认值
const defaultAppData: AppData = {
  loginHistory: [],
  lastUser: '',
  defaultTheme: 'dark',
  appVersion: '',
  installPath: '',
  lastUpdateCheck: 0,
  update: defaultUpdateInfo,
};

/**
 * 获取 App 数据
 */
export function getAppData(): AppData {
  const data = getStorageData<AppData>(FILE);
  return { 
    ...defaultAppData, 
    ...data,
    update: { ...defaultUpdateInfo, ...data?.update },
  };
}

/**
 * 更新 App 数据
 */
export async function updateAppData(updates: Partial<AppData>): Promise<void> {
  await updateStorageData<AppData>(FILE, updates);
}

/**
 * 获取登录历史
 */
export function getLoginHistory(): string[] {
  return getAppData().loginHistory;
}

/**
 * 添加登录历史
 */
export async function addLoginHistory(username: string): Promise<void> {
  const history = getLoginHistory().filter(u => u !== username);
  history.unshift(username);
  await updateAppData({
    loginHistory: history.slice(0, 10),
    lastUser: username,
  });
}

/**
 * 获取最后登录用户
 */
export function getLastUser(): string {
  return getAppData().lastUser;
}

/**
 * 获取默认主题
 */
export function getDefaultTheme(): 'light' | 'dark' {
  return getAppData().defaultTheme;
}

/**
 * 设置默认主题
 */
export async function setDefaultTheme(theme: 'light' | 'dark'): Promise<void> {
  await updateAppData({ defaultTheme: theme });
}

/**
 * 更新最后检查更新时间
 */
export async function updateLastUpdateCheck(): Promise<void> {
  await updateAppData({ lastUpdateCheck: Date.now() });
}

/**
 * 更新应用版本
 */
export async function updateAppVersion(version: string): Promise<void> {
  await updateAppData({ appVersion: version });
}

/**
 * 获取安装路径
 */
export function getInstallPath(): string {
  return getAppData().installPath;
}

/**
 * 设置安装路径
 */
export async function setInstallPath(path: string): Promise<void> {
  await updateAppData({ installPath: path });
}

// ==================== 更新信息 ====================

/**
 * 获取更新信息
 */
export function getUpdateInfo(): UpdateInfo {
  return getAppData().update;
}

/**
 * 更新更新信息
 */
export async function saveUpdateInfo(info: Partial<UpdateInfo>): Promise<void> {
  const current = getUpdateInfo();
  await updateAppData({
    update: { ...current, ...info },
  });
}

/**
 * 清空更新信息
 */
export async function clearUpdateInfo(): Promise<void> {
  await updateAppData({ update: defaultUpdateInfo });
}
