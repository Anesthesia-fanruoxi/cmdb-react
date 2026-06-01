/**
 * 侧边栏管理器
 * 职责：
 * 1. 保存侧边栏折叠状态到 states.dat
 * 2. 防抖 1 秒保存
 * 3. 由 menuStore 的 toggleCollapsed / setCollapsed 调用
 */

import { scheduler } from './scheduler';
import { SaveType } from './strategies';
import { useMenuStore } from '@/stores/menuStore';

/**
 * 保存侧边栏折叠状态（防抖 1 秒）
 */
export function saveSidebar(): void {
  scheduler.schedule(SaveType.SIDEBAR, () => ({
    sidebarCollapsed: useMenuStore.getState().collapsed,
  }));
}

/**
 * 强制立即保存侧边栏状态
 */
export async function flushSidebar(): Promise<void> {
  await scheduler.flush(SaveType.SIDEBAR);
}
