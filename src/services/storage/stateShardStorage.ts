/**
 * Sharded storage under the states directory.
 *
 * New shards migrate only from states.dat and never read old SQL shard files.
 */

import {
  getStorageData,
  saveStorageDataAsync,
  setStorageData,
} from './core';
import { migrateSqlMetadataFromLegacyStates, resetSqlMetadataDir } from './sqlMetadataStorage';
import {
  migrateSqlSearchFromLegacyStates,
  resetSqlSearchStorage,
} from './sqlSearchStorage';
import type { MultiUserData, PageState, StateData, StorageFile } from './types';

export const STATE_STORAGE_FILES = {
  index: 'states/index.dat',
  navigation: 'states/navigation.dat',
  pageStates: 'states/page-states.dat',
} as const satisfies Record<string, StorageFile>;

export type StateShardKey = keyof typeof STATE_STORAGE_FILES;
type WritableStateShardKey = Exclude<StateShardKey, 'index'>;

/** SQL 查询页状态由 sqlSearch/ 目录按 Tab 分片存储，不得写入 page-states.dat */
export const SQL_PAGE_STATE_KEYS = new Set(['sql/search', 'sql/detached-tabs']);

export function excludeSqlPageStates(
  pageStates: Record<string, PageState>,
): Record<string, PageState> {
  const result: Record<string, PageState> = {};
  for (const [key, value] of Object.entries(pageStates)) {
    if (!SQL_PAGE_STATE_KEYS.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

function sanitizeIndexFiles(
  files: Partial<Record<WritableStateShardKey, StateIndexEntry>>,
): Partial<Record<WritableStateShardKey, StateIndexEntry>> {
  const result: Partial<Record<WritableStateShardKey, StateIndexEntry>> = {};
  for (const key of ['navigation', 'pageStates'] as const) {
    const entry = files[key];
    if (entry) {
      result[key] = entry;
    }
  }
  return result;
}

export interface StateIndexEntry {
  file: StorageFile;
  version: number;
  updatedAt: number;
}

export interface StateIndexData {
  schemaVersion: 1;
  migrationCompleted: boolean;
  legacySource: 'states.dat';
  files: Partial<Record<WritableStateShardKey, StateIndexEntry>>;
  updatedAt: number;
}

export interface NavigationState {
  visitedViews?: StateData['visitedViews'];
  cachedViews?: StateData['cachedViews'];
  activeRoute?: StateData['activeRoute'];
  sidebarCollapsed?: StateData['sidebarCollapsed'];
  lastSnapshot?: number;
}

export interface PageStatesShard {
  pageStates: Record<string, PageState>;
  lastSnapshot?: number;
}

export type UserNavigationData = MultiUserData<NavigationState>;
export type UserPageStatesData = MultiUserData<PageStatesShard>;

const EMPTY_INDEX: StateIndexData = {
  schemaVersion: 1,
  migrationCompleted: false,
  legacySource: 'states.dat',
  files: {},
  updatedAt: 0,
};

function asRecord<T>(value: unknown): T {
  return (value && typeof value === 'object' ? value : {}) as T;
}

function asStorageRecord<T>(value: T): Record<string, unknown> {
  return value as unknown as Record<string, unknown>;
}

export function getStateIndex(): StateIndexData {
  const stored = getStorageData<Partial<StateIndexData>>(STATE_STORAGE_FILES.index);
  return {
    ...EMPTY_INDEX,
    ...stored,
    files: stored.files || {},
  };
}

export function isStateShardStorageActive(): boolean {
  return getStateIndex().migrationCompleted;
}

/** Mark a shard as updated during runtime. */
export function markStateShardUpdated(shard: WritableStateShardKey): void {
  const current = getStateIndex();
  const now = Date.now();
  const file = STATE_STORAGE_FILES[shard];
  const next: StateIndexData = {
    ...current,
    migrationCompleted: true,
    files: {
      ...sanitizeIndexFiles(current.files),
      [shard]: { file, version: 1, updatedAt: now },
    },
    updatedAt: now,
  };
  saveStorageDataAsync(STATE_STORAGE_FILES.index, asStorageRecord(next));
}

function splitLegacyPageStates(pageStates: Record<string, PageState>): Record<string, PageState> {
  return excludeSqlPageStates(pageStates);
}

/**
 * Split ordinary state from states.dat and trigger SQL migrations.
 * states.dat is the only migration source for SQL data.
 */
export async function migrateLegacyStates(): Promise<void> {
  const legacy = getStorageData<MultiUserData<Partial<StateData>>>('states.dat');
  const currentIndex = getStateIndex();

  if (!currentIndex.migrationCompleted) {
    const navigation: UserNavigationData = {};
    const pageStates: UserPageStatesData = {};

    for (const [username, legacyState] of Object.entries(legacy || {})) {
      const state = legacyState || {};
      navigation[username] = {
        visitedViews: state.visitedViews || [],
        cachedViews: state.cachedViews || [],
        activeRoute: state.activeRoute,
        sidebarCollapsed: state.sidebarCollapsed,
        lastSnapshot: state.lastSnapshot,
      };
      pageStates[username] = {
        pageStates: splitLegacyPageStates(asRecord<Record<string, PageState>>(state.pageStates)),
        lastSnapshot: state.lastSnapshot,
      };
    }

    await setStorageData(STATE_STORAGE_FILES.navigation, asStorageRecord(navigation));
    await setStorageData(STATE_STORAGE_FILES.pageStates, asStorageRecord(pageStates));

    const now = Date.now();
    await setStorageData(
      STATE_STORAGE_FILES.index,
      asStorageRecord<StateIndexData>({
        schemaVersion: 1,
        migrationCompleted: true,
        legacySource: 'states.dat',
        files: {
          navigation: { file: STATE_STORAGE_FILES.navigation, version: 1, updatedAt: now },
          pageStates: { file: STATE_STORAGE_FILES.pageStates, version: 1, updatedAt: now },
        },
        updatedAt: now,
      }),
    );
  }

  // SQL tabs and metadata are also migrated only from states.dat.
  await migrateSqlSearchFromLegacyStates(legacy);
  await migrateSqlMetadataFromLegacyStates(legacy);
}

/** Clear new shards without deleting states.dat. */
export async function resetStateShards(): Promise<void> {
  await setStorageData(STATE_STORAGE_FILES.navigation, {});
  await setStorageData(STATE_STORAGE_FILES.pageStates, {});
  await resetSqlSearchStorage();
  await resetSqlMetadataDir();

  const now = Date.now();
  await setStorageData(
    STATE_STORAGE_FILES.index,
    asStorageRecord<StateIndexData>({
      schemaVersion: 1,
      migrationCompleted: true,
      legacySource: 'states.dat',
      files: sanitizeIndexFiles({}),
      updatedAt: now,
    }),
  );
}
