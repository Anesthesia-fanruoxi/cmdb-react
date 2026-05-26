/**
 * 应用全局状态管理
 * 适配新存储架构 - 主题由 authStore 在初始化时设置
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { SystemSetting } from '../types/system';
import { getSystemSetting } from '../services/system';
import { getDefaultTheme } from '../services/storage';

type ThemeMode = 'light' | 'dark';

interface UpdateInfo {
  version: string;
  changelog: string;
  msiPath: string;
}

interface AppState {
  // 系统信息
  systemName: string;
  systemShortName: string;
  systemLogo: string;
  faviconLogo: string;
  loginLogo: string;

  // 主题
  theme: ThemeMode;

  // 加载状态
  loading: boolean;
  isLoading: boolean;

  // 错误状态
  error: string | null;

  // 更新状态
  hasUpdate: boolean;
  updateInfo: UpdateInfo | null;
  updateModalOpen: boolean;

  // 操作
  setSystemInfo: (info: Partial<SystemSetting>) => void;
  fetchSystemInfo: () => Promise<void>;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  initTheme: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setUpdateInfo: (info: UpdateInfo | null) => void;
  clearUpdate: () => void;
  openUpdateModal: () => void;
  closeUpdateModal: () => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  // 初始状态
  systemName: 'CMDB',
  systemShortName: 'CMDB',
  systemLogo: '',
  faviconLogo: '',
  loginLogo: '',
  theme: 'light',
  loading: false,
  isLoading: false,
  error: null,
  hasUpdate: false,
  updateInfo: null,
  updateModalOpen: false,

  // 设置系统信息
  setSystemInfo: (info) => {
    set({
      systemName: info.system_name || get().systemName,
      systemShortName: info.system_short_name || get().systemShortName,
      systemLogo: info.system_logo || get().systemLogo,
      faviconLogo: info.favicon_logo || get().faviconLogo,
      loginLogo: info.login_logo || get().loginLogo,
    });

    // 更新浏览器标题
    if (info.system_name) {
      document.title = info.system_name;
    }

    // 更新 favicon
    if (info.favicon_logo) {
      let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        document.head.appendChild(link);
      }
      link.href = info.favicon_logo;
    }
  },

  // 获取系统信息
  fetchSystemInfo: async () => {
    try {
      const res = await getSystemSetting();
      if (res.code === 200) {
        get().setSystemInfo(res.data);
      }
    } catch (error) {
      console.error('获取系统设置失败:', error);
    }
  },

  // 设置主题
  setTheme: (theme) => {
    set({ theme });

    // 更新 DOM
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // 缓存主题到 localStorage，供 index.html 内联脚本在 bundle 加载前读取（消除白屏/主题闪烁）
    try { localStorage.setItem('cmdb-theme', theme); } catch { /* */ }

    // 更新窗口标题栏主题
    invoke('set_window_theme', { dark: theme === 'dark' }).catch(() => {});
  },

  // 切换主题
  toggleTheme: () => {
    const newTheme = get().theme === 'light' ? 'dark' : 'light';
    get().setTheme(newTheme);
    
    // 保存主题到用户偏好设置
    import('../stores/authStore').then(({ useAuthStore }) => {
      const userName = useAuthStore.getState().userName;
      if (userName) {
        // 已登录 - 保存到用户偏好
        import('../services/storage').then(({ updatePreferences }) => {
          updatePreferences(userName, { theme: newTheme }).catch(err => {
            console.error('保存用户主题失败:', err);
          });
        });
      } else {
        // 未登录 - 保存到公共配置
        import('../services/storage').then(({ setDefaultTheme }) => {
          setDefaultTheme(newTheme).catch(err => {
            console.error('保存默认主题失败:', err);
          });
        });
      }
    });
  },

  // 初始化主题（从存储读取）
  initTheme: () => {
    // 从公共存储读取默认主题
    const storedTheme = getDefaultTheme();
    set({ theme: storedTheme });
    
    if (storedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    invoke('set_window_theme', { dark: storedTheme === 'dark' }).catch(() => {});
  },

  // 设置加载状态
  setLoading: (loading) => {
    set({ loading, isLoading: loading });
  },

  // 设置错误
  setError: (error) => {
    set({ error });
  },

  // 清除错误
  clearError: () => {
    set({ error: null });
  },

  // 设置更新信息
  setUpdateInfo: (info) => {
    set({ hasUpdate: !!info, updateInfo: info });
  },

  // 清除更新状态
  clearUpdate: () => {
    set({ hasUpdate: false, updateInfo: null });
  },

  // 打开更新弹框
  openUpdateModal: () => {
    set({ updateModalOpen: true });
  },

  // 关闭更新弹框
  closeUpdateModal: () => {
    set({ updateModalOpen: false });
  },
}));
