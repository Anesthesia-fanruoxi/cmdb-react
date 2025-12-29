/**
 * 任务中心 API 服务
 */

import { apiClient } from './request';

// 任务类型定义
export interface Task {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'canceled';
  created_at: string;
  progress?: number;
  error_message?: string;
  setup?: Record<string, { status: string; duration?: number }>;
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
  items: { value: string; count: number }[];
  total: number;
  page: number;
  page_size: number;
}

// 获取任务列表
export async function getTaskList(): Promise<TaskListResponse> {
  return apiClient.get('/tasks/list');
}

// 获取任务状态
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

// 导出任务数据
export async function exportTaskData(params: {
  id: string;
  type: string;
}): Promise<Blob> {
  const response = await apiClient.post<Blob>('/tasks/export', params, { responseType: 'blob' });
  return response as unknown as Blob;
}
