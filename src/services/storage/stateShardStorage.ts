/**
 * Sharded storage under the states directory.
 *
 * New shards migrate only from states.dat and never read old SQL shard files.
 */

import {
  ensureStorageFileLoaded,
  getStorageData,
  saveStorageDataAsync,
  setStorageData,
  storePathExists,
} from './core';
import {
  isSqlMetadataMigrationCompleted,
  migrateSqlMetadataFromLegacyStates,
  resetSqlMetadataDir,
} from './sqlMetadataStorage';
import {
  isSqlSearchMigrationCompleted,
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

async function markStateMigrationCompleted(): Promise<void> {
  const current = getStateIndex();
  if (current.migrationCompleted) return;
  const now = Date.now();
  await setStorageData(
    STATE_STORAGE_FILES.index,
    asStorageRecord<StateIndexData>({
      schemaVersion: 1,
      migrationCompleted: true,
      legacySource: 'states.dat',
      files: {
        navigation: {
          file: STATE_STORAGE_FILES.navigation,
          version: 1,
          updatedAt: current.files.navigation?.updatedAt || now,
        },
        pageStates: {
          file: STATE_STORAGE_FILES.pageStates,
          version: 1,
          updatedAt: current.files.pageStates?.updatedAt || now,
        },
      },
      updatedAt: now,
    }),
  );
}

/**
 * Split ordinary state from states.dat and trigger SQL migrations.
 * states.dat is the only migration source for SQL data.
 *
 * 规则：只要 `states/` 目录已存在（已切割），就跳过解密 legacy states.dat。
 */
export async function migrateLegacyStates(options?: {
  hasStatesDir?: boolean;
}): Promise<void> {
  const hasStatesDir =
    options?.hasStatesDir ?? (await storePathExists('states'));

  // 已切割：不触碰 states.dat；补齐迁移标记后返回
  if (hasStatesDir) {
    await markStateMigrationCompleted();
    // 用空 legacy 走一遍：内部若未 completed 只会把标记写成 completed，不会抹掉已有分片索引
    await migrateSqlSearchFromLegacyStates({});
    await migrateSqlMetadataFromLegacyStates({});
    return;
  }

  const currentIndex = getStateIndex();
  const sqlSearchDone = isSqlSearchMigrationCompleted();
  const sqlMetaDone = isSqlMetadataMigrationCompleted();

  if (currentIndex.migrationCompleted && sqlSearchDone && sqlMetaDone) {
    return;
  }

  // 尚未切割：才解密巨大的 legacy states.dat
  await ensureStorageFileLoaded('states.dat');
  const legacy = getStorageData<MultiUserData<Partial<StateData>>>('states.dat');

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
    await markStateMigrationCompleted();
  }

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
