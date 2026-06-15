/**
 * 知识库 API
 */

import { apiClient } from '../request';

/** 分享信息 */
export interface ShareInfo {
  share_url: string;
  share_code: string;
  expired_at: string | null;
}

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
  share?: ShareInfo | null;
}

/** 创建/更新文档参数 */
export interface DocParams {
  id?: number;
  title: string;
  content: string;
  category?: string;
  project?: string;
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
export const getPublicDocList = (params?: { category?: string; project?: string }) => {
  return apiClient.get<DocItem[]>('/knowledge/public/list', params);
};

/** 获取公开文档详情 */
export const getPublicDocDetail = (id: number) => {
  return apiClient.get<DocItem>('/knowledge/public/detail', { id });
};

/** 获取已分享公开文档列表 */
export const getPublicShareList = () => {
  return apiClient.get<DocItem[]>('/knowledge/public/share/list');
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

/** 分享公开文档 */
export const sharePublicDoc = (data: { doc_id: number; expired_days: number }) => {
  return apiClient.post<ShareInfo>('/knowledge/public/share', data);
};

/** 取消分享 */
export const closePublicShare = (id: string) => {
  return apiClient.delete<null>(`/knowledge/public/anonymous/delete?id=${id}`);
};

/** 获取用户公开文档列表（只看自己） */
export const getUserPublicDocList = (params?: { category?: string }) => {
  return apiClient.get<DocItem[]>('/knowledge/public/user-list', params);
};

/** 获取公开文档历史版本列表 */
export const getPublicDocHistoryList = (docId: number) => {
  return apiClient.get<DocHistoryItem[]>('/knowledge/public/history/list', { doc_id: docId });
};

/** 获取公开文档历史版本详情 */
export const getPublicDocHistoryDetail = (id: number) => {
  return apiClient.get<DocHistoryItem>('/knowledge/public/history/detail', { id });
};

/** 恢复公开文档历史版本 */
export const restorePublicDocHistory = (historyId: number) => {
  return apiClient.post<null>('/knowledge/public/history/restore', { history_id: historyId });
};

// ========== 内部文档 ==========

/** 项目选项 */
export interface ProjectOption {
  project: string;
  project_name: string;
}

/** 获取项目列表 */
export const getDocProjects = () => {
  return apiClient.get<ProjectOption[]>('/knowledge/doc/projects');
};

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
  return apiClient.post<{ id: number }>('/knowledge/doc/create', data);
};

/** 更新内部文档 */
export const updateDocument = (id: number, data: DocParams & { project?: string }) => {
  return apiClient.put<null>(`/knowledge/doc/update?id=${id}`, data);
};

/** 删除内部文档 */
export const deleteDocument = (id: number) => {
  return apiClient.delete<null>(`/knowledge/doc/delete?id=${id}`);
};

// ========== 文档历史版本 ==========

/** 历史版本项 */
export interface DocHistoryItem {
  id: number;
  doc_id: number;
  version: number;
  title: string;
  content?: string;
  category?: string;
  project?: string;
  user_name?: string;
  created_at?: string;
}

/** 获取文档历史版本列表 */
export const getDocumentHistoryList = (docId: number) => {
  return apiClient.get<DocHistoryItem[]>('/knowledge/doc/history/list', { doc_id: docId });
};

/** 获取历史版本详情 */
export const getDocumentHistoryDetail = (historyId: number) => {
  return apiClient.get<DocHistoryItem>('/knowledge/doc/history/detail', { history_id: historyId });
};

/** 恢复历史版本 */
export const restoreDocumentHistory = (historyId: number) => {
  return apiClient.post<null>('/knowledge/doc/history/restore', { history_id: historyId });
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
