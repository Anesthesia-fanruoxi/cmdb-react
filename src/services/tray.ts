/**
 * 系统托盘和通知服务
 */

import { invoke } from '@tauri-apps/api/core';
import { appNotification } from '../components/AppNotification';
import { isTauriEnv } from './machine';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

/**
 * 发送应用内通知（2秒后自动消失）
 */
export function showNotification(title: string, body: string, type: NotificationType = 'info'): void {
  appNotification[type](title, body, 2000);
}

/**
 * 开始托盘图标闪烁
 */
export async function startTrayFlash(): Promise<void> {
  if (!isTauriEnv()) return;
  
  try {
    await invoke('set_tray_icon_flash');
  } catch (error) {
    console.error('启动托盘闪烁失败:', error);
  }
}

/**
 * 停止托盘图标闪烁
 */
export async function stopTrayFlash(): Promise<void> {
  if (!isTauriEnv()) return;
  
  try {
    await invoke('stop_tray_icon_flash');
  } catch (error) {
    console.error('停止托盘闪烁失败:', error);
  }
}
