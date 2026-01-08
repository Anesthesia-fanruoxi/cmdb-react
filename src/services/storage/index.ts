/**
 * 存储服务入口
 * 统一导出所有存储相关接口
 */

// 核心模块
export {
  isTauriEnv,
  initAllStorage,
  waitForStorageInit,
  clearMemoryCache,
} from './core';

// App 公共存储
export {
  getAppData,
  updateAppData,
  getLoginHistory,
  addLoginHistory,
  getLastUser,
  getDefaultTheme,
  setDefaultTheme,
  updateLastUpdateCheck,
  updateAppVersion,
  getUpdateInfo,
  saveUpdateInfo,
  clearUpdateInfo,
} from './appStorage';

// Token 存储
export {
  getToken,
  getTokenData,
  getTokenUsername,
  isTokenExpired,
  hasValidToken,
  saveToken,
  removeToken,
} from './tokenStorage';

// 用户数据存储
export {
  getProfile,
  saveProfile,
  updateProfile,
  getUserInfo,
  getPermissions,
  getMenus,
  removeProfile,
} from './profileStorage';

// 使用状态存储
export {
  getState,
  saveState,
  updateState,
  getVisitedViews,
  getCachedViews,
  getActiveRoute,
  getSidebarCollapsed,
  removeState,
} from './stateStorage';

// 偏好设置存储
export {
  getPreferences,
  savePreferences,
  updatePreferences,
  getUserTheme,
  setUserTheme,
  getUserAvatar,
  setUserAvatar,
  getWindowBounds,
  setWindowBounds,
  getSidebarWidth,
  setSidebarWidth,
  removePreferences,
} from './preferencesStorage';

// 设备凭据由 Rust 端管理（device_credentials.dat）
// 前端通过 src/services/machine.ts 调用

// 自动保存
export {
  markDirty,
  forceSave,
  startAutoSave,
  stopAutoSave,
} from './autoSave';

// 类型导出
export type {
  AppData,
  UpdateInfo,
  TokenData,
  ProfileData,
  UserInfo,
  MenuItem,
  StateData,
  ViewItem,
  PageState,
  PreferencesData,
  WindowBounds,
  SqlShortcuts,
  ElfkShortcuts,
  MonitorDefaults,
  EsSearchPrefs,
  UiPrefs,
} from './types';
