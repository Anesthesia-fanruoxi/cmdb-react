/**
 * 使用状态存储
 * 文件：states.dat
 * 存储：标签页、路由、侧边栏状态（以用户名为 key）
 */

import { getStorageData, updateStorageData } from './core';
import type { StateData, MultiUserData, ViewItem } from './types';

const FILE = 'states.dat';

// 默认状态
const defaultState: StateData = {
  visitedViews: [],
  cachedViews: [],
  activeRoute: '/dashboard',
  sidebarCollapsed: false,
  pageStates: {},
  lastSnapshot: 0,
};

/**
 * 获取所有用户的状态数据
 */
function getAllStates(): MultiUserData<StateData> {
  return getStorageData<MultiUserData<StateData>>(FILE);
}

/**
 * 获取指定用户的状态
 */
export function getState(username: string): StateData {
  const all = getAllStates();
  return { ...defaultState, ...all[username] };
}

/**
 * 保存用户状态
 */
export async function saveState(username: string, state: StateData): Promise<void> {
  const all = getAllStates();
  all[username] = {
    ...state,
    lastSnapshot: Date.now(),
  };
  await updateStorageData(FILE, all);
}

/**
 * 更新用户状态（部分更新）
 */
export async function updateState(
  username: string,
  updates: Partial<StateData>
): Promise<void> {
  const current = getState(username);
  const newState = { ...current, ...updates, lastSnapshot: Date.now() };
  await saveState(username, newState);
}

/**
 * 获取已访问的视图
 */
export function getVisitedViews(username: string): ViewItem[] {
  return getState(username).visitedViews;
}

/**
 * 获取已缓存的视图
 */
export function getCachedViews(username: string): string[] {
  return getState(username).cachedViews;
}

/**
 * 获取当前激活路由
 */
export function getActiveRoute(username: string): string {
  return getState(username).activeRoute;
}

/**
 * 获取侧边栏折叠状态
 */
export function getSidebarCollapsed(username: string): boolean {
  return getState(username).sidebarCollapsed;
}

/**
 * 删除用户状态
 */
export async function removeState(username: string): Promise<void> {
  const all = getAllStates();
  delete all[username];
  await updateStorageData(FILE, all);
}
