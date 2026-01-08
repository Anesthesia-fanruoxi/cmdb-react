/**
 * 存储类型定义
 */

// ==================== App 公共存储 ====================
export interface AppData {
  loginHistory: string[];      // 登录过的用户名（最多10个）
  lastUser: string;            // 最后登录的用户名
  defaultTheme: 'light' | 'dark'; // 未登录时的默认主题
  appVersion: string;          // 应用版本号
  lastUpdateCheck: number;     // 最后检查更新时间戳
  [key: string]: unknown;      // 索引签名
}

// ==================== Token 存储 ====================
export interface TokenData {
  token: string;               // JWT token
  username: string;            // token 对应的用户名
  expireAt: number;            // 过期时间戳
  [key: string]: unknown;      // 索引签名
}

// ==================== 用户数据 ====================
// 使用与 @/types/auth 兼容的类型
export interface UserInfo {
  id: string;
  user_name: string;
  nick_name: string;
  email: string;
  phone: string;
  role_id: string;
  role?: {
    id: string;
    name: string;
    code: string;
    description?: string;
  };
  dept_id: string;
  dept_name?: string;
  is_enabled: boolean;
  otp_enabled: boolean;
  permissions: string[];
  avatar?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProfileData {
  userInfo: UserInfo;
  permissions: string[];
  menus: MenuItem[];
  roleId: number;
  roleName: string;
}

export interface MenuItem {
  id: number;
  name: string;
  path: string;
  icon?: string;
  component?: string;
  parent_id: number;
  sort: number;
  hidden: boolean;
  children?: MenuItem[];
}

// ==================== 使用状态 ====================
export interface ViewItem {
  path: string;
  name: string;
  title: string;
  query?: Record<string, string>;
}

/** 页面状态（表单数据、滚动位置等） */
export interface PageState {
  scrollTop?: number;
  formData?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface StateData {
  visitedViews: ViewItem[];    // 已打开的标签页
  cachedViews: string[];       // 已缓存的页面
  activeRoute: string;         // 当前激活路由
  sidebarCollapsed: boolean;   // 侧边栏折叠状态
  pageStates: Record<string, PageState>; // 页面状态快照
  lastSnapshot: number;        // 最后快照时间戳
}

// ==================== 偏好设置 ====================
export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** SQL 编辑器快捷键配置 */
export interface SqlShortcuts {
  execute: string;
  format: string;
  comment: string;
  find: string;
  replace: string;
  newTab: string;
  history: string;
  saveShared: string;
}

/** ELFK 日志搜索快捷键配置 */
export interface ElfkShortcuts {
  search: string;
  history: string;
  saveShared: string;
  newTab: string;
}

/** 监控默认设置 */
export interface MonitorDefaults {
  refreshInterval: number;
  timeRange: string;
  chartType: string;
}

/** ES 搜索设置 */
export interface EsSearchPrefs {
  recentSearches: string[];
  maxRecentSearches: number;
  defaultPageSize: number;
}

/** 界面偏好 */
export interface UiPrefs {
  sidebarCollapsed: boolean;
  tablePageSize: number;
  codeEditorFontSize: number;
  sqlEditorHeight: number;
}

export interface PreferencesData {
  avatar: string;              // 用户头像（base64或URL）
  theme: 'light' | 'dark';     // 主题颜色
  windowBounds: WindowBounds;  // 窗口大小位置
  sidebarWidth: number;        // 侧边栏宽度
  // 用户偏好设置
  sqlShortcuts?: SqlShortcuts;
  elfkShortcuts?: ElfkShortcuts;
  monitorDefaults?: MonitorDefaults;
  esSearchPrefs?: EsSearchPrefs;
  uiPrefs?: UiPrefs;
}

// ==================== 设备凭据 ====================
export interface CredentialsData {
  deviceKey: string;           // 设备绑定密钥
  bindTime: number;            // 绑定时间戳
  machineId: string;           // 机器码
}

// ==================== 存储文件映射 ====================
export type StorageFile = 
  | 'app.dat'
  | 'tokens.dat'
  | 'profiles.dat'
  | 'states.dat'
  | 'preferences.dat'
  | 'credentials.dat';

// 多用户数据结构（以用户名为 key）
export type MultiUserData<T> = Record<string, T>;
