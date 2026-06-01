/**
 * 菜单状态管理
 * 适配新存储架构 - 状态由 authStore 在初始化时恢复
 */

import { create } from 'zustand';
import type { MenuItem, TagView } from '../types/menu';
import { getUserMenus } from '../services/system/menu';
import { saveTabs } from '../services/storage/tabManager';
import { saveSidebar } from '../services/storage/sidebarManager';
import { usePageStateStore } from './pageStateStore';

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
  delLeftViews: (view: TagView) => void;
  delRightViews: (view: TagView) => void;
  addCachedView: (name: string) => void;
  delCachedView: (name: string) => void;
  reorderViews: (fromIndex: number, toIndex: number) => void;
  clearVisitedViews: () => void;

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
    saveSidebar();
  },

  setCollapsed: (collapsed) => {
    set({ collapsed });
    saveSidebar();
  },

  // 状态恢复
  restoreState: (state) => {
    set({
      visitedViews: state.visitedViews || [],
      cachedViews: state.cachedViews || [],
      collapsed: state.collapsed ?? false,
    });
  },

  // 清空 visitedViews（用于恢复状态时）
  clearVisitedViews: () => {
    set({ visitedViews: [] });
    saveTabs();
  },

  addVisitedView: (view) => {
    // 使用 get() 获取最新状态，避免闭包问题
    const currentViews = get().visitedViews;
    const normalizedPath = view.path === '/' ? '/dashboard' : view.path;
    
    // 检查是否已存在
    if (currentViews.some((v) => v.path === normalizedPath)) {
      return;
    }
    
    const normalizedView = { ...view, path: normalizedPath };
    set((state) => ({
      visitedViews: [...state.visitedViews, normalizedView],
    }));
    saveTabs();

    if (!view.meta?.noCache) {
      get().addCachedView(view.name);
    }
  },

  delVisitedView: (view) => {
    // 首页（affix）不可被关闭
    if (view.meta?.affix) return;
    
    set((state) => {
      const newViews = state.visitedViews.filter((v) => v.path !== view.path);
      return { visitedViews: newViews };
    });
    get().delCachedView(view.name);

    // 同步清除对应页面的快照状态
    const pageKey = view.path.replace(/^\//, '');
    usePageStateStore.getState().clearPageState(pageKey);

    saveTabs();
  },

  delOtherViews: (view) => {
    const remainingPaths = new Set([view.path]);
    set((state) => ({
      visitedViews: state.visitedViews.filter(
        (v) => {
          if (v.meta?.affix) {
            remainingPaths.add(v.path);
            return true;
          }
          return v.path === view.path;
        }
      ),
      cachedViews: view.meta?.noCache ? [] : [view.name],
    }));
    // 清除被关闭标签的 pageState
    const pageStore = usePageStateStore.getState();
    Object.keys(pageStore.pages).forEach(key => {
      if (!remainingPaths.has('/' + key)) {
        pageStore.clearPageState(key);
      }
    });
    saveTabs();
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
    // 关闭所有 → 清空所有 pageState
    usePageStateStore.getState().clearAllPageStates();
    saveTabs();
  },

  // 关闭左边所有标签（保留 affix 和 view 本身）
  delLeftViews: (view) => {
    const index = get().visitedViews.findIndex(v => v.path === view.path);
    if (index <= 0) return; // 已在最左或找不到

    const remainingPaths = new Set<string>();
    set((state) => {
      const kept = state.visitedViews.filter((v, i) => {
        if (i < index) {
          // 左边标签：保留 affix
          if (v.meta?.affix) {
            remainingPaths.add(v.path);
            return true;
          }
          return false;
        }
        remainingPaths.add(v.path);
        return true;
      });
      return {
        visitedViews: kept,
        cachedViews: state.cachedViews.filter(name =>
          kept.some(v => v.name === name)
        ),
      };
    });
    // 清除被关闭标签的 pageState
    const pageStore = usePageStateStore.getState();
    Object.keys(pageStore.pages).forEach(key => {
      if (!remainingPaths.has('/' + key)) {
        pageStore.clearPageState(key);
      }
    });
    saveTabs();
  },

  // 关闭右边所有标签（保留 affix 和 view 本身）
  delRightViews: (view) => {
    const index = get().visitedViews.findIndex(v => v.path === view.path);
    if (index === -1) return;

    const remainingPaths = new Set<string>();
    set((state) => {
      const kept = state.visitedViews.filter((v, i) => {
        if (i > index) {
          // 右边标签：保留 affix
          if (v.meta?.affix) {
            remainingPaths.add(v.path);
            return true;
          }
          return false;
        }
        remainingPaths.add(v.path);
        return true;
      });
      return {
        visitedViews: kept,
        cachedViews: state.cachedViews.filter(name =>
          kept.some(v => v.name === name)
        ),
      };
    });
    // 清除被关闭标签的 pageState
    const pageStore = usePageStateStore.getState();
    Object.keys(pageStore.pages).forEach(key => {
      if (!remainingPaths.has('/' + key)) {
        pageStore.clearPageState(key);
      }
    });
    saveTabs();
  },

  addCachedView: (name) => {
    set((state) => {
      if (state.cachedViews.includes(name)) return state;
      saveTabs();
      return { cachedViews: [...state.cachedViews, name] };
    });
  },

  delCachedView: (name) => {
    set((state) => ({
      cachedViews: state.cachedViews.filter((v) => v !== name),
    }));
    saveTabs();
  },

  reorderViews: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const views = [...state.visitedViews];
      const [moved] = views.splice(fromIndex, 1);
      views.splice(toIndex, 0, moved);
      return { visitedViews: views };
    });
    saveTabs();
  },
}));
