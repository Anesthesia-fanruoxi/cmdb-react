/**
 * 角色相关 API
 */

import { apiClient } from '../request';
import type { ApiResponse } from '../../types/api';

export interface Role {
  id: number;
  name: string;
  code: string;
  description: string;
  level: number;
  created_at: string;
}

export interface RolePermissions {
  [menuId: number]: [number, number, number]; // [view, read, write]
}

/** 获取角色列表 */
export function getRoleList(): Promise<ApiResponse<Role[]>> {
  return apiClient.get<Role[]>('/system/role/list');
}

/** 创建角色 */
export function createRole(data: { name: string; code: string; level: number; description?: string }): Promise<ApiResponse<Role>> {
  return apiClient.post<Role>('/system/role/create', data);
}

/** 更新角色 */
export function updateRole(data: { id: number; name?: string; code?: string; level?: number; description?: string }): Promise<ApiResponse<null>> {
  return apiClient.put<null>('/system/role/update', data);
}

/** 删除角色 */
export function deleteRole(id: number): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/system/role/delete?id=${id}`);
}

/** 获取角色菜单权限 */
export function getRoleMenus(roleId: number): Promise<ApiResponse<RolePermissions>> {
  return apiClient.get<RolePermissions>('/system/role/menus/detail', { role_id: roleId });
}

/** 更新角色菜单权限 */
export function updateRoleMenus(data: { role_id: number; permissions: RolePermissions }): Promise<ApiResponse<null>> {
  return apiClient.post<null>('/system/role/menus/update', data);
}
