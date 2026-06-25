/**
 * BI 查询相关 API
 */

import { apiClient } from '../request';
import { getToken } from '../storage';

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

/** SSE 事件数据 */
export interface SseEventData {
  type: 'idle' | 'cached' | 'refreshing' | 'loading' | 'success' | 'error';
  status?: string;
  message?: string;
  progress?: number;
  tables?: DatabiTablesResponse;
  error?: string;
}

/**
 * 获取 BI 查询项目列表
 */
export const getDatabiProjects = () => {
  return apiClient.get<DatabiProjectsResponse>('/sql/databi/projects');
};

/**
 * 获取项目的数据库和表列表（SSE 流式）
 */
export const getDatabiTables = (
  project: string,
  onMessage?: (data: SseEventData) => void,
  onError?: (error: Event) => void
): EventSource => {
  const token = getToken();
  const baseUrl = import.meta.env.VITE_SSE_BASE_URL || import.meta.env.VITE_API_BASE_URL || '';
  // SSE 路径：baseUrl 已包含 /sse，所以这里直接使用 /sql/databi/tables
  const url = `${baseUrl}/sql/databi/tables?project=${encodeURIComponent(project)}&token=${token}`;
  
  const eventSource = new EventSource(url);
  let hasReceivedFinalEvent = false; // 标记是否已收到终态事件
  
  // 监听 idle 事件
  eventSource.addEventListener('idle', (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      onMessage?.({ type: 'idle', ...data });
    } catch (e) {
      console.error('SSE 解析错误:', e);
    }
  });
  
  // 监听 cached 事件
  eventSource.addEventListener('cached', (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      hasReceivedFinalEvent = true;
      onMessage?.({ type: 'cached', ...data });
    } catch (e) {
      console.error('SSE 解析错误:', e);
    }
  });
  
  // 监听 refreshing 事件
  eventSource.addEventListener('refreshing', (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      onMessage?.({ type: 'refreshing', ...data });
    } catch (e) {
      console.error('SSE 解析错误:', e);
    }
  });
  
  // 监听 loading 事件
  eventSource.addEventListener('loading', (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      onMessage?.({ type: 'loading', ...data });
    } catch (e) {
      console.error('SSE 解析错误:', e);
    }
  });
  
  // 监听 success 事件
  eventSource.addEventListener('success', (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      hasReceivedFinalEvent = true;
      onMessage?.({ type: 'success', ...data });
    } catch (e) {
      console.error('SSE 解析错误:', e);
    }
  });
  
  // 监听 error 事件
  eventSource.addEventListener('error', (event: MessageEvent) => {
    try {
      if (event.data) {
        const data = JSON.parse(event.data);
        hasReceivedFinalEvent = true;
        onMessage?.({ type: 'error', ...data });
      } else {
        hasReceivedFinalEvent = true;
        onMessage?.({ type: 'error', message: 'SSE 连接错误' });
      }
    } catch (e) {
      console.error('SSE 解析错误:', e);
    }
  });
  
  // 监听连接错误（只有在未收到终态事件时才当作错误）
  eventSource.onerror = (error: Event) => {
    eventSource.close();
    // 如果已经收到终态事件，说明是正常关闭，不触发错误回调
    if (!hasReceivedFinalEvent) {
      console.error('SSE 连接错误:', error);
      onError?.(error);
    }
  };
  
  return eventSource;
};

/**
 * 刷新项目的库和表
 */
export const refreshDatabiTables = (project: string) => {
  return apiClient.post(`/sql/databi/refresh?project=${encodeURIComponent(project)}`);
};

/**
 * 执行 BI 查询
 */
export const executeDatabiQuery = (data: DatabiQueryRequest) => {
  return apiClient.post<DatabiQueryResponse>('/sql/databi/query', data, {
    timeout: 600000, // 10分钟超时
  });
};
 
// 表字段响应
export interface DatabiColumnResponse {
  col_name: string;
  data_type: string;
  comment: string;
}

// 更新字段注释请求
export interface UpdateColumnCommentRequest {
  project: string;
  table: string;
  colName: string[];
  comment: string[];
}

/**
 * 获取表字段列表
 */
export const getDatabiColumnList = (project: string, table: string) => {
  return apiClient.get<DatabiColumnResponse[]>('/sql/databi/column/list', { project, table });
};

/**
 * 更新字段注释（支持批量）
 */
export const updateDatabiColumnComment = (data: UpdateColumnCommentRequest) => {
  return apiClient.post('/sql/databi/column/update', data);
};
