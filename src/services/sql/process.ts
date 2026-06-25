/**
 * SQL审核流程管理相关API
 */

import { apiClient } from '../request';

// 类型定义
export interface ProcessItem {
  id: string;
  projectId: string;
  projectName: string;
  applyId: number;
  applyName: string;
  executorId: number;
  executorName: string;
  created_at: string;
  updated_at: string;
}

export interface ProcessUser {
  id: number;
  user_name: string;
  nick_name: string;
}

export interface ProcessUsers {
  approvers: ProcessUser[];
  executors: ProcessUser[];
}

export interface CreateProcessData {
  project_id: string;
  apply_id: number;
  executor_id: number;
}

export interface UpdateProcessData {
  id: string;
  apply_id: number;
  executor_id: number;
}

// 获取SQL流程项目列表
export function getSqlProcessProjects() {
  return apiClient.get('/sql/process/projects');
}

// 获取SQL流程列表
export function getProcessList(params?: { project_id?: string }) {
  return apiClient.get<{ list: ProcessItem[]; total: number }>('/sql/process/list', params);
}

// 获取流程用户列表（审批人和执行人）
export function getProcessUsers() {
  return apiClient.get<ProcessUsers>('/sql/process/users');
}

// 创建SQL流程
export function createProcess(data: CreateProcessData) {
  return apiClient.post<{ id: string }>('/sql/process/create', data);
}

// 更新SQL流程
export function updateProcess(data: UpdateProcessData) {
  return apiClient.put<void>('/sql/process/update', data);
}

// 删除SQL流程
export function deleteProcess(id: string) {
  return apiClient.delete<void>(`/sql/process/delete?id=${id}`);
}
