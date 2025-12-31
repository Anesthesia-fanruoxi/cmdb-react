/**
 * 通知服务
 * - 应用内通知
 * - 任务栏图标高亮
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
 * 请求任务栏注意力（图标高亮）
 */
export async function requestAttention(critical = false): Promise<void> {
  if (!isTauriEnv()) return;
  
  try {
    await invoke('request_attention', { critical });
  } catch (error) {
    console.error('请求任务栏注意力失败:', error);
  }
}

/**
 * 取消任务栏注意力
 */
export async function cancelAttention(): Promise<void> {
  if (!isTauriEnv()) return;
  
  try {
    await invoke('cancel_attention');
  } catch (error) {
    console.error('取消任务栏注意力失败:', error);
  }
}

// 兼容旧接口
export const startTrayFlash = () => requestAttention(true);
export const stopTrayFlash = () => cancelAttention();
