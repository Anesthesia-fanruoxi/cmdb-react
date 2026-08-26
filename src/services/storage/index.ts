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
  removeStorageFile,
  flushStorageWrites,
} from './core';

// App 公共存储
export {
  getAppData,
  updateAppData,
  getDefaultTheme,
  setDefaultTheme,
  updateLastUpdateCheck,
  updateAppVersion,
  getInstallPath,
  setInstallPath,
  getUpdateInfo,
  saveUpdateInfo,
  clearUpdateInfo,
} from './appStorage';

// 登录历史由 Rust 后端管理，见 src/services/loginHistory.ts

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

// states/ 分片存储
export {
  createSqlTabId,
  getSqlSearchIndex,
  saveSqlSearchIndex,
  getSqlTabState,
  saveSqlTabState,
  deleteSqlTabState,
  getSqlSearchState,
  saveSqlSearchState,
  clearSqlSearchState,
} from './sqlSearchStorage';
export {
  resetStateShards,
} from './stateShardStorage';

// sqlMetadata/ 按项目分文件存储（resetSqlMetadataDir 为内部使用，由 resetStateShards 调用）
export {
  getSqlMetadata,
  saveSqlMetadata,
  clearSqlMetadata,
} from './sqlMetadataStorage';

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

// 自动保存（兼容层）
export {
  markDirty,
  forceSave,
  startAutoSave,
  stopAutoSave,
} from './autoSave';

// 保存调度器与策略
export { scheduler } from './scheduler';
export { SaveType, SaveStrategy, SAVE_CONFIG } from './strategies';
export type { SaveConfig } from './strategies';

// 各管理器
export { saveTabs, flushTabs } from './tabManager';
export { saveSnapshot, saveActiveRoute, flushSnapshot } from './snapshotManager';
export { savePrefs, flushPrefs } from './prefsManager';
export { saveCurrentRoute, flushRoute } from './routeManager';
export { saveSidebar, flushSidebar } from './sidebarManager';

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
