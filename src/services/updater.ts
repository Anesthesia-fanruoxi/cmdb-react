/**
 * 应用更新服务
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

// GitHub 仓库配置
const GITHUB_OWNER = 'Anesthesia-fanruoxi';
const GITHUB_REPO = 'cmdb-react';

/** 平台资源 */
export interface PlatformAsset {
  url: string;
  size: number;
  sha256: string;
}

/** 版本信息 */
export interface VersionInfo {
  version: string;
  release_date: string;
  changelog: string;
  mandatory: boolean;
  windows?: PlatformAsset;
  macos_intel?: PlatformAsset;
  macos_arm?: PlatformAsset;
}

/** 更新状态 */
export type UpdateStatus =
  | { type: 'Checking' }
  | { type: 'Available'; info: VersionInfo }
  | { type: 'NotAvailable' }
  | { type: 'Downloading'; progress: number; downloaded: number; total: number }
  | { type: 'Downloaded'; path: string }
  | { type: 'Installing' }
  | { type: 'Error'; message: string };

/** 获取当前版本 */
export const getAppVersion = (): Promise<string> => {
  return invoke('get_app_version');
};

/** 从 GitHub Release 检查更新 */
export const checkGitHubUpdate = (): Promise<VersionInfo | null> => {
  return invoke('check_github_update', { owner: GITHUB_OWNER, repo: GITHUB_REPO });
};

/** 检查更新（兼容旧接口，现在默认使用 GitHub） */
export const checkUpdate = (): Promise<VersionInfo | null> => {
  return checkGitHubUpdate();
};

/** 下载更新 */
export const downloadUpdate = (info: VersionInfo): Promise<string> => {
  return invoke('download_update', { info });
};

/** 安装更新 */
export const installUpdate = (filePath: string): Promise<void> => {
  return invoke('install_update', { filePath });
};

/** 监听更新状态 */
export const onUpdateStatus = (callback: (status: UpdateStatus) => void): Promise<UnlistenFn> => {
  return listen<UpdateStatus>('update-status', (event) => {
    callback(event.payload);
  });
};

/** 格式化文件大小 */
export const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/** 启动定时检查（前端控制） */
let checkInterval: ReturnType<typeof setInterval> | null = null;

export const startAutoCheck = (intervalHours = 6): void => {
  if (checkInterval) return;
  
  // 启动后延迟 30 秒首次检查
  setTimeout(() => {
    checkUpdate().catch(console.error);
  }, 30 * 1000);
  
  // 定时检查
  checkInterval = setInterval(() => {
    checkUpdate().catch(console.error);
  }, intervalHours * 60 * 60 * 1000);
};

export const stopAutoCheck = (): void => {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
};
