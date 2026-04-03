/**
 * 任务中心 API 服务
 */

import { apiClient } from './request';
import { getToken } from './storage/tokenStorage';

// 任务类型定义
export interface Task {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'canceled';
  created_at: string;
  progress?: number;
  error_message?: string;
  setup?: Record<string, { 
    status: string; 
    duration?: number;
    description?: string;
  }>;
  // 新增字段
  type_text?: string;        // 任务类型文本
  status_text?: string;      // 状态文本
  nick_name?: string;        // 用户昵称
  is_expired?: boolean;      // 是否过期
  processed_count?: number;  // 已处理数量
  total_count?: number;      // 总数量
  download_url?: string;     // 临时下载链接（60秒有效）
}

export interface TaskListResponse {
  code: number;
  data: {
    items: Task[];
  };
}

export interface TaskStatusResponse {
  code: number;
  data: Task;
}

export interface PreviewData {
  items?: { value: string; count: number }[];  // 数据分析预览
  columns?: string[];                          // SQL/ES 导出列名
  rows?: any[][];                              // SQL/ES 导出数据行
  total?: number;                              // 数据分析总数
  total_rows?: number;                         // SQL/ES 总行数
  cache_total?: number;                        // 缓存总数
  page: number;
  page_size: number;
}

// 获取任务列表
export async function getTaskList(): Promise<TaskListResponse> {
  return apiClient.get('/tasks/list');
}

// 获取任务详情（SSE流式）
export function getTaskDetail(
  taskId: string,
  onMessage: (data: Task) => void,
  onError?: () => void,
  onComplete?: () => void
): EventSource {
  const token = getToken();
  const baseUrl = import.meta.env.VITE_SSE_BASE_URL || import.meta.env.VITE_API_BASE_URL || '';
  const url = `${baseUrl}/tasks/detail?id=${taskId}&token=${token}`;
  
  const eventSource = new EventSource(url);
  
  eventSource.addEventListener('data', (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      console.error('[TaskDetail] SSE 解析错误:', e);
    }
  });
  
  eventSource.onerror = () => {
    console.error('[TaskDetail] SSE 错误');
    eventSource.close();
    onError?.();
  };
  
  eventSource.addEventListener('complete', () => {
    eventSource.close();
    onComplete?.();
  });
  
  return eventSource;
}

// 获取任务状态（普通HTTP请求，用于轮询）
export async function getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
  return apiClient.get(`/tasks/status?id=${taskId}`);
}

// 取消任务
export async function cancelTask(taskId: string): Promise<{ code: number }> {
  return apiClient.put(`/tasks/cancel?id=${taskId}`);
}

// 预览任务数据
export async function previewTaskData(params: {
  id: string;
  type: string;
  page: number;
}): Promise<{ code: number; data: PreviewData }> {
  return apiClient.post('/tasks/preview', params);
}

// 生成临时下载链接
export async function generateDownloadLink(taskId: string): Promise<{
  code: number;
  data: {
    downloadUrl: string;
    downloadCode: string;
    expiresAt: number;
  };
  message?: string;
}> {
  return apiClient.post('/tasks/download/generate', { taskId });
}

// 导出任务数据（已废弃，使用原生下载）
export async function exportTaskData(params: {
  id: string;
  type: string;
}): Promise<Blob> {
  const response = await apiClient.post('/tasks/export', params, { responseType: 'blob' });
  return response as unknown as Blob;
}
