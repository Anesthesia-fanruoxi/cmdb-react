/**
 * ELFK 视图管理 API
 */

import { apiClient } from '../request';
import type { ApiResponse } from '../../types/api';
import type { ElfkProject, ElfkView, FieldInfo } from './search';

/** 视图列表项 */
export interface ViewListItem {
  id: string;
  name: string;
  project: string;
  category?: string;
  view_category?: string; // 兼容字段
  index_pattern: string;
  time_field: string;
  time_format?: string;
  description?: string;
  log_type?: string;
  create_time?: string;
  update_time?: string;
}

/** 视图详情 */
export interface ViewDetail extends ViewListItem {
  all_field?: {
    properties: Record<string, FieldInfo>;
  };
}

/** 创建视图参数 */
export interface CreateViewParams {
  name: string;
  project: string;
  category?: string;
  index_pattern: string;
  time_field: string;
  time_format?: string;
  description?: string;
  log_type?: string;
  fields?: FieldItem[];
}

/** 字段列表项（用于提交） */
export interface FieldItem {
  path: string;
  type: string;
  format?: string;
  aggregatable?: boolean;
  searchable?: boolean;
}

/** 更新视图参数 */
export interface UpdateViewParams extends Partial<CreateViewParams> {
  id: string;
}

// 获取项目列表
export function getElfkViewProjects(): Promise<ApiResponse<{ items: ElfkProject[] }>> {
  return apiClient.get('/elfk/view/projects');
}

// 获取视图列表
export function getViewList(params?: {
  project?: string;
  category?: string;
  name?: string;
}): Promise<ApiResponse<ViewListItem[]>> {
  return apiClient.get<ViewListItem[]>('/elfk/view/list', params);
}

// 获取视图详情
export function getViewDetail(id: string): Promise<ApiResponse<ViewDetail>> {
  return apiClient.get<ViewDetail>('/elfk/view/detail', { id });
}

// 创建视图
export function createView(data: CreateViewParams): Promise<ApiResponse<ViewDetail>> {
  return apiClient.post<ViewDetail>('/elfk/view/create', data);
}

// 更新视图
export function updateView(data: UpdateViewParams): Promise<ApiResponse<ViewDetail>> {
  return apiClient.put<ViewDetail>('/elfk/view/update', data);
}

// 删除视图
export function deleteView(id: string): Promise<ApiResponse<null>> {
  return apiClient.delete<null>('/elfk/view/delete', { params: { id } } as any);
}

export type { ElfkProject, ElfkView, FieldInfo };
