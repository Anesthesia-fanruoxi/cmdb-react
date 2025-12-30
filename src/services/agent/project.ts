/**
 * Agent 项目插件管理 API
 */

import { apiClient } from '../request';

// 获取项目列表
export const getProjectPluginList = () => apiClient.get('/agent/project/list');

// 获取项目插件详情
export const getProjectPluginDetail = (project: string) => 
  apiClient.get('/agent/project/list/detail', { project });

// 操作插件（启动/停止/重启/卸载/更新/编辑）
export const operatePlugin = (data: PluginOperateData) => 
  apiClient.post('/agent/project/operate', data);

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
  container_port?: number;
  port?: number;
  uptime?: string;
  installed_at?: string;
  is_update?: boolean;
  config?: Record<string, string>;
}

export interface PluginOperateData {
  project: string;
  name: string;
  action: 'start' | 'stop' | 'restart' | 'uninstall' | 'update' | 'edit';
  container_port?: number;
  config?: Record<string, string>;
}

export interface ProjectDetail {
  plugins: Plugin[];
  agent_version?: string;
  eip?: string;
}
