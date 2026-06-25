/**
 * 部门相关 API
 */

import { apiClient } from '../request';
import type { ApiResponse } from '../../types/api';

export interface Dept {
  id: string;
  name: string;
  parent_id: string;
  code?: string;
  sort?: number;
  description?: string;
  children?: Dept[];
  created_at: string;
}

/** 获取部门列表 */
export function getDeptList(): Promise<ApiResponse<Dept[]>> {
  return apiClient.get<Dept[]>('/system/dept/list');
}

/** 获取部门详情 */
export function getDeptDetail(id: string): Promise<ApiResponse<Dept>> {
  return apiClient.get<Dept>('/system/dept/detail', { id });
}

/** 创建部门 */
export function createDept(data: { name: string; parent_id?: string; code?: string; sort?: number; description?: string }): Promise<ApiResponse<Dept>> {
  return apiClient.post<Dept>('/system/dept/create', data);
}

/** 更新部门 */
export function updateDept(data: { id: string; name?: string; parent_id?: string; code?: string; sort?: number; description?: string }): Promise<ApiResponse<null>> {
  return apiClient.put<null>('/system/dept/update', data);
}

/** 删除部门 */
export function deleteDept(id: string): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/system/dept/delete?id=${id}`);
}

/** 获取部门可选项目列表 */
export function getDeptProjects() {
  return apiClient.get('/system/dept/projects');
}

/** 获取部门项目关联 */
export function getDeptProject(deptId: string): Promise<ApiResponse<{ project: string[] }>> {
  return apiClient.get<{ project: string[] }>('/system/dept/project/detail', { dept_id: deptId });
}

/** 更新部门项目关联 */
export function updateDeptProject(data: { dept_id: string; project: string[] }): Promise<ApiResponse<null>> {
  return apiClient.post<null>('/system/dept/project/update', data);
}
