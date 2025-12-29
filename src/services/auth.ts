/**
 * 认证相关 API
 */

import { apiClient } from './request';
import type {
  LoginRequest,
  LoginResponse,
  UserInfo,
  UpdateProfileRequest,
  TwoFactorGenerateResponse,
  TwoFactorVerifyRequest,
} from '../types/auth';
import type { ApiResponse } from '../types/api';

/**
 * 用户登录
 */
export function login(data: LoginRequest): Promise<ApiResponse<LoginResponse>> {
  // 确保包含 login_type
  const requestData = {
    ...data,
    login_type: data.login_type || 'password',
  };
  return apiClient.post<LoginResponse>('/system/user/login', requestData);
}

/**
 * 移动端双因子登录
 */
export function mobileLogin(data: LoginRequest): Promise<ApiResponse<LoginResponse>> {
  return apiClient.post<LoginResponse>('/system/user/mobile/login', data);
}

/**
 * 用户登出
 */
export function logout(): Promise<ApiResponse<null>> {
  return apiClient.post<null>('/system/user/logout');
}

/**
 * 获取个人信息
 */
export function getProfile(): Promise<ApiResponse<UserInfo>> {
  return apiClient.get<UserInfo>('/user/profile/detail');
}

/**
 * 更新个人信息
 */
export function updateProfile(data: UpdateProfileRequest): Promise<ApiResponse<null>> {
  return apiClient.put<null>('/user/profile/update', data);
}

/**
 * 生成双因子认证
 * GET 方法获取新的双因子信息
 */
export function generateTwoFactor(): Promise<ApiResponse<TwoFactorGenerateResponse>> {
  return apiClient.get<TwoFactorGenerateResponse>('/system/user/factor/generate');
}

/**
 * 重置双因子认证
 * POST 方法重置双因子
 */
export function resetTwoFactor(): Promise<ApiResponse<TwoFactorGenerateResponse>> {
  return apiClient.post<TwoFactorGenerateResponse>('/system/user/factor/generate');
}

/**
 * 验证双因子认证
 */
export function verifyTwoFactor(data: TwoFactorVerifyRequest): Promise<ApiResponse<null>> {
  return apiClient.post<null>('/system/user/factor/verify', data);
}
