/**
 * K8s 服务管理 API
 */

import { apiClient } from '../request';

/** 项目信息 */
export interface KubeProject {
  value: string;
  label: string;
}

/** 端口信息 */
export interface PortInfo {
  name: string;
  port: number;
  target_port: number;
  node_port?: number;
  protocol: string;
}

/** 服务信息 */
export interface KubeService {
  name: string;
  namespace: string;
  cluster_ip: string;
  type: string;
  ports: PortInfo[];
}

// 获取项目列表
export function getKubeProjects() {
  return apiClient.get<KubeProject[]>('/assets/kubeService/projects');
}

// 获取命名空间列表
export function getNamespaceList(data: { project: string; type: string }) {
  return apiClient.post<string[]>('/assets/kubeService/namespace', data);
}

// 获取服务列表
export function getServiceList(data: { namespace: string }) {
  return apiClient.post<{ services: KubeService[] }>('/assets/kubeService/list', data);
}
