/**
 * 密钥加解密 API
 */

import { apiClient } from '../request';

/** 项目信息 */
export interface KeyProject {
  project: string;
  project_name: string;
}

/** 批量解密结果 */
export interface BatchDecryptResult {
  encrypted: string;
  decrypted: string;
}

// 获取项目列表
export function getKeyProjects() {
  return apiClient.get<{ items: KeyProject[] }>('/assets/key/projects');
}

// 加密
export function keyEncrypt(data: string, project: string) {
  return apiClient.get<{ encryptedData: string }>('/assets/key/encrypt', { data, project });
}

// 解密
export function keyDecrypt(encryptedData: string, project: string) {
  return apiClient.get<{ data: string }>('/assets/key/decrypt', { encryptedData, project });
}

// 批量解密
export function batchDecrypt(data: string[], project: string) {
  return apiClient.post<BatchDecryptResult[]>('/assets/key/batchDecrypt', { project, data });
}
