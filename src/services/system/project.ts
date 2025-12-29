/**
 * 项目管理 API
 */

import { apiClient } from '../request';
import type { ApiResponse } from '../../types/api';

export interface Project {
  id?: number;
  project: string;
  project_name: string;
  description?: string;
  agent_url?: string;
  backen_domain?: string;
  api_domain?: string;
  git_vue?: string;
  git_backend?: string;
  alter_feishu?: string;
  update_feishu?: string;
  notify_feishu?: string;
  enable_skywalking?: boolean;
  frontend_tool?: string;
  backend_tool?: string;
  eip?: string;
  logo?: string;
  created_at?: string;
}

/** 获取项目列表 */
export function getProjectList(): Promise<ApiResponse<Project[]>> {
  return apiClient.get<Project[]>('/system/project/list');
}

/** 获取项目详情 */
export function getProjectDetail(project: string): Promise<ApiResponse<Project>> {
  return apiClient.get<Project>('/system/project/detail', { project });
}

/** 创建项目 */
export function createProject(data: Partial<Project>): Promise<ApiResponse<null>> {
  return apiClient.post<null>('/system/project/create', data);
}

/** 更新项目 */
export function updateProject(data: Partial<Project>): Promise<ApiResponse<null>> {
  return apiClient.put<null>('/system/project/update', data);
}

/** 快速更新项目字段 */
export function quickUpdateProject(project: string, field: string, value: unknown): Promise<ApiResponse<null>> {
  return apiClient.put<null>('/system/project/update', { project, [field]: value });
}

/** 删除项目 */
export function deleteProject(project: string): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/system/project/delete?project=${project}`);
}
