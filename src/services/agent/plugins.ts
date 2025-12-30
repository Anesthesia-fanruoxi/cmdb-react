/**
 * 插件管理 API
 */

import { apiClient } from '../request';

// 获取插件列表
export const getPluginsList = (params?: { keyword?: string; type?: string }) => 
  apiClient.get('/agent/plugins/list', params as Record<string, unknown>);

// 获取插件详情
export const getPluginDetailApi = (id: number) => apiClient.get('/agent/plugins/detail', { id });

// 创建插件
export const createPlugin = (data: PluginFormData) => apiClient.post('/agent/plugins/create', data);

// 更新插件
export const updatePlugin = (data: Partial<PluginFormData> & { id: number; config_template?: string }) => 
  apiClient.post('/agent/plugins/update', data);

// 删除插件
export const deletePlugin = (id: number) => apiClient.post('/agent/plugins/delete', { id });

// 类型定义
export interface PluginItem {
  id: number;
  name: string;
  display_name: string;
  version: string;
  plugin_type: string;
  description?: string;
  image?: string;
  download_url?: string;
  port?: number;
  created_at?: string;
}

export interface PluginFormData {
  name: string;
  version: string;
  display_name: string;
  plugin_type: string;
  description?: string;
  port?: number;
}
