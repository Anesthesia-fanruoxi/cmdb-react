/**
 * 知识库 API
 */

import { apiClient } from '../request';

/** 文档项 */
export interface DocItem {
  id: number;
  title: string;
  content?: string;
  category?: string;
  user_name?: string;
  creator?: string;
  created_at?: string;
  updated_at?: string;
  share?: boolean;
}

/** 创建/更新文档参数 */
export interface DocParams {
  id?: number;
  title: string;
  content: string;
  category?: string;
}

// ========== 个人文档 ==========

/** 获取个人文档列表 */
export const getPersonalDocList = () => {
  return apiClient.get<DocItem[]>('/knowledge/personal/list');
};

/** 获取个人文档详情 */
export const getPersonalDocDetail = (id: number) => {
  return apiClient.get<DocItem>('/knowledge/personal/detail', { id, _t: Date.now() });
};

/** 创建个人文档 */
export const createPersonalDoc = (data: DocParams) => {
  return apiClient.post<null>('/knowledge/personal/create', data);
};

/** 更新个人文档 */
export const updatePersonalDoc = (data: DocParams) => {
  return apiClient.put<null>('/knowledge/personal/update', data);
};

/** 删除个人文档 */
export const deletePersonalDoc = (id: number) => {
  return apiClient.delete<null>(`/knowledge/personal/delete?id=${id}`);
};

// ========== 公开文档 ==========

/** 获取公开文档列表 */
export const getPublicDocList = (params?: { category?: string }) => {
  return apiClient.get<DocItem[]>('/knowledge/public/list', params);
};

/** 获取公开文档详情 */
export const getPublicDocDetail = (id: number) => {
  return apiClient.get<DocItem>('/knowledge/public/detail', { id });
};

/** 创建公开文档 */
export const createPublicDoc = (data: DocParams) => {
  return apiClient.post<null>('/knowledge/public/create', data);
};

/** 更新公开文档 */
export const updatePublicDoc = (data: DocParams) => {
  return apiClient.put<null>('/knowledge/public/update', data);
};

/** 删除公开文档 */
export const deletePublicDoc = (id: number) => {
  return apiClient.delete<null>(`/knowledge/public/delete?id=${id}`);
};

// ========== 内部文档 ==========

/** 获取内部文档列表 */
export const getDocumentList = (params?: { keyword?: string; category?: string; project?: string }) => {
  return apiClient.get<DocItem[]>('/knowledge/doc/list', params);
};

/** 获取内部文档详情 */
export const getDocumentDetail = (id: number) => {
  return apiClient.get<DocItem>('/knowledge/doc/detail', { id, _t: Date.now() });
};

/** 创建内部文档 */
export const createDocument = (data: DocParams & { project?: string }) => {
  return apiClient.post<null>('/knowledge/doc/create', data);
};

/** 更新内部文档 */
export const updateDocument = (id: number, data: DocParams & { project?: string }) => {
  return apiClient.put<null>(`/knowledge/doc/update?id=${id}`, data);
};

/** 删除内部文档 */
export const deleteDocument = (id: number) => {
  return apiClient.delete<null>(`/knowledge/doc/delete?id=${id}`);
};

// ========== 回收站 ==========

/** 回收站文档项 */
export interface RecycleDocItem extends DocItem {
  deleted_at?: string;
  deleter_name?: string;
}

/** 获取回收站列表 */
export const getRecycleList = (type: string) => {
  return apiClient.get<RecycleDocItem[]>('/knowledge/recycle/list', { type });
};

/** 恢复文档 */
export const restoreDoc = (data: { id: number; type: string }) => {
  return apiClient.post<null>('/knowledge/recycle/refresh', data);
};

/** 彻底删除文档 */
export const removeDoc = (id: number, type: string) => {
  return apiClient.delete<null>(`/knowledge/recycle/remove?id=${id}&type=${type}`);
};

/** 获取回收站文档详情 */
export const getRecycleDetail = (id: number, type: string) => {
  return apiClient.get<RecycleDocItem>('/knowledge/recycle/detail', { id, type });
};
