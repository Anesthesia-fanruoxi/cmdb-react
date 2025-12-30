/**
 * 菜单状态管理
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MenuItem, TagView } from '../types/menu';
import { getUserMenus } from '../services/system/menu';
import { encryptedStorage } from '../utils/persistStorage';

// 首页菜单配置（无子菜单，直接点击跳转）
const HOME_MENU: MenuItem = {
  path: '/dashboard',
  name: 'Dashboard',
  component: 'home/Dashboard',
  icon: 'Home',
  meta: {
    title: '首页',
    icon: 'Home',
    affix: true,
    noCache: true,
  },
};

interface MenuState {
  // 菜单列表
  menuList: MenuItem[] | null;
  // 菜单权限
  menuPermissions: Set<string>;
  // 已访问的标签页
  visitedViews: TagView[];
  // 缓存的视图
  cachedViews: string[];
  // 侧边栏折叠状态
  collapsed: boolean;

  // 操作
  fetchUserMenus: () => Promise<MenuItem[]>;
  setMenuList: (menus: MenuItem[]) => void;
  clearMenus: () => void;
  hasPermission: (permission: string) => boolean;
  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;
  rehydrate: () => Promise<void>;

  // 标签页操作
  addVisitedView: (view: TagView) => void;
  delVisitedView: (view: TagView) => void;
  delOtherViews: (view: TagView) => void;
  delAllViews: () => void;
  addCachedView: (name: string) => void;
  delCachedView: (name: string) => void;
}

export const useMenuStore = create<MenuState>()(
  persist(
    (set, get) => ({
      menuList: null,
      menuPermissions: new Set(),
      visitedViews: [],
      cachedViews: [],
      collapsed: false,

  // 获取用户菜单
  fetchUserMenus: async () => {
    try {
      // 检查是否在强制修改密码页面
      if (window.location.pathname === '/force-change-password') {
        const menus = [HOME_MENU];
        set({ menuList: menus });
        return menus;
      }

      const res = await getUserMenus();
      if (res.code === 200) {
        const backendMenus = Array.isArray(res.data) ? res.data : [];
        const menus = [HOME_MENU, ...backendMenus];
        
        // 提取权限
        const permissions = new Set<string>();
        const extractPermissions = (items: MenuItem[]) => {
          items.forEach((menu) => {
            if (menu.permission) {
              permissions.add(menu.permission);
              // :rw 权限同时包含 :r 和 :w
              if (menu.permission.endsWith(':rw')) {
                permissions.add(menu.permission.replace(':rw', ':r'));
                permissions.add(menu.permission.replace(':rw', ':w'));
              }
            }
            if (menu.children?.length) {
              extractPermissions(menu.children);
            }
          });
        };
        extractPermissions(backendMenus);

        set({
          menuList: menus,
          menuPermissions: permissions,
        });
        return menus;
      }
      return [];
    } catch (error) {
      console.error('获取用户菜单失败:', error);
      // 返回最小菜单
      const menus = [HOME_MENU];
      set({ menuList: menus });
      return menus;
    }
  },

  // 设置菜单列表
  setMenuList: (menus) => {
    set({ menuList: menus.length > 0 ? menus : null });
  },

  // 清除菜单数据
  clearMenus: () => {
    set({
      menuList: null,
      menuPermissions: new Set(),
      visitedViews: [],
      cachedViews: [],
    });
  },

  // 检查权限
  hasPermission: (permission) => {
    if (!permission) return true;
    return get().menuPermissions.has(permission);
  },

  // 切换折叠状态
  toggleCollapsed: () => {
    set((state) => ({ collapsed: !state.collapsed }));
  },

  // 设置折叠状态
  setCollapsed: (collapsed) => {
    set({ collapsed });
  },

  // 手动触发 rehydrate（登录后调用）
  rehydrate: async () => {
    const stored = await encryptedStorage.getItem('menu-state')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.state) {
          const { visitedViews, cachedViews, collapsed } = parsed.state
          set({
            visitedViews: visitedViews || [],
            cachedViews: cachedViews || [],
            collapsed: collapsed ?? false,
          })
          return
        }
      } catch (e) {
        console.error('[MenuStore] rehydrate 解析失败:', e)
      }
    }
  },

  // 添加已访问视图
  addVisitedView: (view) => {
    set((state) => {
      // 统一首页路径
      const normalizedPath = view.path === '/' ? '/dashboard' : view.path;
      const normalizedView = { ...view, path: normalizedPath };
      
      // 检查是否已存在
      if (state.visitedViews.some((v) => v.path === normalizedPath)) {
        return state;
      }
      return {
        visitedViews: [...state.visitedViews, normalizedView],
      };
    });

    // 如果不是 noCache，添加到缓存
    if (!view.meta?.noCache) {
      get().addCachedView(view.name);
    }
  },

  // 删除已访问视图
  delVisitedView: (view) => {
    set((state) => ({
      visitedViews: state.visitedViews.filter((v) => v.path !== view.path),
    }));
    get().delCachedView(view.name);
  },

  // 删除其他视图
  delOtherViews: (view) => {
    set((state) => ({
      visitedViews: state.visitedViews.filter(
        (v) => v.meta?.affix || v.path === view.path
      ),
      cachedViews: view.meta?.noCache ? [] : [view.name],
    }));
  },

  // 删除所有视图（只保留一个首页）
  delAllViews: () => {
    set(() => ({
      visitedViews: [{
        path: '/dashboard',
        name: 'Dashboard',
        title: '首页',
        meta: { title: '首页', affix: true, noCache: true },
      }],
      cachedViews: [],
    }));
  },

  // 添加缓存视图
  addCachedView: (name) => {
    set((state) => {
      if (state.cachedViews.includes(name)) {
        return state;
      }
      return {
        cachedViews: [...state.cachedViews, name],
      };
    });
  },

  // 删除缓存视图
  delCachedView: (name) => {
    set((state) => ({
      cachedViews: state.cachedViews.filter((v) => v !== name),
    }));
  },
    }),
    {
      name: 'menu-state',
      storage: createJSONStorage(() => encryptedStorage),
      partialize: (state) => ({
        visitedViews: state.visitedViews,
        cachedViews: state.cachedViews,
        collapsed: state.collapsed,
      }),
    }
  )
);
