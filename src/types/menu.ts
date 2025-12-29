/**
 * 菜单相关类型定义
 */

/** 菜单项 */
export interface MenuItem {
  id?: string;
  path: string;
  name: string;
  component?: string;
  redirect?: string;
  icon?: string;
  permission?: string;
  perms?: string[];
  is_visible?: boolean;
  sort?: number;
  parent_id?: string;
  children?: MenuItem[];
  meta?: MenuMeta;
}

/** 菜单元信息 */
export interface MenuMeta {
  title: string;
  icon?: string;
  permission?: string;
  perms?: string[];
  affix?: boolean;
  noCache?: boolean;
  noAuth?: boolean;
}

/** 标签页视图 */
export interface TagView {
  path: string;
  name: string;
  title: string;
  query?: Record<string, string>;
  meta?: MenuMeta;
}

/** 创建菜单请求 */
export interface CreateMenuRequest {
  name: string;
  path: string;
  component?: string;
  icon?: string;
  permission?: string;
  parent_id?: string;
  sort?: number;
  is_visible?: boolean;
}

/** 更新菜单请求 */
export interface UpdateMenuRequest extends CreateMenuRequest {
  id: string;
}
