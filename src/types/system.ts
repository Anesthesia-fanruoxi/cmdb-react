/**
 * 系统管理相关类型定义
 */

/** 系统设置 */
export interface SystemSetting {
  system_name: string;
  system_short_name: string;
  system_logo?: string;
  favicon_logo?: string;
  login_logo?: string;
}

/** 部门信息 */
export interface DeptInfo {
  id: string;
  name: string;
  parent_id?: string;
  sort?: number;
  leader?: string;
  phone?: string;
  email?: string;
  is_enabled?: boolean;
  children?: DeptInfo[];
}

/** 角色信息 */
export interface RoleInfo {
  id: string;
  name: string;
  code: string;
  description?: string;
  permissions?: string[];
  is_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
}

/** 用户列表项 */
export interface UserListItem {
  id: string;
  user_name: string;
  nick_name: string;
  email?: string;
  phone?: string;
  role_id: string;
  role_name?: string;
  dept_id?: string;
  dept_name?: string;
  is_enabled: boolean;
  otp_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/** 创建用户请求 */
export interface CreateUserRequest {
  user_name: string;
  nick_name?: string;
  password: string;
  email?: string;
  phone?: string;
  role_id: string;
  dept_id?: string;
  is_enabled?: boolean;
}

/** 更新用户请求 */
export interface UpdateUserRequest {
  id: string;
  nick_name?: string;
  email?: string;
  phone?: string;
  role_id?: string;
  dept_id?: string;
  is_enabled?: boolean;
  password?: string;
}

/** 字典分组 */
export interface DictGroup {
  group_key: string;
  group_name: string;
  count: number;
}

/** 字典项 */
export interface DictItem {
  id: number;
  group_key: string;
  group_name: string;
  item_key: string;
  item_name: string;
  item_value: string;
  color?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

/** 分页参数 */
export interface PageParams {
  page?: number;
  page_size?: number;
}

/** 分页响应 */
export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
