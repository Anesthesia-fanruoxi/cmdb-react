/**
 * K8s Pod 管理 API
 */

import { apiClient } from '../request';

/** 项目信息 */
export interface PodProject {
  project: string;
  project_name: string;
}

/** Pod 状态信息 */
export interface PodStatus {
  project: string;
  project_name: string;
  namespace: string;
  service_name: string;
  domain?: string;
  replicas: number;
  ready_replicas: number;
  available_replicas: number;
  status: 'running' | 'stopped' | 'pending' | 'error';
  last_update: string;
}

/** API 原始返回的 Pod 项 */
export interface PodRawItem {
  project: string;
  project_name?: string;
  namespace: string;
  domain?: string;
  is_active: boolean;
}

/** K8s 列表响应 */
export interface K8sListResponse {
  result: PodRawItem[];
  active_count: number;
  inactive_count: number;
  count: number;
}

// 获取项目列表
export function getKubePodProjects() {
  return apiClient.get<{ items: PodProject[] }>('/assets/kubePod/projects');
}

// 获取 K8s 服务状态列表
export function getK8sList(data: { project?: string }) {
  return apiClient.post<K8sListResponse>('/assets/kubePod/status', data);
}

// 操作 Pod（扩缩容）
export function operatePod(data: { project: string; namespace: string; service_name: string; replicas: number }) {
  return apiClient.post<{ task_id: string }>('/tasks/pod/scale', data);
}

// 批量操作 Pod
export function batchOperatePod(data: { items: Array<{ project: string; namespace: string; service_name: string; replicas: number }> }) {
  return apiClient.post<{ task_ids: string[] }>('/tasks/pod/batch-scale', data);
}
