/**
 * 域名管理 API
 */

import { apiClient } from '../request';

/** 域名记录 */
export interface DomainRecord {
  recordId: string;
  domainName: string;
  rr: string;
  type: string;
  value: string;
  ttl: number;
  status: 'ENABLE' | 'DISABLE';
  createTimestamp: number;
  updateTimestamp: number;
}

/** 域名列表参数 */
export interface DomainListParams {
  page?: number;
  size?: number;
  rrKeyWord?: string;
  typeKeyWord?: string;
  valueKeyWord?: string;
  status?: string;
}

/** 添加/更新域名参数 */
export interface DomainFormData {
  record_id?: string;
  rr: string;
  type: string;
  value: string;
}

// 获取域名列表
export function getDomainList(params: DomainListParams) {
  return apiClient.get<{ list: DomainRecord[]; total: number }>('/assets/domain/list', params as unknown as Record<string, unknown>);
}

// 添加域名记录
export function addDomain(data: DomainFormData) {
  return apiClient.post('/assets/domain/add', data);
}

// 更新域名记录
export function updateDomain(data: DomainFormData) {
  return apiClient.post('/assets/domain/update', data);
}

// 更新域名状态
export function updateDomainStatus(data: { record_id: string; status: 'Enable' | 'Disable' }) {
  return apiClient.post('/assets/domain/status', data);
}

// 删除域名记录
export function deleteDomain(data: { record_id: string }) {
  return apiClient.post('/assets/domain/delete', data);
}
