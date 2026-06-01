/**
 * 页面快照管理器
 * 职责：
 * 1. 管理 pageStates（表单数据、滚动位置等）的持久化
 * 2. 管理 activeRoute（当前路由）的持久化
 * 3. 防抖 3 秒保存，避免频繁写入
 * 4. 由 pageStateStore / 路由切换处调用
 */

import { scheduler } from './scheduler';
import { SaveType } from './strategies';
import { usePageStateStore } from '@/stores/pageStateStore';
import { useMenuStore } from '@/stores/menuStore';

/**
 * 仅保留当前 visitedViews 中还存在的 pageState。
 * 快照只为已打开的标签服务，不会为已关闭的标签创建状态。
 * pageState key 约定为 path 去掉首个 '/'，如 /sql/search -> 'sql/search'。
 */
function filterPagesByVisitedViews(
  pages: Record<string, unknown>
): Record<string, unknown> {
  const visitedPaths = new Set(
    useMenuStore.getState().visitedViews.map((v) => v.path.replace(/^\//, ''))
  );
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(pages)) {
    if (visitedPaths.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * 保存页面快照（防抖 3 秒）
 * 由 pageStateStore 在 setPageState / clearPageState 后调用
 */
export function saveSnapshot(): void {
  scheduler.schedule(SaveType.SNAPSHOT, () => {
    const pageState = usePageStateStore.getState();
    const currentPath = window.location.pathname;
    const activeRoute = ['/login', '/force-two-factor', '/detached'].includes(currentPath)
      ? '/dashboard'
      : currentPath;

    const filteredPages = filterPagesByVisitedViews(
      pageState.pages as Record<string, unknown>
    );
    return {
      pageStates: filteredPages,
      activeRoute,
    };
  });
}

/**
 * 保存当前路由（防抖，归入 SNAPSHOT 类型）
 */
export function saveActiveRoute(route: string): void {
  scheduler.schedule(SaveType.SNAPSHOT, () => {
    const pageState = usePageStateStore.getState();
    const filteredPages = filterPagesByVisitedViews(
      pageState.pages as Record<string, unknown>
    );
    return {
      activeRoute: route,
      pageStates: filteredPages,
    };
  });
}

/**
 * 强制立即保存快照（退出登录等场景）
 */
export async function flushSnapshot(): Promise<void> {
  await scheduler.flush(SaveType.SNAPSHOT);
}
