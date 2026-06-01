/**
 * 标签页管理器
 * 职责：
 * 1. 管理 visitedViews 和 cachedViews 的持久化
 * 2. 立即保存（不防抖）—— 用户期望标签页操作实时生效
 * 3. 由 menuStore 内部调用，不直接修改 store 状态
 *
 * 注意：此模块只负责"保存到磁盘"，不修改内存状态
 * 内存状态仍由 menuStore 管理
 */

import { scheduler } from './scheduler';
import { SaveType } from './strategies';
import { useMenuStore } from '@/stores/menuStore';

/**
 * 构建当前标签页快照数据（供 scheduler 延迟执行）
 */
function buildTabData() {
  const menuState = useMenuStore.getState();
  return {
    visitedViews: menuState.visitedViews.map(v => ({
      path: v.path,
      name: v.name,
      title: v.title || v.meta?.title || '',
    })),
    cachedViews: menuState.cachedViews,
  };
}

/**
 * 保存标签页状态（立即写入 states.dat）
 * 由 menuStore 在 addVisitedView / delVisitedView 等操作后调用
 */
export function saveTabs(): void {
  scheduler.schedule(SaveType.TAB, buildTabData);
}

/**
 * 强制立即保存标签页（退出登录等场景）
 */
export async function flushTabs(): Promise<void> {
  await scheduler.flush(SaveType.TAB);
}
