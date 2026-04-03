/**
 * 自动保存服务
 * 类似 IDE 的保存策略：变更检测 + 防抖 + 定时 + 失焦 + 窗口关闭
 */

import { useAuthStore } from '@/stores/authStore';
import { useMenuStore } from '@/stores/menuStore';
import { usePageStateStore } from '@/stores/pageStateStore';
import { useUserPrefsStore } from '@/stores/userPrefsStore';
import { updateState } from './stateStorage';
import { updatePreferences } from './preferencesStorage';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { UnlistenFn } from '@tauri-apps/api/event';

// 配置
const DEBOUNCE_DELAY = 2000;  // 防抖延迟 2 秒
const INTERVAL_DELAY = 30000; // 定时保存 30 秒

// 状态
let isDirty = false;
let debounceTimer: number | null = null;
let intervalTimer: number | null = null;
let isInitialized = false;
let unlistenCloseRequested: UnlistenFn | null = null;

/**
 * 标记数据已变更
 */
export function markDirty(): void {
  isDirty = true;
  
  // 防抖保存：2 秒内无新变更则保存
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = window.setTimeout(() => {
    saveIfDirty();
  }, DEBOUNCE_DELAY);
}

/**
 * 执行保存（如果有变更）
 */
async function saveIfDirty(): Promise<void> {
  if (!isDirty) return;
  
  const { token, userName } = useAuthStore.getState();
  if (!token || !userName) return;
  
  try {
    const menuState = useMenuStore.getState();
    const pageState = usePageStateStore.getState();
    const userPrefs = useUserPrefsStore.getState();
    
    // 获取当前路由（排除登录页等）
    const currentPath = window.location.pathname;
    const activeRoute = ['/login', '/force-two-factor', '/detached'].includes(currentPath) 
      ? '/dashboard' 
      : currentPath;
    
    // 保存使用状态
    await updateState(userName, {
      visitedViews: menuState.visitedViews.map(v => ({
        path: v.path,
        name: v.name,
        title: v.title || v.meta?.title || '',
      })),
      cachedViews: menuState.cachedViews,
      sidebarCollapsed: menuState.collapsed,
      activeRoute,
      pageStates: pageState.pages as Record<string, import('./types').PageState>,
    });
    
    // 保存用户偏好
    await updatePreferences(userName, {
      sqlShortcuts: userPrefs.sqlShortcuts,
      elfkShortcuts: userPrefs.elfkShortcuts,
      monitorDefaults: userPrefs.monitorDefaults,
      esSearchPrefs: userPrefs.esSearchPrefs,
      uiPrefs: userPrefs.uiPrefs,
    });
    
    isDirty = false;
  } catch (e) {
    console.error('[AutoSave] 保存失败:', e);
  }
}

/**
 * 强制立即保存
 */
export async function forceSave(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  isDirty = true; // 强制标记
  await saveIfDirty();
}

/**
 * 窗口失焦处理
 */
function handleVisibilityChange(): void {
  if (document.hidden) {
    // 窗口失焦，立即保存
    saveIfDirty();
  }
}

/**
 * 启动自动保存
 */
export async function startAutoSave(): Promise<void> {
  if (isInitialized) return;
  isInitialized = true;
  
  // 定时保存
  intervalTimer = window.setInterval(() => {
    saveIfDirty();
  }, INTERVAL_DELAY);
  
  // 失焦保存
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Tauri 窗口关闭前保存
  try {
    const appWindow = getCurrentWindow();
    unlistenCloseRequested = await appWindow.onCloseRequested(async (event) => {
      if (isDirty) {
        event.preventDefault();
        await saveIfDirty();
        await appWindow.close();
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
  
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
  
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  
  // 取消 Tauri 窗口关闭监听
  if (unlistenCloseRequested) {
    unlistenCloseRequested();
    unlistenCloseRequested = null;
  }
  
  isInitialized = false;
}
