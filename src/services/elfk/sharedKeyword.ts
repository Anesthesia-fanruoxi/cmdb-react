/**
 * ELFK 共享查询关键词 API
 * 用于保存和管理 ELFK 查询的共享关键词
 */

import request from '../request';

/** 共享关键词项 */
export interface SharedKeywordItem {
  id: number;
  project: string;
  category: string;
  view_id: number;
  keyword: string;
  remark: string;
  creator: string;
  created_at: string;
}

/** 查询共享关键词参数 */
export interface SharedKeywordQuery {
  project?: string;    // 项目名称（模糊搜索）
  category?: string;   // 分类名称（模糊搜索）
  view_id?: number;    // 视图ID（精确匹配）
  search?: string;     // 混合搜索（匹配关键词、备注、添加人）
  page?: number;       // 页码
}

/** 创建共享关键词参数 */
export interface CreateSharedKeywordParams {
  project: string;
  category: string;
  view_id: number;
  keyword: string;
  remark?: string;
}

/** 更新共享关键词参数 */
export interface UpdateSharedKeywordParams {
  id: number;
  project: string;
  category: string;
  view_id: number;
  keyword: string;
  remark?: string;
}

/** 分页响应 */
export interface SharedKeywordListResponse {
  list: SharedKeywordItem[];
  total: number;
}

/** 查询共享关键词列表 */
export const getSharedKeywordList = (params: SharedKeywordQuery) => {
  return request.get<SharedKeywordListResponse>(
    '/elfk/keyword/list',
    params as unknown as Record<string, unknown>
  );
};

/** 创建共享关键词 */
export const createSharedKeyword = (data: CreateSharedKeywordParams) => {
  return request.post<SharedKeywordItem>('/elfk/keyword/create', data);
};

/** 更新共享关键词 */
export const updateSharedKeyword = (data: UpdateSharedKeywordParams) => {
  return request.post<SharedKeywordItem>('/elfk/keyword/update', data);
};

/** 删除共享关键词 */
export const deleteSharedKeyword = (id: number) => {
  return request.post<null>(`/elfk/keyword/delete?id=${id}`);
};
