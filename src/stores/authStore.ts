/**
 * 认证状态管理
 */

import { create } from 'zustand';
import type { UserInfo, LoginRequest } from '../types/auth';
import { login as loginApi, logout as logoutApi, getProfile } from '../services/auth';
import { 
  isTauriEnv, 
  autoLogin as rustAutoLogin, 
  bindDevice as rustBindDevice,
  unbindDevice as rustUnbindDevice,
  getHardwareFingerprint 
} from '../services/machine';
import {
  getToken,
  setToken,
  getUserInfo,
  setUserInfo,
  getUserId,
  setUserId,
  getUserName,
  setUserName,
  setLastLoginUsername,
  clearUserData,
  initStorage,
  setAvatar,
} from '../utils/storage';
import { useMenuStore } from './menuStore';

// API 基础地址
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface AuthState {
  // 状态
  token: string | null;
  user: UserInfo | null;
  userId: string | null;
  userName: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  permissions: Set<string>;
  machineId: string | null;

  // 操作
  login: (data: LoginRequest) => Promise<{ isDefaultPass?: boolean }>;
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
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  // 初始状态
  token: null,
  user: null,
  userId: null,
  userName: null,
  isAuthenticated: false,
  isInitialized: false,
  permissions: new Set<string>(),
  machineId: null,

  // 登录
  login: async (data) => {
    const res = await loginApi(data);
    if (res.code === 200 && res.data) {
      const { token, user_id, user_name, is_default_pass } = res.data;

      // 等待所有存储操作完成
      await setToken(token);
      if (user_id) await setUserId(user_id);
      if (user_name) await setUserName(user_name);
      await setLastLoginUsername(data.user_name);

      set({
        token,
        userId: user_id || null,
        userName: user_name || null,
        isAuthenticated: true,
      });

      // 返回是否需要强制修改密码
      return { isDefaultPass: is_default_pass };
    } else {
      throw new Error(res.message || '登录失败');
    }
  },

  // 自动登录（Rust 端完成所有逻辑，前端只传 API 地址和用户名）
  autoLogin: async (userName: string) => {
    if (!isTauriEnv()) return false;

    const version = import.meta.env.VITE_APP_VERSION || 'v0.0.1';
    
    try {
      const result = await rustAutoLogin(API_BASE, userName, version);
      
      if (result.success && result.token) {
        // 等待所有存储操作完成
        await setToken(result.token);
        if (result.user_id) await setUserId(result.user_id);
        if (result.user_name) await setUserName(result.user_name);

        set({
          token: result.token,
          userId: result.user_id || null,
          userName: result.user_name || null,
          isAuthenticated: true,
        });
        return true;
      }
      
      // 自动登录失败，抛出错误信息
      if (result.error) {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('自动登录失败:', error);
      throw error;
    }
    return false;
  },

  // 绑定设备（需要双因子验证）
  bindDevice: async (totpCode: string) => {
    if (!isTauriEnv()) {
      throw new Error('仅支持桌面客户端');
    }

    const { token, userName } = get();
    if (!token || !userName) {
      throw new Error('请先登录');
    }

    const version = import.meta.env.VITE_APP_VERSION || 'v0.0.1';
    await rustBindDevice(API_BASE, token, userName, totpCode, version);
  },

  // 解绑设备（需要双因子验证）
  unbindDevice: async (totpCode: string) => {
    if (!isTauriEnv()) {
      throw new Error('仅支持桌面客户端');
    }

    const { token, userName } = get();
    if (!token || !userName) {
      throw new Error('请先登录');
    }

    await rustUnbindDevice(API_BASE, token, userName, totpCode);
  },

  // 设置用户信息
  setUser: async (user) => {
    await setUserInfo(user);
    if (user.id) await setUserId(user.id);
    if (user.user_name) await setUserName(user.user_name);

    set({
      user,
      userId: user.id,
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
    try {
      await logoutApi();
    } catch (error) {
      console.error('登出请求失败:', error);
    }

    // 注意：退出登录时不清除设备凭证，保留用于下次自动登录
    // 只有用户主动解绑设备时才清除

    clearUserData();
    useMenuStore.getState().clearMenus();

    set({
      token: null,
      user: null,
      userId: null,
      userName: null,
      isAuthenticated: false,
      permissions: new Set(),
    });
  },

  // 从存储初始化
  initFromStorage: async () => {
    try {
      await initStorage();

      const token = getToken();
      const user = getUserInfo<UserInfo>();
      const userId = getUserId();
      const userName = getUserName();

      set({
        token: token || null,
        user,
        userId,
        userName,
        isAuthenticated: !!token,
        isInitialized: true,
      });

      if (user?.permissions) {
        get().setPermissions(user.permissions);
      }
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
        // 保存头像到本地存储
        if (res.data.avatar) {
          await setAvatar(res.data.avatar);
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
