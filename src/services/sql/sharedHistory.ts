/**
 * SQL 共享查询 API
 * 用于保存和管理 SQL 共享查询语句
 */

import request from '../request';

/** 共享查询项 */
export interface SqlSharedQueryItem {
  id: number;
  project: string;
  db_name: string;
  query: string;
  remark: string;
  is_personal: boolean;
  creator: string;
  created_at: string;
}

/** 查询共享查询参数 */
export interface SqlSharedQueryParams {
  page?: number;         // 页码，默认1
  project?: string;      // 项目名称（模糊搜索）
  db_name?: string;      // 数据库名称（模糊搜索）
  search?: string;       // 混合搜索（匹配备注、添加人）
  is_personal?: boolean; // true=个人收藏，不传=全部/共享
}

/** 创建共享查询参数 */
export interface CreateSqlSharedQueryParams {
  project: string;
  db_name: string;
  query: string;
  remark?: string;
  is_personal?: boolean;    // true=个人收藏，不传或false=共享
}

/** 更新共享查询参数 */
export interface UpdateSqlSharedQueryParams {
  id: number;
  query?: string;
  remark?: string;
  is_personal?: boolean;   // 可选切换个人/共享
}

/** 分页响应 */
export interface SqlSharedQueryListResponse {
  list: SqlSharedQueryItem[];
  total: number;
  page: number;
  size: number;
}

/** 查询共享查询列表 */
export const getSqlSharedQueryList = (params: SqlSharedQueryParams) => {
  return request.get<SqlSharedQueryListResponse>(
    '/sql/shared/list',
    params as unknown as Record<string, unknown>
  );
};

/** 创建共享查询 */
export const createSqlSharedQuery = (data: CreateSqlSharedQueryParams) => {
  return request.post<SqlSharedQueryItem>('/sql/shared/create', data);
};

/** 更新共享查询 */
export const updateSqlSharedQuery = (data: UpdateSqlSharedQueryParams) => {
  return request.post<SqlSharedQueryItem>('/sql/shared/update', data);
};

/** 删除共享查询 */
export const deleteSqlSharedQuery = (id: number) => {
  return request.delete<null>(`/sql/shared/delete?id=${id}`);
};

// 兼容旧接口名称
export type SqlSharedHistoryItem = SqlSharedQueryItem;
export type SqlSharedHistoryQuery = SqlSharedQueryParams;
export type CreateSqlSharedHistoryParams = CreateSqlSharedQueryParams;
export const getSqlSharedHistoryList = getSqlSharedQueryList;
export const createSqlSharedHistory = createSqlSharedQuery;
export const deleteSqlSharedHistory = (id: string) => deleteSqlSharedQuery(Number(id));
