/**
 * 状态管理类型定义
 */

import type { UserInfo } from './auth';

/** 认证状态 */
export interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
}

/** 应用全局状态 */
export interface AppState {
  isLoading: boolean;
  error: string | null;
}
