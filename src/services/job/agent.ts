/**
 * Agent 管理 API
 */

import { apiClient } from '../request';

// 获取项目列表（权限过滤）
export const getJobAgentProjects = () => {
  return apiClient.get('/agent/project/list');
};

// 获取项目关联的任务列表
export const getProjectTasks = (project: string) => {
  return apiClient.get('/job/agent/project/tasks', { project });
};

// 获取Agent详情
export const getAgentDetail = (agentId: string) => {
  return apiClient.get('/job/agent/detail', { agent_id: agentId });
};

// 获取任务执行记录列表
export const getTaskExecList = (params: { project: string; task_name: string }) => {
  return apiClient.get('/job/exec/list', params as Record<string, unknown>);
};

// 获取任务详情
export const getTaskDetail = (jobId: number) => {
  return apiClient.get('/job/task/detail', { id: jobId });
};

// 保存任务配置
export const bindProjects = (data: { job_id: number; project: string; script_params: Record<string, string> }) => {
  return apiClient.post('/job/task/bind', data);
};

// 获取执行记录详情
export const getExecDetail = (execId: number) => {
  return apiClient.get('/job/exec/detail', { id: execId });
};

// 类型定义
export interface Project {
  project: string;
  project_name: string;
}

export interface Task {
  job_id: number;
  name: string;
  task_key: string;
  cron: string;
  script_type: string;
  status: number;
  next_run_time: string;
  created_at: string;
  script_params?: Record<string, string>;
}

export interface ExecRecord {
  id: number;
  exec_status: string;
  start_time: string;
  end_time: string;
  duration: number;
}
