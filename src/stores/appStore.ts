/**
 * 应用全局状态管理
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SystemSetting } from '../types/system';
import { getSystemSetting } from '../services/system';

type ThemeMode = 'light' | 'dark';

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

  // 操作
  setSystemInfo: (info: Partial<SystemSetting>) => void;
  fetchSystemInfo: () => Promise<void>;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  initTheme: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
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
        
        // 更新所有窗口标题栏主题
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke('set_window_theme', { dark: theme === 'dark' }).catch(() => {});
        }).catch(() => {});
      },

      // 切换主题
      toggleTheme: () => {
        const newTheme = get().theme === 'light' ? 'dark' : 'light';
        get().setTheme(newTheme);
      },

      // 初始化主题（从持久化状态恢复后调用）
      initTheme: () => {
        const theme = get().theme;
        // 更新 DOM
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        
        // 更新窗口标题栏主题
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke('set_window_theme', { dark: theme === 'dark' }).catch(() => {});
        }).catch(() => {});
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
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        theme: state.theme,
        systemName: state.systemName,
        systemShortName: state.systemShortName,
      }),
    }
  )
);
