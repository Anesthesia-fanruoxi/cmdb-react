/**
 * SQL查询相关API
 */

import { apiClient } from '../request';
import { getToken } from '../storage';

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

// 数据库元数据
export interface DatabaseMetadata {
  db_name: string;
  tables: {
    name: string;
    comment?: string;
    row_count?: number;
    data_length?: number;
    index_length?: number;
    columns: {
      name: string;
      data_type: string;
      column_type?: string;
      comment?: string;
      column_key?: string;
      is_primary_key?: boolean;
    }[];
  }[];
}

// 查询数据库列表
export function getDatabases(data: { agent: string }) {
  return apiClient.post<{ 
    databases: string[];
    metadata?: {
      databases: DatabaseMetadata[];
    };
  }>('/sql/search/db', { ...data, type: 'db' });
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
export function executeQuery(data: { agent: string; dbName: string; query: string; query_id?: string }) {
  // React 项目固定为桌面端
  return apiClient.post<QueryResult>('/sql/search/data', { ...data, platform: 'desktop' }, { timeout: 600000 });
}

// 取消SQL查询
export function cancelQuery(data: { agent: string; query_id: string }) {
  return apiClient.post<{ code: number; message: string }>('/sql/search/cancel', data);
}

// 分页查询
export function executePageQuery(data: { 
  query_id: string;
  page?: number;
  size?: number;
  result_index?: number;
}) {
  return apiClient.post<QueryResult | { results: QueryResult[] }>('/sql/search/page', {
    ...data,
    platform: 'desktop'
  }, { timeout: 600000 });
}

// 导出查询结果（异步导出,后端发送邮件）
export function exportQueryResult(data: { query_id: string; db_name: string }) {
  return apiClient.post<{ code: number; message: string }>('/sql/search/export', {
    ...data,
    platform: 'desktop'
  }, { 
    timeout: 60000
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
  onComplete?: () => void,
  options?: { reconnectInterval?: number }
) {
  const token = getToken();
  const baseUrl = import.meta.env.VITE_SSE_BASE_URL || import.meta.env.VITE_API_BASE_URL || '';
  const separator = url.includes('?') ? '&' : '?';
  const fullUrl = `${baseUrl}${url}${separator}token=${token}`;

  const { reconnectInterval = 3000 } = options || {};
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let isClosed = false;

  let currentES: EventSource | null = null;

  const connect = (): EventSource => {
    const eventSource = new EventSource(fullUrl);
    currentES = eventSource;

    eventSource.addEventListener('data', (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (e) {
        console.error('SSE解析错误:', e);
      }
    });

    eventSource.onerror = (error) => {
      console.error('SSE连接断开，准备重连...', error);
      eventSource.close();

      if (!isClosed) {
        reconnectTimer = setTimeout(() => {
          if (!isClosed) {
            console.log('SSE重连中...');
            connect();
          }
        }, reconnectInterval);
      } else {
        onError?.(error);
      }
    };

    eventSource.addEventListener('complete', () => {
      eventSource.close();
      onComplete?.();
    });

    return eventSource;
  };

  const eventSource = connect();

  // 返回包装对象，close 时同时取消重连定时器
  return {
    get readyState() { return currentES?.readyState ?? 2; },
    getStatus: () => {
      if (isClosed) return 'closed';
      const rs = currentES?.readyState;
      if (rs === 0) return 'connecting';
      if (rs === 1) return 'open';
      return 'closed';
    },
    close: () => {
      isClosed = true;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      eventSource.close();
    }
  };
}
