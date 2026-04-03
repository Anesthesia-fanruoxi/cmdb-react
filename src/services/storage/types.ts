/**
 * 存储类型定义
 */

// ==================== App 公共存储 ====================
export interface UpdateInfo {
  latestVersion: string;       // 服务器最新版本号
  downloadedVersion: string;   // 已下载的版本号
  downloadedPath: string;      // 已下载文件的路径
  downloadStatus: 'none' | 'downloading' | 'completed' | 'failed';
  downloadProgress: number;    // 下载进度 0-100
  changelog: string;           // 更新日志
  lastCheckTime: number;       // 最后检查时间戳
}

export interface AppData {
  loginHistory: string[];      // 登录过的用户名（最多10个）
  lastUser: string;            // 最后登录的用户名
  defaultTheme: 'light' | 'dark'; // 未登录时的默认主题
  appVersion: string;          // 应用版本号
  installPath: string;         // 应用安装路径
  lastUpdateCheck: number;     // 最后检查更新时间戳
  update: UpdateInfo;          // 更新信息
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

/** SQL 元数据缓存（按项目存储） */
export interface SqlMetadataCache {
  [projectName: string]: {
    databases: string[];                           // 数据库列表
    dbTables: Record<string, string[]>;           // 数据库->表映射
    tableStats: Record<string, {                  // 表统计信息
      rowCount: number;
      dataLength: number;
      indexLength?: number;
    }>;
    fields: Record<string, Array<{                // 表->字段映射
      caption: string;
      value: string;
      meta: string;
      comment?: string;
      score: number;
    }>>;
    timestamp: number;                            // 缓存时间戳
    version: string;                              // 缓存版本
  };
}

export interface StateData {
  visitedViews: ViewItem[];    // 已打开的标签页
  cachedViews: string[];       // 已缓存的页面
  activeRoute: string;         // 当前激活路由
  sidebarCollapsed: boolean;   // 侧边栏折叠状态
  pageStates: Record<string, PageState>; // 页面状态快照
  sqlMetadata?: SqlMetadataCache; // SQL 元数据缓存
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
  duplicateLine: string;
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
  sqlEditorHeightPercent: number; // 编辑器高度百分比
  sqlSidebarWidth: number; // SQL 左侧 TableTree 宽度（px）
  sqlRowHighlightColor: string; // 查询结果选中行高亮颜色
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
