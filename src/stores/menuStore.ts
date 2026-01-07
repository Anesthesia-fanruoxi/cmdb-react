/**
 * 菜单状态管理
 * 适配新存储架构 - 状态由 authStore 在初始化时恢复
 */

import { create } from 'zustand';
import type { MenuItem, TagView } from '../types/menu';
import { getUserMenus } from '../services/system/menu';
import { markDirty } from '../services/storage';

// 首页菜单配置
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
  menuList: MenuItem[] | null;
  menuPermissions: Set<string>;
  visitedViews: TagView[];
  cachedViews: string[];
  collapsed: boolean;

  // 操作
  fetchUserMenus: () => Promise<MenuItem[]>;
  setMenuList: (menus: MenuItem[]) => void;
  clearMenus: () => void;
  hasPermission: (permission: string) => boolean;
  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;

  // 标签页操作
  addVisitedView: (view: TagView) => void;
  delVisitedView: (view: TagView) => void;
  delOtherViews: (view: TagView) => void;
  delAllViews: () => void;
  addCachedView: (name: string) => void;
  delCachedView: (name: string) => void;
  reorderViews: (fromIndex: number, toIndex: number) => void;

  // 状态恢复（由 authStore 调用）
  restoreState: (state: { visitedViews?: TagView[]; cachedViews?: string[]; collapsed?: boolean }) => void;
}

export const useMenuStore = create<MenuState>()((set, get) => ({
  menuList: null,
  menuPermissions: new Set(),
  visitedViews: [],
  cachedViews: [],
  collapsed: false,

  // 获取用户菜单
  fetchUserMenus: async () => {
    try {
      if (window.location.pathname === '/force-change-password') {
        const menus = [HOME_MENU];
        set({ menuList: menus });
        return menus;
      }

      const res = await getUserMenus();
      if (res.code === 200) {
        const backendMenus = Array.isArray(res.data) ? res.data : [];
        const menus = [HOME_MENU, ...backendMenus];
        
        const permissions = new Set<string>();
        const extractPermissions = (items: MenuItem[]) => {
          items.forEach((menu) => {
            if (menu.permission) {
              permissions.add(menu.permission);
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

        set({ menuList: menus, menuPermissions: permissions });
        return menus;
      }
      return [];
    } catch (error) {
      console.error('获取用户菜单失败:', error);
      const menus = [HOME_MENU];
      set({ menuList: menus });
      return menus;
    }
  },

  setMenuList: (menus) => {
    set({ menuList: menus.length > 0 ? menus : null });
  },

  clearMenus: () => {
    set({
      menuList: null,
      menuPermissions: new Set(),
      visitedViews: [],
      cachedViews: [],
    });
  },

  hasPermission: (permission) => {
    if (!permission) return true;
    return get().menuPermissions.has(permission);
  },

  toggleCollapsed: () => {
    set((state) => ({ collapsed: !state.collapsed }));
    markDirty();
  },

  setCollapsed: (collapsed) => {
    set({ collapsed });
    markDirty();
  },

  // 状态恢复
  restoreState: (state) => {
    set({
      visitedViews: state.visitedViews || [],
      cachedViews: state.cachedViews || [],
      collapsed: state.collapsed ?? false,
    });
  },

  addVisitedView: (view) => {
    set((state) => {
      const normalizedPath = view.path === '/' ? '/dashboard' : view.path;
      const normalizedView = { ...view, path: normalizedPath };
      
      if (state.visitedViews.some((v) => v.path === normalizedPath)) {
        return state;
      }
      markDirty();
      return { visitedViews: [...state.visitedViews, normalizedView] };
    });

    if (!view.meta?.noCache) {
      get().addCachedView(view.name);
    }
  },

  delVisitedView: (view) => {
    set((state) => ({
      visitedViews: state.visitedViews.filter((v) => v.path !== view.path),
    }));
    get().delCachedView(view.name);
    markDirty();
  },

  delOtherViews: (view) => {
    set((state) => ({
      visitedViews: state.visitedViews.filter(
        (v) => v.meta?.affix || v.path === view.path
      ),
      cachedViews: view.meta?.noCache ? [] : [view.name],
    }));
    markDirty();
  },

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
    markDirty();
  },

  addCachedView: (name) => {
    set((state) => {
      if (state.cachedViews.includes(name)) return state;
      markDirty();
      return { cachedViews: [...state.cachedViews, name] };
    });
  },

  delCachedView: (name) => {
    set((state) => ({
      cachedViews: state.cachedViews.filter((v) => v !== name),
    }));
    markDirty();
  },

  reorderViews: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const views = [...state.visitedViews];
      const [moved] = views.splice(fromIndex, 1);
      views.splice(toIndex, 0, moved);
      return { visitedViews: views };
    });
    markDirty();
  },
}));
