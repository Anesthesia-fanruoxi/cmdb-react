/**
 * 认证相关类型定义
 */

/** 登录类型 */
export type LoginType = 'password' | 'totp';

/** 登录请求参数 */
export interface LoginRequest {
  user_name: string;
  login_type: LoginType;
  password?: string;
  totp_code?: string;
}

/** 登录响应数据 */
export interface LoginResponse {
  token: string;
  user_id: string;
  user_name: string;
  nick_name?: string;
  role_id?: string;
  is_default_pass?: boolean;
}

/** 用户信息 */
export interface UserInfo {
  id: string;
  user_name: string;
  nick_name: string;
  email: string;
  phone: string;
  role_id: string;
  role?: RoleInfo;
  dept_id: string;
  dept_name?: string;
  is_enabled: boolean;
  otp_enabled: boolean;
  permissions: string[];
  created_at?: string;
  updated_at?: string;
  avatar?: string;
}

/** 角色信息 */
export interface RoleInfo {
  id: string;
  name: string;
  code: string;
  description?: string;
}

/** 更新个人信息请求 */
export interface UpdateProfileRequest {
  nick_name?: string;
  phone?: string;
  email?: string;
  password?: string;
}

/** 双因子认证生成响应 */
export interface TwoFactorGenerateResponse {
  secret: string;
  qrcode_url: string;
  backup_codes: string[];
}

/** 双因子认证验证请求 */
export interface TwoFactorVerifyRequest {
  code: string;
}
