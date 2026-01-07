/**
 * 页面状态管理（快照功能）
 * 适配新存储架构 - 状态变化时自动保存
 */

import { create } from 'zustand';
import { markDirty } from '../services/storage';

/** 页面状态数据 */
interface PageState {
  scrollTop?: number;
  formData?: Record<string, unknown>;
  [key: string]: unknown;
}

/** SQL 页面状态 */
interface SqlPageState extends PageState {
  sqlContent?: string;
  selectedDb?: string;
  selectedTable?: string;
}

/** 所有页面状态 */
interface PageStates {
  'sql/query'?: SqlPageState;
  'sql/apply'?: SqlPageState;
  [pageKey: string]: PageState | undefined;
}

interface PageStateStore {
  pages: PageStates;
  lastRoute: string | null;
  lastSaveTime: number | null;
  _hasHydrated: boolean;

  setPageState: <T extends PageState>(pageKey: string, state: Partial<T>) => void;
  getPageState: <T extends PageState>(pageKey: string) => T | undefined;
  clearPageState: (pageKey: string) => void;
  clearAllPageStates: () => void;
  setLastRoute: (route: string) => void;
  restoreState: (state: { pages?: PageStates; lastRoute?: string | null }) => void;
  reset: () => void;
}

export const usePageStateStore = create<PageStateStore>()((set, get) => ({
  pages: {},
  lastRoute: null,
  lastSaveTime: null,
  _hasHydrated: false,

  setPageState: (pageKey, state) => {
    set((prev) => ({
      pages: {
        ...prev.pages,
        [pageKey]: {
          ...prev.pages[pageKey],
          ...state,
        },
      },
      lastSaveTime: Date.now(),
    }));
    markDirty();
  },

  getPageState: <T extends PageState>(pageKey: string) => {
    return get().pages[pageKey] as T | undefined;
  },

  clearPageState: (pageKey) => {
    set((prev) => {
      const { [pageKey]: _, ...rest } = prev.pages;
      return { pages: rest };
    });
    markDirty();
  },

  clearAllPageStates: () => {
    set({ pages: {}, lastRoute: null, lastSaveTime: null });
    markDirty();
  },

  setLastRoute: (route) => {
    set({ lastRoute: route });
  },

  // 状态恢复（由 authStore 调用）
  restoreState: (state) => {
    set({
      pages: state.pages || {},
      lastRoute: state.lastRoute || null,
      _hasHydrated: true,
    });
  },

  // 重置状态（登出时调用）
  reset: () => {
    set({
      pages: {},
      lastRoute: null,
      lastSaveTime: null,
      _hasHydrated: false,
    });
  },
}));
