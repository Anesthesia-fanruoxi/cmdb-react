/**
 * 使用状态存储
 * 文件：states.dat
 * 存储：标签页、路由、侧边栏状态（以用户名为 key）
 */

import { getStorageData, saveStorageDataAsync } from './core';
import {
  STATE_STORAGE_FILES,
  excludeSqlPageStates,
  isStateShardStorageActive,
  markStateShardUpdated,
  type NavigationState,
  type PageStatesShard,
  type UserNavigationData,
  type UserPageStatesData,
} from './stateShardStorage';
import type { MultiUserData, StateData, ViewItem } from './types';

const LEGACY_FILE = 'states.dat';

const defaultState: StateData = {
  visitedViews: [],
  cachedViews: [],
  activeRoute: '/dashboard',
  sidebarCollapsed: false,
  pageStates: {},
  lastSnapshot: 0,
};

function getLegacyStates(): MultiUserData<Partial<StateData>> {
  return getStorageData<MultiUserData<Partial<StateData>>>(LEGACY_FILE);
}

function getNavigationStates(): UserNavigationData {
  return getStorageData<UserNavigationData>(STATE_STORAGE_FILES.navigation);
}

function getPageStates(): UserPageStatesData {
  return getStorageData<UserPageStatesData>(STATE_STORAGE_FILES.pageStates);
}

function saveUserShard(
  file: typeof STATE_STORAGE_FILES.navigation | typeof STATE_STORAGE_FILES.pageStates,
  shard: UserNavigationData | UserPageStatesData,
  username: string,
  value: NavigationState | PageStatesShard,
  shardKey: 'navigation' | 'pageStates',
): void {
  const next = {
    ...shard,
    [username]: value,
  } as Record<string, unknown>;
  saveStorageDataAsync(file, next);
  markStateShardUpdated(shardKey);
}

/**
 * 获取指定用户的状态
 */
export function getState(username: string): StateData {
  const legacy = getLegacyStates()[username] || {};
  if (!isStateShardStorageActive()) {
    return { ...defaultState, ...legacy };
  }

  const navigation = getNavigationStates()[username] || {};
  const pageState = getPageStates()[username];

  return {
    ...defaultState,
    ...navigation,
    pageStates: excludeSqlPageStates(pageState?.pageStates || {}),
    lastSnapshot: Math.max(
      navigation.lastSnapshot || 0,
      pageState?.lastSnapshot || 0,
      defaultState.lastSnapshot,
    ),
  };
}

/** 保存用户状态到分片文件，不再写入 states.dat */
export async function saveState(username: string, state: StateData): Promise<void> {
  const lastSnapshot = Date.now();
  const navigation: NavigationState = {
    visitedViews: state.visitedViews,
    cachedViews: state.cachedViews,
    activeRoute: state.activeRoute,
    sidebarCollapsed: state.sidebarCollapsed,
    lastSnapshot,
  };
  const pageStates: PageStatesShard = {
    pageStates: excludeSqlPageStates(state.pageStates || {}),
    lastSnapshot,
  };

  saveUserShard(
    STATE_STORAGE_FILES.navigation,
    getNavigationStates(),
    username,
    navigation,
    'navigation',
  );
  saveUserShard(
    STATE_STORAGE_FILES.pageStates,
    getPageStates(),
    username,
    pageStates,
    'pageStates',
  );
}

export async function updateState(
  username: string,
  updates: Partial<StateData>,
): Promise<void> {
  const current = getState(username);
  await saveState(username, { ...current, ...updates });
}

export function getVisitedViews(username: string): ViewItem[] {
  return getState(username).visitedViews;
}

export function getCachedViews(username: string): string[] {
  return getState(username).cachedViews;
}

export function getActiveRoute(username: string): string {
  return getState(username).activeRoute;
}

export function getSidebarCollapsed(username: string): boolean {
  return getState(username).sidebarCollapsed;
}

export async function removeState(username: string): Promise<void> {
  const navigation = getNavigationStates();
  const pageStates = getPageStates();

  delete navigation[username];
  delete pageStates[username];

  saveStorageDataAsync(STATE_STORAGE_FILES.navigation, navigation as Record<string, unknown>);
  saveStorageDataAsync(STATE_STORAGE_FILES.pageStates, pageStates as Record<string, unknown>);
  markStateShardUpdated('navigation');
  markStateShardUpdated('pageStates');
}
