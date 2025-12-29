/**
 * 菜单相关 API
 */

import { apiClient } from '../request';
import type { MenuItem, CreateMenuRequest, UpdateMenuRequest } from '../../types/menu';
import type { ApiResponse } from '../../types/api';

/** 获取菜单树 */
export function getMenuTree(): Promise<ApiResponse<MenuItem[]>> {
  return apiClient.get<MenuItem[]>('/system/menu/tree');
}

/** 获取用户菜单 */
export function getUserMenus(): Promise<ApiResponse<MenuItem[]>> {
  return apiClient.get<MenuItem[]>('/system/menu/user');
}

/** 创建菜单 */
export function createMenu(data: CreateMenuRequest): Promise<ApiResponse<MenuItem>> {
  return apiClient.post<MenuItem>('/system/menu/create', data);
}

/** 更新菜单 */
export function updateMenu(data: UpdateMenuRequest): Promise<ApiResponse<null>> {
  return apiClient.put<null>('/system/menu/update', data);
}

/** 删除菜单 */
export function deleteMenu(id: string): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/system/menu/delete?id=${id}`);
}
