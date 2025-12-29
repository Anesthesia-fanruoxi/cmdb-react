/**
 * 系统设置相关 API
 */

import { apiClient } from '../request';
import type { ApiResponse } from '../../types/api';

export interface BasicSetting {
  id?: number;
  system_name?: string;
  system_short_name?: string;
  system_logo?: string;
  login_logo?: string;
  favicon_logo?: string;
  system_url?: string;
  fs_webhook_url?: string;
  password_min_length: number;
  password_max_length: number;
  password_need_number: boolean;
  password_need_letter: boolean;
  password_need_case: boolean;
  password_need_special: boolean;
  default_password: string;
  session_timeout: number;
  login_protection?: boolean;
  login_fail_count?: number;
  login_lock_time?: number;
  token_expire_time?: number;
}

export interface SecuritySetting {
  login_fail_lock: boolean;
  login_fail_count: number;
  login_fail_lock_time: number;
  ip_whitelist_enabled: boolean;
  ip_whitelist: string[];
}

/** 获取基础设置 */
export function getBasicSetting(): Promise<ApiResponse<BasicSetting>> {
  return apiClient.get<BasicSetting>('/system/setting/basic');
}

/** 更新基础设置 */
export function updateBasicSetting(data: Partial<BasicSetting>): Promise<ApiResponse<null>> {
  return apiClient.post<null>('/system/setting/basic/update', data);
}

/** 获取安全设置 */
export function getSecuritySetting(): Promise<ApiResponse<SecuritySetting>> {
  return apiClient.get<SecuritySetting>('/system/setting/security');
}

/** 更新安全设置 */
export function updateSecuritySetting(data: Partial<SecuritySetting>): Promise<ApiResponse<null>> {
  return apiClient.put<null>('/system/setting/security', data);
}
