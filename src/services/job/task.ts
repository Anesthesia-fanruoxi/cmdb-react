/**
 * 任务管理 API
 */

import { apiClient } from '../request';

// 获取任务列表
export const getTaskList = () => apiClient.get('/job/task/list');

// 获取任务可绑定项目列表
export const getJobTaskProjects = () => apiClient.get('/job/task/projects');

// 创建任务
export const createTask = (data: TaskFormData) => apiClient.post('/job/task/create', data);

// 更新任务
export const updateTask = (data: Partial<TaskFormData> & { id: number; status?: number }) => 
  apiClient.put('/job/task/update', data);

// 删除任务
export const deleteTask = (id: number) => apiClient.delete(`/job/task/delete?id=${id}`);

// 获取任务详情
export const getTaskDetail = (id: number) => apiClient.get('/job/task/detail', { id });

// 绑定项目
export const bindProjects = (data: { job_id: number; project: string; script_params?: Record<string, string> }) => 
  apiClient.post('/job/task/bind', data);

// 解绑项目
export const unbindProject = (data: { job_id: number; project: string }) => 
  apiClient.post('/job/task/unbind', data);

// 获取绑定详情
export const getTaskBindDetail = (jobId: number) => 
  apiClient.get('/job/task/bind/detail', { job_id: jobId });

// 验证 cron 表达式
export const validateCronExpression = (cron: string): Promise<{ code: number; data?: CronValidateResult }> => 
  apiClient.post('/job/task/cron', { cron });

export interface CronValidateResult {
  is_valid: boolean;
  next_run?: string[];
}

// 类型定义
export interface Task {
  id: number;
  name: string;
  task_key: string;
  cron: string;
  cron_desc?: string;
  description?: string;
  status: number;
  script_type?: string;
  script_content?: string;
  created_at?: string;
}

export interface TaskFormData {
  id?: number;
  name: string;
  task_key: string;
  cron: string;
  description?: string;
  script_type?: string;
  script_content?: string;
}

export interface TaskBindInfo {
  project: string;
  project_name?: string;
  script_params?: Record<string, string>;
  next_run_time?: string;
  status?: number;
}
