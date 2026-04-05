/**
 * 自动保存服务
 * 策略：变更检测 + 防抖 + 定时 + 失焦 + 窗口关闭
 * 
 * 性能优化：
 * - 保存操作全部 fire-and-forget，不阻塞主线程
 * - SQL 元数据不纳入自动保存（体积大，有独立保存时机）
 * - 定时间隔拉长到 60 秒，减少频率
 */

import { useAuthStore } from '@/stores/authStore';
import { useMenuStore } from '@/stores/menuStore';
import { usePageStateStore } from '@/stores/pageStateStore';
import { useUserPrefsStore } from '@/stores/userPrefsStore';
import { updateState, getState } from './stateStorage';
import { updatePreferences } from './preferencesStorage';
import { saveStorageDataAsync, getStorageData } from './core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { UnlistenFn } from '@tauri-apps/api/event';

const DEBOUNCE_DELAY = 3000;  // 防抖 3 秒
const INTERVAL_DELAY = 60000; // 定时 60 秒

let isDirty = false;
let isSaving = false;           // 防止并发保存
let debounceTimer: number | null = null;
let intervalTimer: number | null = null;
let isInitialized = false;
let unlistenCloseRequested: UnlistenFn | null = null;

/**
 * 执行保存（完全异步，不阻塞主线程）
 * 直接把序列化后的数据扔给 Rust 后台线程处理加密+写文件
 */
function saveIfDirty(): void {
  if (!isDirty || isSaving) return;

  const { token, userName } = useAuthStore.getState();
  if (!token || !userName) return;

  isDirty = false;
  isSaving = true;

  try {
    const menuState = useMenuStore.getState();
    const pageState = usePageStateStore.getState();
    const userPrefs = useUserPrefsStore.getState();

    const currentPath = window.location.pathname;
    const activeRoute = ['/login', '/force-two-factor', '/detached'].includes(currentPath)
      ? '/dashboard'
      : currentPath;

    // 构建 state 数据（保留已有的 sqlMetadata）
    const existingState = getStorageData<Record<string, unknown>>('states.dat');
    const existingUserState = (existingState[userName] as Record<string, unknown>) || {};

    const newState = {
      ...existingUserState,
      visitedViews: menuState.visitedViews.map(v => ({
        path: v.path, name: v.name,
        title: v.title || v.meta?.title || '',
      })),
      cachedViews: menuState.cachedViews,
      sidebarCollapsed: menuState.collapsed,
      activeRoute,
      pageStates: pageState.pages,
      lastSnapshot: Date.now(),
      // sqlMetadata 保留原有的，不覆盖
    };

    const newStates = { ...existingState, [userName]: newState };

    // 构建 preferences 数据
    const existingPrefs = getStorageData<Record<string, unknown>>('preferences.dat');
    const existingUserPrefs = (existingPrefs[userName] as Record<string, unknown>) || {};
    const newPrefs = {
      ...existingUserPrefs,
      sqlShortcuts: userPrefs.sqlShortcuts,
      elfkShortcuts: userPrefs.elfkShortcuts,
      monitorDefaults: userPrefs.monitorDefaults,
      esSearchPrefs: userPrefs.esSearchPrefs,
      uiPrefs: userPrefs.uiPrefs,
    };
    const newPreferences = { ...existingPrefs, [userName]: newPrefs };

    // 完全异步，不等待，Rust 后台线程处理
    saveStorageDataAsync('states.dat', newStates);
    saveStorageDataAsync('preferences.dat', newPreferences);
  } catch (e) {
    console.error('[AutoSave] 构建保存数据失败:', e);
    isDirty = true;
  } finally {
    isSaving = false;
  }
}

/**
 * 标记数据已变更，触发防抖保存
 */
export function markDirty(): void {
  isDirty = true;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    saveIfDirty();
  }, DEBOUNCE_DELAY);
}

/**
 * 强制立即保存（窗口关闭时使用，需要等待完成）
 */
export async function forceSave(): Promise<void> {
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }

  const { token, userName } = useAuthStore.getState();
  if (!token || !userName) return;

  try {
    const menuState = useMenuStore.getState();
    const pageState = usePageStateStore.getState();
    const userPrefs = useUserPrefsStore.getState();

    const currentPath = window.location.pathname;
    const activeRoute = ['/login', '/force-two-factor', '/detached'].includes(currentPath)
      ? '/dashboard' : currentPath;

    const existingState = getState(userName);

    await updateState(userName, {
      visitedViews: menuState.visitedViews.map(v => ({
        path: v.path, name: v.name,
        title: v.title || v.meta?.title || '',
      })),
      cachedViews: menuState.cachedViews,
      sidebarCollapsed: menuState.collapsed,
      activeRoute,
      pageStates: pageState.pages as Record<string, import('./types').PageState>,
      sqlMetadata: existingState.sqlMetadata,
    });

    await updatePreferences(userName, {
      sqlShortcuts: userPrefs.sqlShortcuts,
      elfkShortcuts: userPrefs.elfkShortcuts,
      monitorDefaults: userPrefs.monitorDefaults,
      esSearchPrefs: userPrefs.esSearchPrefs,
      uiPrefs: userPrefs.uiPrefs,
    });

    isDirty = false;
  } catch (e) {
    console.error('[AutoSave] 强制保存失败:', e);
  }
}

/**
 * 窗口失焦时保存
 */
function handleVisibilityChange(): void {
  if (document.hidden) {
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

  // 窗口关闭前强制保存
  try {
    const appWindow = getCurrentWindow();
    unlistenCloseRequested = await appWindow.onCloseRequested(async (event) => {
      if (isDirty) {
        event.preventDefault();
        await forceSave();
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

  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
  if (intervalTimer) { clearInterval(intervalTimer); intervalTimer = null; }

  document.removeEventListener('visibilitychange', handleVisibilityChange);

  if (unlistenCloseRequested) {
    unlistenCloseRequested();
    unlistenCloseRequested = null;
  }

  isInitialized = false;
}
