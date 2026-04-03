/**
 * 用户偏好设置管理
 * 适配新存储架构 - 不再使用 persist 中间件
 */

import { create } from 'zustand';
import { markDirty } from '@/services/storage/autoSave';

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
  duplicateLine: 'Ctrl-D',
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
  codeEditorFontSize: 16,
  sqlEditorHeight: 200,
  sqlEditorHeightPercent: 50,
  sqlSidebarWidth: 260,
  sqlRowHighlightColor: '#8b5cf6',
};

interface UserPrefsState {
  sqlShortcuts: SqlShortcuts;
  elfkShortcuts: ElfkShortcuts;
  monitorDefaults: MonitorDefaults;
  esSearchPrefs: EsSearchPrefs;
  uiPrefs: UiPrefs;
  _hasHydrated: boolean;

  setSqlShortcut: (key: keyof SqlShortcuts, value: string) => void;
  resetSqlShortcuts: () => void;
  setElfkShortcut: (key: keyof ElfkShortcuts, value: string) => void;
  resetElfkShortcuts: () => void;
  setMonitorDefault: (key: keyof MonitorDefaults, value: number | string) => void;
  addRecentSearch: (search: string) => void;
  clearRecentSearches: () => void;
  setUiPref: (key: keyof UiPrefs, value: boolean | number | string) => void;
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
  _hasHydrated: false,

  setSqlShortcut: (key, value) => {
    set((state) => ({
      sqlShortcuts: { ...state.sqlShortcuts, [key]: value },
    }));
    markDirty();
  },

  resetSqlShortcuts: () => {
    set({ sqlShortcuts: { ...DEFAULT_SQL_SHORTCUTS } });
    markDirty();
  },

  setElfkShortcut: (key, value) => {
    set((state) => ({
      elfkShortcuts: { ...state.elfkShortcuts, [key]: value },
    }));
    markDirty();
  },

  resetElfkShortcuts: () => {
    set({ elfkShortcuts: { ...DEFAULT_ELFK_SHORTCUTS } });
    markDirty();
  },

  setMonitorDefault: (key, value) => {
    set((state) => ({
      monitorDefaults: { ...state.monitorDefaults, [key]: value },
    }));
    markDirty();
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
    markDirty();
  },

  clearRecentSearches: () => {
    set((state) => ({
      esSearchPrefs: { ...state.esSearchPrefs, recentSearches: [] },
    }));
    markDirty();
  },

  setUiPref: (key: keyof UiPrefs, value: boolean | number | string) => {
    set((state) => ({
      uiPrefs: { ...state.uiPrefs, [key]: value },
    }));
    markDirty();
  },

  // 状态恢复
  restorePrefs: (prefs) => {
    set(() => ({
      sqlShortcuts: { ...DEFAULT_SQL_SHORTCUTS, ...prefs.sqlShortcuts },
      elfkShortcuts: { ...DEFAULT_ELFK_SHORTCUTS, ...prefs.elfkShortcuts },
      monitorDefaults: { ...DEFAULT_MONITOR, ...prefs.monitorDefaults },
      esSearchPrefs: { ...DEFAULT_ES_PREFS, ...prefs.esSearchPrefs },
      uiPrefs: { ...DEFAULT_UI_PREFS, ...prefs.uiPrefs },
      _hasHydrated: true,
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
  getPrefsForSave: (): Partial<UserPrefsState> => {
    const state: UserPrefsState = useUserPrefsStore.getState();
    return {
      sqlShortcuts: state.sqlShortcuts,
      elfkShortcuts: state.elfkShortcuts,
      monitorDefaults: state.monitorDefaults,
      esSearchPrefs: state.esSearchPrefs,
      uiPrefs: state.uiPrefs,
    };
  },
}));
