/**
 * 应用更新服务
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

// GitHub 仓库配置
const GITHUB_OWNER = 'Anesthesia-fanruoxi';
const GITHUB_REPO = 'cmdb-react';
// GitHub Personal Access Token（只读权限，用于私有仓库和提高 API 限额）
const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN || '';

/** 平台资源 */
export interface PlatformAsset {
  url: string;
  api_url: string;
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
  return invoke('check_github_update', { 
    owner: GITHUB_OWNER, 
    repo: GITHUB_REPO,
    token: GITHUB_TOKEN || null
  });
};

/** 检查更新（兼容旧接口，现在默认使用 GitHub） */
export const checkUpdate = (): Promise<VersionInfo | null> => {
  return checkGitHubUpdate();
};

/** 下载更新 */
export const downloadUpdate = (info: VersionInfo): Promise<string> => {
  return invoke('download_update', { info, token: GITHUB_TOKEN || null });
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

export const startAutoCheck = (intervalMinutes = 5): void => {
  if (checkInterval) return;
  
  // 动态导入避免循环依赖
  const doCheck = async () => {
    const { useUpdateStore } = await import('../stores/updateStore');
    useUpdateStore.getState().checkForUpdate();
  };
  
  // 启动后延迟 30 秒首次检查
  setTimeout(doCheck, 30 * 1000);
  
  // 定时检查（分钟）
  checkInterval = setInterval(doCheck, intervalMinutes * 60 * 1000);
};

export const stopAutoCheck = (): void => {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
};
