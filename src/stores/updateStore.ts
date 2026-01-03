/**
 * 应用更新状态管理
 */

import { create } from 'zustand';
import { checkUpdate, type VersionInfo } from '../services/updater';

interface UpdateState {
  // 是否有新版本
  hasUpdate: boolean;
  // 新版本信息
  versionInfo: VersionInfo | null;
  // 是否正在检查
  checking: boolean;
  // 上次检查时间
  lastCheckTime: number | null;
  
  // 操作
  setHasUpdate: (has: boolean, info?: VersionInfo | null) => void;
  checkForUpdate: () => Promise<void>;
  clearUpdate: () => void;
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  hasUpdate: false,
  versionInfo: null,
  checking: false,
  lastCheckTime: null,

  setHasUpdate: (has, info = null) => {
    set({ hasUpdate: has, versionInfo: info });
  },

  checkForUpdate: async () => {
    if (get().checking) return;
    set({ checking: true });
    
    try {
      const result = await checkUpdate();
      if (result) {
        set({ hasUpdate: true, versionInfo: result });
      }
    } catch {
      // 忽略错误
    } finally {
      set({ checking: false, lastCheckTime: Date.now() });
    }
  },

  clearUpdate: () => {
    set({ hasUpdate: false, versionInfo: null });
  },
}));
