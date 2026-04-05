/**
 * 插件商店 API
 */

import { apiClient } from '../request';

// 获取项目列表
export const getAgentStoreProjects = () => apiClient.get('/agent/store/projects');

// 获取插件商店列表
export const getPluginStoreList = (params?: { keyword?: string; plugin_type?: string }) => 
  apiClient.get('/agent/store/list', params as Record<string, unknown>);

// 获取插件详情
export const getPluginDetail = (id: number) => apiClient.get('/agent/plugin/store/detail', { id });

// 安装插件（超时60秒）
export const installPlugin = (data: InstallPluginData) => 
  apiClient.post('/agent/store/install', data, { timeout: 60000 });

// 预览插件配置
export const previewPluginConfig = (data: { name: string; project: string }) => 
  apiClient.post('/agent/plugins/config/preview', data);

// 类型定义
export interface StorePlugin {
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

export interface InstallPluginData {
  plugin_id: number;
  project: string;
  container_port?: number;
  config?: Record<string, string>;
  command?: string;
}

export interface StoreProject {
  project: string;
  project_name: string;
}
