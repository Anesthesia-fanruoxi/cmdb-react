/**
 * 字典相关 API
 */

import { apiClient } from '../request';
import type { ApiResponse } from '../../types/api';

export interface DictItem {
  key: string;
  value: string;
  color?: string;
}

export interface Dict {
  id: number;
  dictName: string;
  targetTable: string;
  keyName: string;
  valueName: string;
}

export interface DictDetail {
  items: DictItem[];
}

/** 获取字典列表 */
export function getDictList(): Promise<ApiResponse<Dict[]>> {
  return apiClient.get<Dict[]>('/system/dict/list');
}

/** 获取字典详情 */
export function getDictDetail(targetTable: string): Promise<ApiResponse<DictDetail>> {
  return apiClient.get<DictDetail>('/system/dict/detail', { target_table: targetTable });
}

/** 创建字典项 */
export function createDictItem(data: { tableName: string; key: string; value: string; color?: string }): Promise<ApiResponse<null>> {
  return apiClient.post<null>('/system/dict/create', data);
}

/** 更新字典项 */
export function updateDict(data: { tableName: string; key: string; value: string; color?: string }): Promise<ApiResponse<null>> {
  return apiClient.put<null>('/system/dict/update', data);
}

/** 删除字典项 */
export function deleteDictItem(targetTable: string, key: string): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/system/dict/delete?target_table=${targetTable}&key=${key}`);
}
