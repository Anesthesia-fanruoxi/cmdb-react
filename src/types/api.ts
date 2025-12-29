/**
 * API 响应类型定义
 */

/** 通用 API 响应结构 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

/** 分页响应结构 */
export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page?: number;
  page_size?: number;
}

/** API 错误响应 */
export interface ApiError {
  code: number;
  message: string;
  details?: string;
}

// 导出类型（避免重复导出）
export type {
  LoginType,
  LoginRequest,
  LoginResponse,
  UserInfo,
  UpdateProfileRequest,
  TwoFactorGenerateResponse,
  TwoFactorVerifyRequest,
} from './auth';

export type { RoleInfo } from './auth';

export type {
  MenuItem,
  MenuMeta,
  TagView,
} from './menu';

export type {
  SystemSetting,
  DeptInfo,
  UserListItem,
  CreateUserRequest,
  UpdateUserRequest,
  DictItem,
  PageParams,
  PageResponse,
} from './system';
