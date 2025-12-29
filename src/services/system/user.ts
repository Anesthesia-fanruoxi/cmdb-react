/**
 * 用户相关 API
 */

import { apiClient } from '../request';
import type { ApiResponse, PaginatedResponse } from '../../types/api';

export interface User {
  id: string;
  user_name: string;
  nick_name: string;
  email: string;
  phone: string;
  dept_id: string;
  dept_name: string;
  role_id: number;
  role_name: string;
  is_enabled: boolean;
  online_assets: boolean;
  test_assets: boolean;
  allow_password_login: boolean;
  otp_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserListParams {
  name?: string;
  role_id?: number;
  dept_id?: string;
  page?: number;
}

export interface CreateUserRequest {
  user_name: string;
  password?: string;
  nick_name: string;
  email?: string;
  phone?: string;
  dept_id?: string;
  role_id?: number;
  allow_password_login?: boolean;
}

export interface UpdateUserRequest {
  id: string;
  nick_name?: string;
  email?: string;
  phone?: string;
  dept_id?: string;
  role_id?: number;
  is_enabled?: boolean;
  online_assets?: boolean;
  test_assets?: boolean;
  allow_password_login?: boolean;
  password?: string;
}

/** 获取用户列表 */
export function getUserList(params?: UserListParams): Promise<ApiResponse<PaginatedResponse<User>>> {
  return apiClient.get<PaginatedResponse<User>>('/system/user/list', params as Record<string, unknown>);
}

/** 获取用户详情 */
export function getUserDetail(id: string): Promise<ApiResponse<User>> {
  return apiClient.get<User>(`/system/user/detail?id=${id}`);
}

/** 创建用户 */
export function createUser(data: CreateUserRequest): Promise<ApiResponse<User>> {
  return apiClient.post<User>('/system/user/create', data);
}

/** 更新用户 */
export function updateUser(data: UpdateUserRequest): Promise<ApiResponse<null>> {
  return apiClient.put<null>('/system/user/update', data);
}

/** 删除用户 */
export function deleteUser(id: string): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/system/user/delete?id=${id}`);
}

/** 批量删除用户 */
export function batchDeleteUsers(userIds: string[]): Promise<ApiResponse<null>> {
  return apiClient.post<null>('/system/user/batch-delete', { user_ids: userIds });
}

/** 批量更新用户 */
export function batchUpdateUsers(data: {
  user_ids: string[];
  dept_id?: string;
  is_enabled?: boolean;
  online_assets?: boolean;
  test_assets?: boolean;
  allow_password_login?: boolean;
}): Promise<ApiResponse<null>> {
  return apiClient.put<null>('/system/user/batch-update', data);
}

/** 获取用户项目详情 */
export function getUserProjectDetail(userId: string | number): Promise<ApiResponse<{
  dept_projects?: string[];
  direct_projects?: string[];
  project_menus?: { project: string; menu_ids: number[] }[];
}>> {
  return apiClient.get('/system/user/project/detail', { user_id: userId });
}

/** 更新用户项目 */
export function updateUserProject(data: { 
  user_id: string | number; 
  project_menus: { project: string; menu_ids: number[] }[] 
}): Promise<ApiResponse<null>> {
  return apiClient.post<null>('/system/user/project/update', data);
}
