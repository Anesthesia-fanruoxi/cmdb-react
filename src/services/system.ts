/**
 * 系统管理相关 API
 */

import { apiClient } from './request';
import type {
  SystemSetting,
  DeptInfo,
  RoleInfo,
  UserListItem,
  CreateUserRequest,
  UpdateUserRequest,
  DictItem,
  PageParams,
  PageResponse,
} from '../types/system';
import type { ApiResponse } from '../types/api';

// ==================== 系统设置 ====================

/**
 * 获取系统设置
 */
export function getSystemSetting(): Promise<ApiResponse<SystemSetting>> {
  return apiClient.get<SystemSetting>('/system/setting/detail');
}

/**
 * 更新系统设置
 */
export function updateSystemSetting(data: Partial<SystemSetting>): Promise<ApiResponse<null>> {
  return apiClient.put<null>('/system/setting/update', data);
}

// ==================== 用户管理 ====================

/**
 * 获取用户列表
 */
export function getUserList(params?: PageParams & { keyword?: string }): Promise<ApiResponse<PageResponse<UserListItem>>> {
  return apiClient.get<PageResponse<UserListItem>>('/system/user/list', params as Record<string, unknown>);
}

/**
 * 获取用户详情
 */
export function getUserDetail(id: string): Promise<ApiResponse<UserListItem>> {
  return apiClient.get<UserListItem>(`/system/user/detail?id=${id}`);
}

/**
 * 创建用户
 */
export function createUser(data: CreateUserRequest): Promise<ApiResponse<UserListItem>> {
  return apiClient.post<UserListItem>('/system/user/create', data);
}

/**
 * 更新用户
 */
export function updateUser(data: UpdateUserRequest): Promise<ApiResponse<null>> {
  return apiClient.put<null>('/system/user/update', data);
}

/**
 * 删除用户
 */
export function deleteUser(id: string): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/system/user/delete?id=${id}`);
}

/**
 * 批量删除用户
 */
export function batchDeleteUsers(ids: string[]): Promise<ApiResponse<null>> {
  return apiClient.post<null>('/system/user/batch-delete', { ids });
}

// ==================== 部门管理 ====================

/**
 * 获取部门树
 */
export function getDeptTree(): Promise<ApiResponse<DeptInfo[]>> {
  return apiClient.get<DeptInfo[]>('/system/dept/tree');
}

/**
 * 获取部门列表
 */
export function getDeptList(): Promise<ApiResponse<DeptInfo[]>> {
  return apiClient.get<DeptInfo[]>('/system/dept/list');
}

/**
 * 创建部门
 */
export function createDept(data: Partial<DeptInfo>): Promise<ApiResponse<DeptInfo>> {
  return apiClient.post<DeptInfo>('/system/dept/create', data);
}

/**
 * 更新部门
 */
export function updateDept(data: Partial<DeptInfo> & { id: string }): Promise<ApiResponse<null>> {
  return apiClient.put<null>('/system/dept/update', data);
}

/**
 * 删除部门
 */
export function deleteDept(id: string): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/system/dept/delete?id=${id}`);
}

// ==================== 角色管理 ====================

/**
 * 获取角色列表
 */
export function getRoleList(params?: PageParams): Promise<ApiResponse<PageResponse<RoleInfo>>> {
  return apiClient.get<PageResponse<RoleInfo>>('/system/role/list', params as Record<string, unknown>);
}

/**
 * 获取所有角色（不分页）
 */
export function getAllRoles(): Promise<ApiResponse<RoleInfo[]>> {
  return apiClient.get<RoleInfo[]>('/system/role/all');
}

/**
 * 创建角色
 */
export function createRole(data: Partial<RoleInfo>): Promise<ApiResponse<RoleInfo>> {
  return apiClient.post<RoleInfo>('/system/role/create', data);
}

/**
 * 更新角色
 */
export function updateRole(data: Partial<RoleInfo> & { id: string }): Promise<ApiResponse<null>> {
  return apiClient.put<null>('/system/role/update', data);
}

/**
 * 删除角色
 */
export function deleteRole(id: string): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/system/role/delete?id=${id}`);
}

// ==================== 字典管理 ====================

/**
 * 获取字典详情
 */
export function getDictDetail(dictType: string): Promise<ApiResponse<{ items: DictItem[] }>> {
  return apiClient.get<{ items: DictItem[] }>(`/system/dict/detail?dict_type=${dictType}`);
}

/**
 * 获取字典列表
 */
export function getDictList(params?: PageParams): Promise<ApiResponse<PageResponse<DictItem>>> {
  return apiClient.get<PageResponse<DictItem>>('/system/dict/list', params as Record<string, unknown>);
}

