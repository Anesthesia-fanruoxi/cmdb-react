/**
 * 审计模块 API
 */

import { apiClient } from './request';

// 获取登录日志
export const getLoginLog = (data: LoginLogParams) => 
  apiClient.post('/audit/login/list', data);

// 获取操作日志
export const getOperationLog = (data: OperationLogParams) => 
  apiClient.post('/audit/operation/list', data);

// 获取IP访问审计日志
export const getIpAuditLog = (params: IpAuditParams) => 
  apiClient.get('/audit/ip/list', params as Record<string, unknown>);

// 获取加解密审计日志
export const getKeyAuditLog = (params: KeyAuditParams) => 
  apiClient.get('/audit/key/list', params as Record<string, unknown>);

// 类型定义
export interface LoginLogParams {
  userName?: string;
  ip?: string;
  status?: number | null;
  startTime?: string;
  endTime?: string;
  page: number;
  pageSize: number;
}

export interface OperationLogParams {
  userName?: string;
  module?: string;
  action?: string;
  startTime?: string;
  endTime?: string;
  page: number;
  pageSize: number;
}

export interface IpAuditParams {
  request_ip?: string;
  query_ip?: string;
  status?: string;
  start_time?: string;
  end_time?: string;
  page: number;
}

export interface KeyAuditParams {
  user_name?: string;
  action?: string;
  start_time?: string;
  end_time?: string;
  page: number;
}

export interface LoginLogItem {
  id: number;
  userName: string;
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  district?: string;
  browser?: string;
  os?: string;
  status: number;
  msg?: string;
  createdAt: string;
}

export interface OperationLogItem {
  id: number;
  userName: string;
  userId: number;
  module: string;
  action: string;
  method: string;
  url: string;
  ip: string;
  duration: number;
  request?: string;
  response?: string;
  errorMsg?: string;
  createdAt: string;
}
