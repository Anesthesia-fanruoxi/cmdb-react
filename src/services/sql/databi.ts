/**
 * BI 查询相关 API
 */

import { apiClient } from '../request';

/** 项目列表响应 */
export interface DatabiProjectsResponse {
  projects?: string[];
  items?: Array<string | { name?: string; project?: string; id?: string; [key: string]: any }>;
  list?: Array<string | { name?: string; project?: string; id?: string; [key: string]: any }>;
}

/** 表列表响应 */
export interface DatabiTablesResponse {
  [database: string]: string[];
}

/** 查询请求参数 */
export interface DatabiQueryRequest {
  project: string;
  context: string;
  type: 'sql';
}

/** 查询响应 */
export interface DatabiQueryResponse {
  head: string[];
  table: unknown[][];
}

/**
 * 获取 BI 查询项目列表
 */
export const getDatabiProjects = () => {
  return apiClient.get<DatabiProjectsResponse>('/sql/databi/projects');
};

/**
 * 获取项目的数据库和表列表
 */
export const getDatabiTables = (project: string) => {
  return apiClient.get<DatabiTablesResponse>('/sql/databi/tables', { project });
};

/**
 * 执行 BI 查询
 */
export const executeDatabiQuery = (data: DatabiQueryRequest) => {
  return apiClient.post<DatabiQueryResponse>('/sql/databi/query', data, {
    timeout: 600000, // 10分钟超时
  });
};