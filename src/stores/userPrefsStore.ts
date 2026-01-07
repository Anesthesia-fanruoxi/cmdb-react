/**
 * 用户偏好设置管理
 * 适配新存储架构 - 不再使用 persist 中间件
 */

import { create } from 'zustand';

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

/** 默认值 */
const DEFAULT_SQL_SHORTCUTS: SqlShortcuts = {
  execute: 'Ctrl-Enter',
  format: 'Ctrl-Shift-F',
  comment: 'Ctrl-/',
  find: 'Ctrl-F',
  replace: 'Ctrl-H',
  newTab: 'Ctrl-T',
  history: 'Ctrl-Shift-H',
  saveShared: 'Ctrl-Shift-S',
};

const DEFAULT_ELFK_SHORTCUTS: ElfkShortcuts = {
  search: 'Ctrl-Enter',
  history: 'Ctrl-Shift-H',
  saveShared: 'Ctrl-S',
  newTab: 'Ctrl-T',
};

const DEFAULT_MONITOR: MonitorDefaults = {
  refreshInterval: 30,
  timeRange: '1h',
  chartType: 'line',
};

const DEFAULT_ES_PREFS: EsSearchPrefs = {
  recentSearches: [],
  maxRecentSearches: 20,
  defaultPageSize: 50,
};

const DEFAULT_UI_PREFS: UiPrefs = {
  sidebarCollapsed: false,
  tablePageSize: 20,
  codeEditorFontSize: 14,
  sqlEditorHeight: 200,
};

interface UserPrefsState {
  sqlShortcuts: SqlShortcuts;
  elfkShortcuts: ElfkShortcuts;
  monitorDefaults: MonitorDefaults;
  esSearchPrefs: EsSearchPrefs;
  uiPrefs: UiPrefs;

  setSqlShortcut: (key: keyof SqlShortcuts, value: string) => void;
  resetSqlShortcuts: () => void;
  setElfkShortcut: (key: keyof ElfkShortcuts, value: string) => void;
  resetElfkShortcuts: () => void;
  setMonitorDefault: (key: keyof MonitorDefaults, value: number | string) => void;
  addRecentSearch: (search: string) => void;
  clearRecentSearches: () => void;
  setUiPref: (key: keyof UiPrefs, value: boolean | number) => void;
  restorePrefs: (prefs: Partial<UserPrefsState>) => void;
  reset: () => void;
  getPrefsForSave: () => Partial<UserPrefsState>;
}

export const useUserPrefsStore = create<UserPrefsState>()((set) => ({
  sqlShortcuts: { ...DEFAULT_SQL_SHORTCUTS },
  elfkShortcuts: { ...DEFAULT_ELFK_SHORTCUTS },
  monitorDefaults: { ...DEFAULT_MONITOR },
  esSearchPrefs: { ...DEFAULT_ES_PREFS },
  uiPrefs: { ...DEFAULT_UI_PREFS },

  setSqlShortcut: (key, value) => {
    set((state) => ({
      sqlShortcuts: { ...state.sqlShortcuts, [key]: value },
    }));
  },

  resetSqlShortcuts: () => {
    set({ sqlShortcuts: { ...DEFAULT_SQL_SHORTCUTS } });
  },

  setElfkShortcut: (key, value) => {
    set((state) => ({
      elfkShortcuts: { ...state.elfkShortcuts, [key]: value },
    }));
  },

  resetElfkShortcuts: () => {
    set({ elfkShortcuts: { ...DEFAULT_ELFK_SHORTCUTS } });
  },

  setMonitorDefault: (key, value) => {
    set((state) => ({
      monitorDefaults: { ...state.monitorDefaults, [key]: value },
    }));
  },

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

  clearRecentSearches: () => {
    set((state) => ({
      esSearchPrefs: { ...state.esSearchPrefs, recentSearches: [] },
    }));
  },

  setUiPref: (key, value) => {
    set((state) => ({
      uiPrefs: { ...state.uiPrefs, [key]: value },
    }));
  },

  // 状态恢复
  restorePrefs: (prefs) => {
    set(() => ({
      sqlShortcuts: { ...DEFAULT_SQL_SHORTCUTS, ...prefs.sqlShortcuts },
      elfkShortcuts: { ...DEFAULT_ELFK_SHORTCUTS, ...prefs.elfkShortcuts },
      monitorDefaults: { ...DEFAULT_MONITOR, ...prefs.monitorDefaults },
      esSearchPrefs: { ...DEFAULT_ES_PREFS, ...prefs.esSearchPrefs },
      uiPrefs: { ...DEFAULT_UI_PREFS, ...prefs.uiPrefs },
    }));
  },

  // 重置为默认值（登出时调用）
  reset: () => {
    set({
      sqlShortcuts: { ...DEFAULT_SQL_SHORTCUTS },
      elfkShortcuts: { ...DEFAULT_ELFK_SHORTCUTS },
      monitorDefaults: { ...DEFAULT_MONITOR },
      esSearchPrefs: { ...DEFAULT_ES_PREFS },
      uiPrefs: { ...DEFAULT_UI_PREFS },
    });
  },

  // 获取需要保存的偏好数据
  getPrefsForSave: () => {
    const state = useUserPrefsStore.getState();
    return {
      sqlShortcuts: state.sqlShortcuts,
      elfkShortcuts: state.elfkShortcuts,
      monitorDefaults: state.monitorDefaults,
      esSearchPrefs: state.esSearchPrefs,
      uiPrefs: state.uiPrefs,
    };
  },
}));
