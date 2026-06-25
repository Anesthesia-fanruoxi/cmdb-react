/**
 * 字典相关 API
 */

import { apiClient } from '../request';
import type { ApiResponse } from '../../types/api';

/** 字典分组 */
export interface DictGroup {
  group_key: string;
  group_name: string;
  count: number;
}

/** 字典项（向后兼容：同时包含 key/value 和 item_key/item_value） */
export interface DictItem {
  id: number;
  key: string;         // 兼容旧代码，映射自 item_key
  value: string;       // 兼容旧代码，映射自 item_value
  item_key: string;
  item_value: string;
  group_key: string;
  group_name: string;
  color?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

/** 将后端字典项转换为前端兼容格式 */
function mapDictItem(raw: any): DictItem {
  return {
    id: raw.id,
    key: raw.item_key || '',
    value: raw.item_value || '',
    item_key: raw.item_key || '',
    item_value: raw.item_value || '',
    group_key: raw.group_key || '',
    group_name: raw.group_name || '',
    color: raw.color,
    created_by: raw.created_by,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

/** 获取字典分组列表 */
export function getDictGroups(): Promise<ApiResponse<DictGroup[]>> {
  return apiClient.get<DictGroup[]>('/system/dict/groups');
}

/** 获取某分组下的字典项 */
export function getDictItems(group: string): Promise<ApiResponse<{ items: DictItem[] }>> {
  return apiClient.get<any>('/system/dict/items', { group }).then(res => ({
    ...res,
    data: { items: (res.data || []).map(mapDictItem) },
  }));
}

/** 创建字典项 */
export function createDictItem(data: {
  group_key: string;
  group_name?: string;
  item_key: string;
  item_value: string;
  color?: string;
}): Promise<ApiResponse<DictItem>> {
  return apiClient.post<any>('/system/dict/item/create', data).then(res => ({
    ...res,
    data: mapDictItem(res.data),
  }));
}

/** 更新字典项 */
export function updateDictItem(data: {
  id: number;
  item_value?: string;
  color?: string;
}): Promise<ApiResponse<null>> {
  return apiClient.put<null>('/system/dict/item/update', data);
}

/** 删除字典项 */
export function deleteDictItem(id: number): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/system/dict/item/delete?id=${id}`);
}

// 向后兼容导出
export { getDictGroups as getDictList };
export { getDictItems as getDictDetail };
