/**
 * 用户偏好设置管理
 * 存储用户的个性化配置，如快捷键、默认设置等
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { encryptedStorage } from '../utils/persistStorage';

/** SQL 编辑器快捷键配置 */
export interface SqlShortcuts {
  execute: string;        // 执行查询，默认 Ctrl+Enter
  format: string;         // 格式化 SQL，默认 Ctrl+Shift+F
  comment: string;        // 注释/取消注释，默认 Ctrl+/
  find: string;           // 查找，默认 Ctrl+F
  replace: string;        // 替换，默认 Ctrl+H
  newTab: string;         // 新建标签页，默认 Ctrl+T
  history: string;        // 历史记录，默认 Ctrl+Shift+H
}

/** 监控默认设置 */
export interface MonitorDefaults {
  refreshInterval: number;  // 刷新间隔（秒）
  timeRange: string;        // 默认时间范围
  chartType: string;        // 默认图表类型
}

/** ES 搜索设置 */
export interface EsSearchPrefs {
  recentSearches: string[];     // 最近搜索记录
  maxRecentSearches: number;    // 最大保存数量
  defaultPageSize: number;      // 默认分页大小
}

/** 界面偏好 */
export interface UiPrefs {
  sidebarCollapsed: boolean;    // 侧边栏是否折叠
  tablePageSize: number;        // 表格默认分页大小
  codeEditorFontSize: number;   // 代码编辑器字体大小
  sqlEditorHeight: number;      // SQL编辑器高度
}

/** 用户偏好设置状态 */
interface UserPrefsState {
  // SQL 快捷键
  sqlShortcuts: SqlShortcuts;
  
  // 监控设置
  monitorDefaults: MonitorDefaults;
  
  // ES 搜索
  esSearchPrefs: EsSearchPrefs;
  
  // 界面偏好
  uiPrefs: UiPrefs;
  
  // 登录历史
  loginHistory: string[];
  
  // hydration 状态
  _hasHydrated: boolean;
  
  // 操作方法
  setSqlShortcut: (key: keyof SqlShortcuts, value: string) => void;
  resetSqlShortcuts: () => void;
  setMonitorDefault: (key: keyof MonitorDefaults, value: number | string) => void;
  addRecentSearch: (search: string) => void;
  clearRecentSearches: () => void;
  setUiPref: (key: keyof UiPrefs, value: boolean | number) => void;
  addLoginHistory: (username: string) => void;
  setHasHydrated: (state: boolean) => void;
}

/** 默认 SQL 快捷键 */
const DEFAULT_SQL_SHORTCUTS: SqlShortcuts = {
  execute: 'Ctrl-Enter',
  format: 'Ctrl-Shift-F',
  comment: 'Ctrl-/',
  find: 'Ctrl-F',
  replace: 'Ctrl-H',
  newTab: 'Ctrl-T',
  history: 'Ctrl-Shift-H',
};

/** 默认监控设置 */
const DEFAULT_MONITOR: MonitorDefaults = {
  refreshInterval: 30,
  timeRange: '1h',
  chartType: 'line',
};

/** 默认 ES 搜索设置 */
const DEFAULT_ES_PREFS: EsSearchPrefs = {
  recentSearches: [],
  maxRecentSearches: 20,
  defaultPageSize: 50,
};

/** 默认界面偏好 */
const DEFAULT_UI_PREFS: UiPrefs = {
  sidebarCollapsed: false,
  tablePageSize: 20,
  codeEditorFontSize: 14,
  sqlEditorHeight: 200,
};

export const useUserPrefsStore = create<UserPrefsState>()(
  persist(
    (set, get) => ({
      sqlShortcuts: { ...DEFAULT_SQL_SHORTCUTS },
      monitorDefaults: { ...DEFAULT_MONITOR },
      esSearchPrefs: { ...DEFAULT_ES_PREFS },
      uiPrefs: { ...DEFAULT_UI_PREFS },
      loginHistory: [],
      _hasHydrated: false,

      // 设置单个 SQL 快捷键
      setSqlShortcut: (key, value) => {
        set((state) => ({
          sqlShortcuts: { ...state.sqlShortcuts, [key]: value },
        }));
      },

      // 重置 SQL 快捷键为默认值
      resetSqlShortcuts: () => {
        set({ sqlShortcuts: { ...DEFAULT_SQL_SHORTCUTS } });
      },

      // 设置监控默认值
      setMonitorDefault: (key, value) => {
        set((state) => ({
          monitorDefaults: { ...state.monitorDefaults, [key]: value },
        }));
      },

      // 添加最近搜索记录
      addRecentSearch: (search) => {
        set((state) => {
          const { recentSearches, maxRecentSearches } = state.esSearchPrefs;
          const filtered = recentSearches.filter((s) => s !== search);
          const updated = [search, ...filtered].slice(0, maxRecentSearches);
          return {
            esSearchPrefs: { ...state.esSearchPrefs, recentSearches: updated },
          };
        });
      },

      // 清除搜索历史
      clearRecentSearches: () => {
        set((state) => ({
          esSearchPrefs: { ...state.esSearchPrefs, recentSearches: [] },
        }));
      },

      // 设置界面偏好
      setUiPref: (key, value) => {
        set((state) => ({
          uiPrefs: { ...state.uiPrefs, [key]: value },
        }));
      },

      // 添加登录历史
      addLoginHistory: (username) => {
        set((state) => {
          const filtered = state.loginHistory.filter((u) => u !== username);
          return { loginHistory: [username, ...filtered].slice(0, 5) };
        });
      },

      setHasHydrated: (state) => {
        set({ _hasHydrated: state });
      },
    }),
    {
      name: 'user-prefs',
      storage: createJSONStorage(() => encryptedStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      // 合并旧数据与新默认值，确保新字段有默认值
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<UserPrefsState>;
        return {
          ...currentState,
          ...persisted,
          // 确保 sqlShortcuts 包含所有新字段
          sqlShortcuts: {
            ...DEFAULT_SQL_SHORTCUTS,
            ...(persisted.sqlShortcuts || {}),
          },
        };
      },
    }
  )
);
