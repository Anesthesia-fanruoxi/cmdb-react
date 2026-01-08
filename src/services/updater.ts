/**
 * 应用更新服务
 * 启动时检查更新 + 自动下载 + 弹出安装界面
 */

import { invoke } from '@tauri-apps/api/core';
import { getUpdateInfo, saveUpdateInfo, clearUpdateInfo, getInstallPath, setInstallPath } from './storage';
import type { UpdateInfo } from './storage';

// 版本接口
const VERSION_API = 'https://api.hzbxhd.com/api/app/version/list';

/** 版本接口响应 */
interface VersionResponse {
  code: number;
  message: string;
  data: {
    version: string;
    description: string;
    download_url?: string;
  };
}

/** Rust 端版本信息格式 */
export interface VersionInfo {
  version: string;
  release_date: string;
  changelog: string;
}

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

/** 检查文件是否存在 */
const fileExists = async (path: string): Promise<boolean> => {
  if (!path) return false;
  try {
    return await invoke<boolean>('check_file_exists', { path });
  } catch {
    return false;
  }
};

/** 从服务器获取最新版本信息 */
const fetchLatestVersion = async (): Promise<{ version: string; changelog: string } | null> => {
  try {
    const response = await fetch(VERSION_API);
    const result: VersionResponse = await response.json();
    
    if (result.code !== 200 || !result.data) return null;
    
    return {
      version: result.data.version,
      changelog: result.data.description || '新版本可用',
    };
  } catch (e) {
    console.error('[更新] 获取版本信息失败:', e);
    return null;
  }
};

/** 下载更新包 */
const downloadUpdateFile = async (version: string, changelog: string): Promise<string> => {
  const info: VersionInfo = {
    version,
    release_date: new Date().toISOString().split('T')[0],
    changelog,
  };
  return invoke<string>('download_update', { info });
};

/** 清理更新下载目录 */
const cleanUpdateDir = async (): Promise<void> => {
  try {
    await invoke('clean_update_dir');
    await clearUpdateInfo();
    console.log('[更新] 已清理下载目录');
  } catch (e) {
    console.error('[更新] 清理下载目录失败:', e);
  }
};

/** 启动时清理旧更新（已下载版本 = 当前版本，说明已更新完成） */
export const cleanupOldUpdate = async (): Promise<void> => {
  try {
    const appVersion = await getAppVersion();
    const update = getUpdateInfo();
    
    if (update.downloadedVersion && update.downloadedVersion === appVersion) {
      console.log('[更新] 检测到已完成更新，清理下载目录');
      await cleanUpdateDir();
    }
  } catch (e) {
    console.error('[更新] 清理旧更新失败:', e);
  }
};

/** 保存当前安装路径 */
export const saveInstallPath = async (): Promise<void> => {
  try {
    const path = await invoke<string>('get_exe_path');
    if (path) {
      await setInstallPath(path);
      console.log('[更新] 已保存安装路径:', path);
    }
  } catch (e) {
    console.error('[更新] 保存安装路径失败:', e);
  }
};

/** 获取已保存的安装路径 */
export const getSavedInstallPath = (): string => {
  return getInstallPath();
};

/**
 * 启动时检查更新
 * 返回待安装的更新信息（已下载或新下载）
 */
export const checkAndDownloadUpdate = async (): Promise<UpdateInfo | null> => {
  try {
    // 1. 获取版本信息
    const appVersion = await getAppVersion();
    const remoteInfo = await fetchLatestVersion();
    
    if (!remoteInfo) {
      console.log('[更新] 无法获取版本信息');
      return null;
    }
    
    console.log(`[更新] 当前版本: ${appVersion}, 最新版本: ${remoteInfo.version}`);
    
    // 2. 检查是否有新版本
    if (!isNewerVersion(appVersion, remoteInfo.version)) {
      console.log('[更新] 已是最新版本');
      return null;
    }
    
    // 3. 检查是否已下载
    const update = getUpdateInfo();
    if (
      update.downloadedVersion === remoteInfo.version &&
      update.downloadStatus === 'completed' &&
      await fileExists(update.downloadedPath)
    ) {
      console.log('[更新] 已有安装包，直接显示安装界面');
      return {
        ...update,
        latestVersion: remoteInfo.version,
        changelog: remoteInfo.changelog,
      };
    }
    
    // 4. 开始下载
    console.log(`[更新] 发现新版本 ${remoteInfo.version}，开始下载...`);
    await saveUpdateInfo({
      latestVersion: remoteInfo.version,
      changelog: remoteInfo.changelog,
      downloadStatus: 'downloading',
      downloadProgress: 0,
      lastCheckTime: Date.now(),
    });
    
    const filePath = await downloadUpdateFile(remoteInfo.version, remoteInfo.changelog);
    
    // 5. 下载完成，保存并返回
    const newUpdate: Partial<UpdateInfo> = {
      latestVersion: remoteInfo.version,
      downloadedVersion: remoteInfo.version,
      downloadedPath: filePath,
      downloadStatus: 'completed',
      downloadProgress: 100,
      changelog: remoteInfo.changelog,
    };
    
    await saveUpdateInfo(newUpdate);
    console.log(`[更新] 下载完成: ${filePath}`);
    
    return getUpdateInfo();
  } catch (e) {
    console.error('[更新] 检查更新失败:', e);
    await saveUpdateInfo({ downloadStatus: 'failed' });
    return null;
  }
};

/** 安装更新 */
export const installUpdate = async (filePath: string): Promise<void> => {
  const update = getUpdateInfo();
  const installPath = getInstallPath();
  
  await invoke('mark_pending_update', {
    filePath,
    version: update.downloadedVersion,
  });
  await invoke('install_update', { filePath, installPath });
};

/** 手动检查更新（用于设置页面） */
export const checkUpdate = async (): Promise<{ version: string; changelog: string } | null> => {
  const remoteInfo = await fetchLatestVersion();
  if (!remoteInfo) return null;
  
  const appVersion = await getAppVersion();
  if (!isNewerVersion(appVersion, remoteInfo.version)) return null;
  
  return remoteInfo;
};

export { clearUpdateInfo };
