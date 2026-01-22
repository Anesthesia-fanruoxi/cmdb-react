/**
 * 文件系统操作工具
 * 支持打开文件和目录
 */

import { invoke } from '@tauri-apps/api/core';
import { isTauriEnv } from '../services/machine';

/**
 * 获取系统默认下载目录
 */
export async function getDownloadDir(): Promise<string> {
  if (!isTauriEnv()) {
    return '';
  }
  
  try {
    return await invoke<string>('get_download_dir');
  } catch (error) {
    console.error('获取下载目录失败:', error);
    return '';
  }
}

/**
 * 打开目录
 */
export async function openFolder(folderPath: string): Promise<void> {
  if (!isTauriEnv()) {
    console.warn('非 Tauri 环境，无法打开文件夹');
    return;
  }
  
  try {
    await invoke('open_folder', { path: folderPath });
  } catch (error) {
    console.error('打开文件夹失败:', error);
    throw error;
  }
}

/**
 * 在文件管理器中打开文件所在目录并选中文件
 */
export async function showInFolder(filePath: string): Promise<void> {
  if (!isTauriEnv()) {
    console.warn('非 Tauri 环境，无法打开文件夹');
    return;
  }
  
  try {
    await invoke('show_in_folder', { path: filePath });
  } catch (error) {
    console.error('打开文件夹失败:', error);
    throw error;
  }
}

/**
 * 使用系统默认程序打开文件
 */
export async function openFile(filePath: string): Promise<void> {
  if (!isTauriEnv()) {
    console.warn('非 Tauri 环境，无法打开文件');
    return;
  }
  
  try {
    await invoke('open_file', { path: filePath });
  } catch (error) {
    console.error('打开文件失败:', error);
    throw error;
  }
}

/**
 * 检查文件是否存在
 */
export async function fileExists(filePath: string): Promise<boolean> {
  if (!isTauriEnv()) {
    return false;
  }
  
  try {
    return await invoke<boolean>('file_exists', { path: filePath });
  } catch (error) {
    console.error('检查文件是否存在失败:', error);
    return false;
  }
}
