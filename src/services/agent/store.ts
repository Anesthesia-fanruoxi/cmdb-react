/**
 * 插件商店 API
 */

import { apiClient } from '../request';

// 获取项目列表
export const getAgentStoreProjects = () => apiClient.get('/agent/store/projects');

// 获取插件商店列表
export const getPluginStoreList = (params?: { keyword?: string; plugin_type?: string }) => 
  apiClient.get('/agent/store/list', params as Record<string, unknown>);

// 获取插件详情（含 config_template）
export const getPluginDetail = (id: number) => apiClient.get('/agent/plugins/detail', { id });

// 安装容器插件（超时60秒）
export const installContainerPlugin = (data: ContainerInstallRequest) => 
  apiClient.post('/agent/store/install/container', data, { timeout: 60000 });

// 安装二进制插件（超时60秒）
export const installBinaryPlugin = (data: BinaryInstallRequest) => 
  apiClient.post('/agent/store/install/binary', data, { timeout: 60000 });

// 预览插件配置（渲染模板变量）
export const previewPluginConfig = (data: { plugin_id: number; config_params: Record<string, string>; custom_config?: string }) => 
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
  is_config?: boolean;
  created_at?: string;
}

// 容器插件安装请求
export interface ContainerInstallRequest {
  plugin_id: number;
  project: string;
  config?: Record<string, string>;
}

// 二进制插件安装请求
export interface BinaryInstallRequest {
  plugin_id: number;
  project: string;
  config_content?: string;
}

export interface StoreProject {
  project: string;
  project_name: string;
}
