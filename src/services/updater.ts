/**
 * 应用更新服务
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

// CMDB 版本接口
const VERSION_API = 'https://api.hzbxhd.com/api/app/version/list';

/** 版本信息 */
export interface VersionInfo {
  version: string;
  release_date: string;
  changelog: string;
}

/** CMDB 版本接口响应 */
interface VersionResponse {
  code: number;
  message: string;
  data: {
    version: string;
    description: string;
  };
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

/** 比较版本号 (返回 true 表示 remote > local) */
const isNewerVersion = (local: string, remote: string): boolean => {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(n => parseInt(n) || 0);
  const localParts = parse(local);
  const remoteParts = parse(remote);
  
  for (let i = 0; i < 3; i++) {
    const l = localParts[i] || 0;
    const r = remoteParts[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
};

/** 从 CMDB 检查更新 */
export const checkUpdate = async (): Promise<VersionInfo | null> => {
  try {
    const response = await fetch(VERSION_API);
    const result: VersionResponse = await response.json();
    
    if (result.code !== 200 || !result.data) {
      return null;
    }
    
    const currentVersion = await getAppVersion();
    const remoteVersion = result.data.version;
    
    if (!isNewerVersion(currentVersion, remoteVersion)) {
      return null;
    }
    
    return {
      version: remoteVersion,
      release_date: new Date().toISOString(),
      changelog: result.data.description || '新版本可用',
    };
  } catch {
    return null;
  }
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
let isUpdating = false;

/** 静默更新：检查 → 下载 → 等待重启 */
export const silentUpdate = async (): Promise<void> => {
  if (isUpdating) return;
  
  try {
    const info = await checkUpdate();
    if (!info) return;
    
    isUpdating = true;
    console.log(`[更新] 发现新版本 ${info.version}，开始下载...`);
    
    // 静默下载
    const filePath = await downloadUpdate(info);
    console.log(`[更新] 下载完成: ${filePath}`);
    
    // 标记待安装（存储到本地，下次启动时安装）
    await invoke('mark_pending_update', { filePath, version: info.version });
    console.log(`[更新] 已标记待安装，重启后生效`);
    
  } catch (err) {
    console.error('[更新] 静默更新失败:', err);
  } finally {
    isUpdating = false;
  }
};

export const startAutoCheck = (intervalMinutes = 5): void => {
  if (checkInterval) return;
  
  // 启动后延迟 30 秒首次检查
  setTimeout(silentUpdate, 30 * 1000);
  
  // 定时检查（分钟）
  checkInterval = setInterval(silentUpdate, intervalMinutes * 60 * 1000);
};

export const stopAutoCheck = (): void => {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
};
