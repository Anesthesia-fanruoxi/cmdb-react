/**
 * 路由状态管理器
 * 职责：
 * 1. 保存当前激活路由到 states.dat
 * 2. 防抖 1 秒保存（比快照更及时，但避免连续导航时频繁写入）
 */

import { scheduler } from './scheduler';
import { SaveType } from './strategies';

/**
 * 保存当前路由（防抖 1 秒）
 * 由路由切换时调用（Home/index.tsx 或 AuthGuard）
 */
export function saveCurrentRoute(route: string): void {
  scheduler.schedule(SaveType.ROUTE, () => ({
    activeRoute: route,
  }));
}

/**
 * 强制立即保存路由
 */
export async function flushRoute(): Promise<void> {
  await scheduler.flush(SaveType.ROUTE);
}
