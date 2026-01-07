/**
 * 认证状态管理
 * 适配新存储架构
 */

import { create } from 'zustand';
import type { UserInfo, LoginRequest } from '@/types';
import { login as loginApi, logout as logoutApi, getProfile } from '@/services/auth';
import { 
  isTauriEnv, 
  autoLogin as rustAutoLogin, 
  bindDevice as rustBindDevice,
  unbindDevice as rustUnbindDevice,
  getHardwareFingerprint 
} from '@/services/machine';
import {
  initAllStorage,
  getToken,
  saveToken,
  removeToken,
  hasValidToken,
  getTokenUsername,
  addLoginHistory,
  getDefaultTheme,
  setDefaultTheme,
  saveProfile,
  getProfile as getStoredProfile,
  updateState,
  getState,
  updatePreferences,
  getPreferences,
  setUserAvatar,
  clearMemoryCache,
} from '@/services/storage';
import { hasDeviceCredentials } from '@/services/machine';
import { useMenuStore } from './menuStore';
import { useAppStore } from './appStore';
import { usePageStateStore } from './pageStateStore';
import { useUserPrefsStore } from './userPrefsStore';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// 内存中的 token（不保存登录状态时使用）
let memoryToken: string | null = null;

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  userName: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  permissions: Set<string>;
  machineId: string | null;
  saveLoginState: boolean;

  login: (data: LoginRequest, saveState?: boolean) => Promise<{ isDefaultPass?: boolean }>;
  autoLogin: (userName: string) => Promise<boolean>;
  bindDevice: (totpCode: string) => Promise<void>;
  unbindDevice: (totpCode: string) => Promise<void>;
  setUser: (user: UserInfo) => Promise<void>;
  setPermissions: (permissions: string[]) => void;
  hasPermission: (permission: string) => boolean;
  logout: () => Promise<void>;
  initFromStorage: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  fetchMachineId: () => Promise<string | null>;
  setSaveLoginState: (save: boolean) => void;
  checkCredentials: (username: string) => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  // 初始状态
  token: null,
  user: null,
  userName: null,
  isAuthenticated: false,
  isInitialized: false,
  permissions: new Set<string>(),
  machineId: null,
  saveLoginState: true,

  // 设置是否保存登录状态
  setSaveLoginState: (save) => {
    set({ saveLoginState: save });
  },

  // 检查用户是否有设备凭据（调用 Rust 端）
  checkCredentials: async (username) => {
    if (!isTauriEnv()) return false;
    return await hasDeviceCredentials(username);
  },

  // 登录
  login: async (data, saveState = true) => {
    const res = await loginApi(data);
    if (res.code === 200 && res.data) {
      const { token, user_name, is_default_pass } = res.data;
      const userName = user_name || data.user_name;

      // 根据是否保存登录状态决定存储方式
      if (saveState && get().saveLoginState) {
        await saveToken(token, userName);
      } else {
        memoryToken = token;
      }

      // 更新登录历史
      await addLoginHistory(userName);

      set({
        token,
        userName,
        isAuthenticated: true,
      });

      return { isDefaultPass: is_default_pass };
    } else {
      throw new Error(res.message || '登录失败');
    }
  },

  // 自动登录
  autoLogin: async (userName: string) => {
    if (!isTauriEnv()) return false;

    const version = import.meta.env.VITE_APP_VERSION || 'v0.0.1';
    
    try {
      const result = await rustAutoLogin(API_BASE, userName, version);
      
      if (result.success && result.token) {
        // 自动登录默认保存状态
        await saveToken(result.token, userName);
        await addLoginHistory(userName);

        set({
          token: result.token,
          userName: result.user_name || userName,
          isAuthenticated: true,
        });
        return true;
      }
      
      if (result.error) {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('自动登录失败:', error);
      throw error;
    }
    return false;
  },

  // 绑定设备
  bindDevice: async (totpCode: string) => {
    if (!isTauriEnv()) {
      throw new Error('仅支持桌面客户端');
    }

    const { token, userName } = get();
    if (!token || !userName) {
      throw new Error('请先登录');
    }

    const version = import.meta.env.VITE_APP_VERSION || 'v0.0.1';
    // 设备凭据由 Rust 端管理
    await rustBindDevice(API_BASE, token, userName, totpCode, version);
  },

  // 解绑设备
  unbindDevice: async (totpCode: string) => {
    if (!isTauriEnv()) {
      throw new Error('仅支持桌面客户端');
    }

    const { token, userName } = get();
    if (!token || !userName) {
      throw new Error('请先登录');
    }

    // 设备凭据由 Rust 端管理
    await rustUnbindDevice(API_BASE, token, userName, totpCode);
  },

  // 设置用户信息
  setUser: async (user) => {
    const userName = get().userName || user.user_name;
    
    // 保存到存储
    await saveProfile(userName, {
      userInfo: user,
      permissions: user.permissions || [],
      menus: [],
      roleId: typeof user.role_id === 'string' ? parseInt(user.role_id, 10) || 0 : (user.role_id || 0),
      roleName: user.role?.name || '',
    });

    set({
      user,
      userName: user.user_name,
    });

    if (user.permissions) {
      get().setPermissions(user.permissions);
    }
  },

  // 设置权限
  setPermissions: (permissions) => {
    const permSet = new Set<string>();
    permissions.forEach((perm) => {
      permSet.add(perm);
      if (perm.endsWith(':rw')) {
        permSet.add(perm.replace(':rw', ':r'));
        permSet.add(perm.replace(':rw', ':w'));
      }
    });
    set({ permissions: permSet });
  },

  // 检查权限
  hasPermission: (permission) => {
    if (!permission) return true;
    return get().permissions.has(permission);
  },

  // 登出
  logout: async () => {
    const { userName } = get();

    // 保存当前状态
    if (userName) {
      const menuStore = useMenuStore.getState();
      const userPrefsStore = useUserPrefsStore.getState();
      
      await updateState(userName, {
        visitedViews: menuStore.visitedViews.map(v => ({
          path: v.path,
          name: v.name,
          title: v.title || v.meta?.title || '',
        })),
        cachedViews: menuStore.cachedViews,
        sidebarCollapsed: menuStore.collapsed,
      });

      // 保存主题和用户偏好到存储
      const theme = useAppStore.getState().theme;
      await updatePreferences(userName, {
        theme,
        ...userPrefsStore.getPrefsForSave(),
      });
      await setDefaultTheme(theme);
    }

    // 调用登出接口
    try {
      await logoutApi();
    } catch (error) {
      console.error('登出请求失败:', error);
    }

    // 删除 token
    await removeToken();
    memoryToken = null;

    // 清除菜单
    useMenuStore.getState().clearMenus();

    // 清除页面状态
    usePageStateStore.getState().reset();

    // 清除用户偏好（重置为默认值）
    useUserPrefsStore.getState().reset();

    // 清除内存缓存
    clearMemoryCache();

    // 重置状态
    set({
      token: null,
      user: null,
      userName: null,
      isAuthenticated: false,
      permissions: new Set(),
    });
  },

  // 从存储初始化
  initFromStorage: async () => {
    try {
      // 初始化所有存储
      await initAllStorage();

      // 检查是否有有效 token（文件存储或内存）
      const hasFileToken = hasValidToken();
      const hasMemToken = !!memoryToken;

      if (hasFileToken || hasMemToken) {
        const token = hasFileToken ? getToken() : memoryToken;
        const userName = hasFileToken ? getTokenUsername() : null;

        if (token && userName) {
          // 加载用户数据
          const profile = getStoredProfile(userName);
          const state = getState(userName);
          const prefs = getPreferences(userName);

          set({
            token,
            userName,
            user: profile?.userInfo || null,
            isAuthenticated: true,
            isInitialized: true,
          });

          if (profile?.permissions) {
            get().setPermissions(profile.permissions);
          }

          // 恢复主题
          if (prefs?.theme) {
            useAppStore.getState().setTheme(prefs.theme);
          }

          // 恢复用户偏好设置
          if (prefs) {
            useUserPrefsStore.getState().restorePrefs({
              sqlShortcuts: prefs.sqlShortcuts,
              elfkShortcuts: prefs.elfkShortcuts,
              monitorDefaults: prefs.monitorDefaults,
              esSearchPrefs: prefs.esSearchPrefs,
              uiPrefs: prefs.uiPrefs,
            });
          }

          // 恢复菜单状态
          if (state) {
            const menuStore = useMenuStore.getState();
            if (state.visitedViews?.length) {
              state.visitedViews.forEach(v => {
                menuStore.addVisitedView({
                  path: v.path,
                  name: v.name,
                  title: v.title,
                  meta: { title: v.title },
                });
              });
            }
            if (state.sidebarCollapsed !== undefined) {
              menuStore.setCollapsed(state.sidebarCollapsed);
            }
            
            // 恢复页面状态（表单数据等）
            if (state.pageStates) {
              const { usePageStateStore } = await import('./pageStateStore');
              usePageStateStore.getState().restoreState({
                pages: state.pageStates,
                lastRoute: state.activeRoute,
              });
            }
          }

          return;
        }
      }

      // 无有效 token，使用默认主题
      const defaultTheme = getDefaultTheme();
      useAppStore.getState().setTheme(defaultTheme);

      set({ isInitialized: true });
    } catch (error) {
      console.error('初始化存储失败:', error);
      set({ isInitialized: true });
    }
  },

  // 获取用户 profile
  fetchProfile: async () => {
    try {
      const res = await getProfile();
      if (res.code === 200 && res.data) {
        await get().setUser(res.data);
        
        // 保存头像
        if (res.data.avatar && get().userName) {
          await setUserAvatar(get().userName!, res.data.avatar);
        }
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  },

  // 获取机器码
  fetchMachineId: async () => {
    if (!isTauriEnv()) return null;
    try {
      const machineId = await getHardwareFingerprint();
      set({ machineId });
      return machineId;
    } catch (error) {
      console.error('获取机器码失败:', error);
      return null;
    }
  },
}));
