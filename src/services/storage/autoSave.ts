/**
 * 自动保存兼容层
 *
 * 旧代码（menuStore / pageStateStore / userPrefsStore / Home）仍通过 markDirty() 触发保存，
 * 本模块将这些调用转发到新的 scheduler，按 SNAPSHOT 类型防抖 3 秒保存。
 *
 * 新的业务代码应直接使用各 Manager：
 *   - tabManager.saveTabs()       —— 标签页（立即保存）
 *   - snapshotManager.saveSnapshot() —— 页面快照（防抖 3s）
 *   - prefsManager.savePrefs()   —— 偏好设置（防抖 3s，写 preferences.dat）
 *   - routeManager.saveCurrentRoute() —— 路由（防抖 1s）
 *   - sidebarManager.saveSidebar() —— 侧边栏（防抖 1s）
 */

import { scheduler } from './scheduler';
import { SaveType } from './strategies';
import { useMenuStore } from '@/stores/menuStore';
import { usePageStateStore } from '@/stores/pageStateStore';
import { useUserPrefsStore } from '@/stores/userPrefsStore';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { UnlistenFn } from '@tauri-apps/api/event';

let isInitialized = false;
let isClosing = false;
let unlistenCloseRequested: UnlistenFn | null = null;

/**
 * 兼容旧的 markDirty() 接口
 * 将标签页 + 页面快照 + 侧边栏 + 偏好设置打包，通过 scheduler 防抖保存
 * 注意：新代码应直接使用对应的 Manager，而不是 markDirty()
 */
export function markDirty(): void {
  // 快照类（标签页、页面状态、路由、侧边栏）
  scheduler.schedule(SaveType.SNAPSHOT, () => {
    const menuState = useMenuStore.getState();
    const pageState = usePageStateStore.getState();

    const currentPath = window.location.pathname;
    const activeRoute = ['/login', '/force-two-factor', '/detached'].includes(currentPath)
      ? '/dashboard'
      : currentPath;

    return {
      visitedViews: menuState.visitedViews.map(v => ({
        path: v.path,
        name: v.name,
        title: v.title || v.meta?.title || '',
      })),
      cachedViews: menuState.cachedViews,
      sidebarCollapsed: menuState.collapsed,
      activeRoute,
      pageStates: pageState.pages as Record<string, unknown>,
    };
  });

  // 偏好类（独立写入 preferences.dat）
  scheduler.schedule(SaveType.PREFERENCE, () => {
    const prefs = useUserPrefsStore.getState();
    return {
      sqlShortcuts: prefs.sqlShortcuts,
      elfkShortcuts: prefs.elfkShortcuts,
      monitorDefaults: prefs.monitorDefaults,
      esSearchPrefs: prefs.esSearchPrefs,
      uiPrefs: prefs.uiPrefs,
    };
  });
}

/**
 * 强制立即保存所有待保存数据（窗口关闭 / 退出登录时使用）
 */
export async function forceSave(): Promise<void> {
  await scheduler.flushAll();
}

/**
 * 启动自动保存
 * 注册窗口关闭前的强制保存钩子
 */
export async function startAutoSave(): Promise<void> {
  if (isInitialized) return;
  isInitialized = true;

  // 窗口关闭前强制保存
  try {
    const appWindow = getCurrentWindow();
    unlistenCloseRequested = await appWindow.onCloseRequested(async (event) => {
      if (isClosing) return;
      isClosing = true;
      event.preventDefault();
      try {
        await forceSave();
      } catch (e) {
        console.warn('[AutoSave] 关闭前保存失败:', e);
      }
      try {
        await appWindow.destroy();
      } catch (e) {
        console.warn('[AutoSave] destroy 失败:', e);
        // destroy 失败时重置标志，允许重试
        isClosing = false;
      }
    });
  } catch (e) {
    console.warn('[AutoSave] 注册窗口关闭事件失败:', e);
  }
}

/**
 * 停止自动保存
 */
export function stopAutoSave(): void {
  if (!isInitialized) return;

  if (unlistenCloseRequested) {
    unlistenCloseRequested();
    unlistenCloseRequested = null;
  }

  scheduler.dispose();
  isInitialized = false;
  isClosing = false;
}
