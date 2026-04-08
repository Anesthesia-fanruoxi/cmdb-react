/**
 * 阿里云账号余额 API
 */

import { apiClient } from '../request';

export interface BalanceData {
  currency: string;
  available_amount: string;
  available_cash_amount: string;
  credit_amount: string;
}

export interface BalanceItem {
  project: string;
  project_name?: string;
  data?: BalanceData;
  error?: string;
}

export interface ProjectItem {
  project: string;
  project_name: string;
}

// 查询余额（无需传参）
export function getAlBalance() {
  return apiClient.get<BalanceItem[]>('/assets/alBalance/balance');
}

// 获取所有可用项目列表
export function getAlBalanceProjects() {
  return apiClient.get<ProjectItem[]>('/assets/alBalance/projects');
}

// 获取已配置的项目列表
export function getAlBalanceConfig() {
  return apiClient.get<string[]>('/assets/alBalance/config/list');
}

// 更新配置的项目列表
export function updateAlBalanceConfig(projects: string[]) {
  return apiClient.post('/assets/alBalance/config/update', { projects });
}
