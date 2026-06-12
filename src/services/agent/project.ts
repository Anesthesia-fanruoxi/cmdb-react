/**
 * Agent 项目插件管理 API
 */

import { apiClient } from '../request';

// 获取项目列表
export const getProjectPluginList = () => apiClient.get('/agent/project/list');

// 获取项目插件详情
export const getProjectPluginDetail = (project: string) =>
  apiClient.get('/agent/project/list/detail', { project });

// 插件控制（启动/停止/重启/卸载）
export const controlPlugin = (data: { project: string; name: string; action: 'start' | 'stop' | 'restart' | 'uninstall' }) =>
  apiClient.post('/agent/project/control', {
    project: data.project,
    plugin_name: data.name,
    action: data.action,
  });

// 插件版本升级
export const upgradePlugin = (data: { project: string; name: string }) =>
  apiClient.post('/agent/project/upgrade', {
    project: data.project,
    plugin_name: data.name,
  });

// 插件配置更新
export const updatePluginConfig = (data: {
  project: string;
  name: string;
  config_set?: Record<string, string>;
  config_delete?: string[];
  config_file_content?: string;
}) =>
  apiClient.post('/agent/project/config', {
    project: data.project,
    plugin_name: data.name,
    ...(data.config_set && Object.keys(data.config_set).length > 0 && { config_set: data.config_set }),
    ...(data.config_delete && data.config_delete.length > 0 && { config_delete: data.config_delete }),
    ...(data.config_file_content !== undefined && { config_file_content: data.config_file_content }),
  });

// 类型定义
export interface Project {
  project: string;
  project_name: string;
}

export interface Plugin {
  name: string;
  version: string;
  status: string;
  category: string;
  plugin_type: string;
  host_port?: number;
  container_port?: number;
  uptime?: string;
  installed_at?: string;
  is_update?: boolean;
  latest_version?: string;
  config?: Record<string, string>;
  config_file_content?: string;
}

export interface ProjectDetail {
  plugins: Plugin[];
  agent_version?: string;
  eip?: string;
}
