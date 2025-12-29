/**
 * SQL查询相关API
 */

import { apiClient } from '../request';
import { getToken } from '../../utils/storage';

// 类型定义
export interface Project {
  value: string;
  label: string;
  project?: string;
  project_name?: string;
  key?: string;
}

export interface TableInfo {
  name: string;
  comment?: string;
  children?: (TableField | MenuOption)[];
}

export interface TableField {
  name?: string;
  field?: string;
  type: string;
  key?: string;
  null?: string;
  default?: string;
  extra?: string;
  comment?: string;
  isField?: true;
}

export interface MenuOption {
  name: string;
  tableName: string;
  command: string;
  isMenuOption: true;
  icon: string;
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];  // 数组格式 [[1, "name"], [2, "name2"]]
  total: number;
  took: number;
  db_name?: string;
  query_id?: string;
}

export interface HistoryItem {
  id: string;
  query_sql: string;
  created_at: string;
}

// 获取项目列表
export function getProjectList() {
  return apiClient.get<{ items?: Project[]; list?: Project[] } | Project[]>('/sql/search/projects');
}

// 查询数据库列表
export function getDatabases(data: { agent: string }) {
  return apiClient.post<{ databases: string[] }>('/sql/search/db', { ...data, type: 'db' });
}

// 查询表列表
export function getTables(data: { agent: string; dbName: string }) {
  return apiClient.post<{ tables: string[] }>('/sql/search/tb', { ...data, type: 'db' });
}

// 表详情响应（新结构）
export interface TableDetailResponse {
  columns?: TableField[];
  indexes?: unknown[];
  create_sql?: string;
  preview_data?: {
    columns: string[];
    rows: unknown[][];
  };
}

// 查询表结构
export function getTableStructure(data: { agent: string; dbName: string; tbName: string }) {
  return apiClient.post<TableDetailResponse>('/sql/search/tb-detail', { ...data, type: 'db' });
}

// 执行SQL查询
export function executeQuery(data: { agent: string; dbName: string; query: string }) {
  return apiClient.post<QueryResult>('/sql/search/data', data, { timeout: 600000 });
}

// 分页查询
export function executePageQuery(data: { 
  query_id: string;
  page?: number;
  size?: number;
  result_index?: number;
}) {
  return apiClient.post<QueryResult | { results: QueryResult[] }>('/sql/search/page', data, { timeout: 600000 });
}

// 导出查询结果
export function exportQueryResult(data: { query_id: string; db_name: string }) {
  return apiClient.post<Blob>('/sql/search/export', data, { 
    timeout: 60000,
    responseType: 'blob'
  });
}

// 获取历史记录
export function getHistoryList() {
  return apiClient.get<HistoryItem[]>('/sql/search/history');
}

// 获取表DDL
export function getTableDDL(data: { agent: string; dbName: string; tbName: string }) {
  return apiClient.post<{ ddl: string }>('/sql/search/ddl', data);
}

// 获取表索引
export function getTableIndexes(data: { agent: string; dbName: string; tbName: string }) {
  return apiClient.post<{ indexes: unknown[] }>('/sql/search/indexes', data);
}

// SSE连接
export function createSSEConnection(
  url: string,
  onMessage: (data: unknown) => void,
  onError?: (error: Event) => void,
  onComplete?: () => void
) {
  const token = getToken();
  // VITE_API_BASE_URL 已包含 /api，所以这里不需要再加
  // 例如: http://192.168.31.25:8080/api + /sql/apply/list
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const fullUrl = `${baseUrl}${url}?token=${token}`;
  
  console.log('SSE连接URL:', fullUrl);
  
  const eventSource = new EventSource(fullUrl);
  
  eventSource.addEventListener('connected', () => {
    console.log('SSE连接成功');
  });
  
  eventSource.addEventListener('data', (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      console.error('SSE解析错误:', e);
    }
  });
  
  eventSource.onerror = (error) => {
    console.error('SSE错误:', error);
    eventSource.close();
    onError?.(error);
  };
  
  eventSource.addEventListener('complete', () => {
    eventSource.close();
    onComplete?.();
  });
  
  return eventSource;
}
