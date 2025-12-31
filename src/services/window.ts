/**
 * 窗口管理服务
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * 请求任务栏注意力（图标高亮/闪烁）
 * @param critical 是否紧急（紧急时闪烁更明显）
 */
export const requestAttention = (critical = false): Promise<void> => {
  return invoke('request_attention', { critical });
};

/**
 * 取消任务栏注意力请求
 */
export const cancelAttention = (): Promise<void> => {
  return invoke('cancel_attention');
};
