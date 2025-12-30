/**
 * 执行记录 API
 */

import { apiClient } from '../request';

// 获取项目列表
export const getJobExecProjects = () => apiClient.get('/job/exec/projects');

// 获取执行记录列表
export const getExecList = (params: ExecQueryParams) => apiClient.get('/job/exec/list', params as Record<string, unknown>);

// 获取执行记录详情
export const getExecDetail = (id: number) => apiClient.get('/job/exec/detail', { id });

// 获取任务列表（用于名称映射）
export const getTaskListForExec = () => apiClient.get('/job/task/list');

// 类型定义
export interface ExecQueryParams {
  page?: number;
  page_size?: number;
  job_id?: string;
  project?: string;
  task_name?: string;
  exec_status?: number | null;
}

export interface ExecRecord {
  id: number;
  job_id: number;
  project: string;
  exec_status: number;
  start_time: string;
  end_time: string;
  duration: number;
  output?: string;
  error_msg?: string;
}

export interface ProjectOption {
  key: string;
  value: string;
}
