/**
 * SQL query tab sharded storage.
 *
 * Layout:
 *   states/sqlSearch/index.dat       user-to-tabId index
 *   states/sqlSearch/<tabId>.dat     one SQL tab state
 *
 * Migration source is states.dat; the old states/sql-search.dat is never read.
 */

import {
  ensureStorageFileLoaded,
  getStorageData,
  isTauriEnv,
  removeStorageFile,
  saveStorageDataAsync,
  setStorageData,
} from './core';
import type { MultiUserData, StateData, StorageFile } from './types';

export const SQL_SEARCH_INDEX_FILE = 'states/sqlSearch/index.dat' as StorageFile;

export interface SqlSearchUserIndex {
  userName: string;
  tabIds: string[];
  activeTabId: string;
  detachedTabIds: string[];
  updatedAt: number;
}

export interface SqlSearchMigrationInfo {
  source: 'states.dat';
  status: 'pending' | 'writing' | 'completed';
  startedAt?: number;
  completedAt?: number;
}

export interface SqlSearchIndexData {
  schemaVersion: 1;
  source: 'states.dat';
  migration: SqlSearchMigrationInfo;
  users: Record<string, SqlSearchUserIndex>;
  updatedAt: number;
}

export interface SqlSearchTabState {
  tabId: string;
  name?: string;
  project?: string;
  dbName?: string;
  sqlQuery?: string;
  dbList?: string[];
  tableList?: string[];
  currentPage?: number;
  pageSize?: number;
  lastExecutedSql?: string;
  detached?: boolean;
  /** Keep the legacy ID for diagnostics; runtime uses the new tabId. */
  legacyId?: string;
  updatedAt: number;
  [key: string]: unknown;
}

const EMPTY_INDEX: SqlSearchIndexData = {
  schemaVersion: 1,
  source: 'states.dat',
  migration: { source: 'states.dat', status: 'pending' },
  users: {},
  updatedAt: 0,
};

function getSqlSearchTabFile(tabId: string): StorageFile {
  const safeTabId = tabId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `states/sqlSearch/${safeTabId}.dat` as StorageFile;
}

export function createSqlTabId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const random = Math.random().toString(16).slice(2);
  return `${Date.now().toString(16)}-${random}`;
}

function getIndexFromMemory(): SqlSearchIndexData {
  const stored = getStorageData<Partial<SqlSearchIndexData>>(SQL_SEARCH_INDEX_FILE);
  return {
    ...EMPTY_INDEX,
    ...stored,
    migration: {
      ...EMPTY_INDEX.migration,
      ...(stored.migration || {}),
      source: 'states.dat',
    },
    users: stored.users || {},
  };
}

export function getSqlSearchIndex(): SqlSearchIndexData {
  return getIndexFromMemory();
}

export function saveSqlSearchIndex(index: SqlSearchIndexData): void {
  if (!isTauriEnv()) return;
  saveStorageDataAsync(SQL_SEARCH_INDEX_FILE, index as unknown as Record<string, unknown>);
}

export function updateSqlSearchUser(
  username: string,
  updates: Partial<SqlSearchUserIndex>,
): SqlSearchUserIndex | undefined {
  if (!username) return undefined;

  const current = getIndexFromMemory();
  const now = Date.now();
  const existing = current.users[username] || {
    userName: username,
    tabIds: [],
    activeTabId: '',
    detachedTabIds: [],
    updatedAt: now,
  };
  const nextUser: SqlSearchUserIndex = {
    ...existing,
    ...updates,
    userName: username,
    tabIds: Array.from(new Set(updates.tabIds || existing.tabIds || [])),
    detachedTabIds: Array.from(new Set(updates.detachedTabIds || existing.detachedTabIds || [])),
    updatedAt: now,
  };

  saveSqlSearchIndex({
    ...current,
    users: { ...current.users, [username]: nextUser },
    updatedAt: now,
  });
  return nextUser;
}

export function getSqlTabState<T extends SqlSearchTabState = SqlSearchTabState>(
  tabId: string,
): T | undefined {
  if (!tabId) return undefined;
  const data = getStorageData<Partial<T>>(getSqlSearchTabFile(tabId));
  if (!data || typeof data !== 'object' || !data.tabId) return undefined;
  return data as T;
}

export function saveSqlTabState(
  tabId: string,
  state: Omit<SqlSearchTabState, 'tabId' | 'updatedAt'>,
): void {
  if (!isTauriEnv() || !tabId) return;
  const payload: SqlSearchTabState = {
    ...state,
    tabId,
    updatedAt: Date.now(),
  };
  saveStorageDataAsync(getSqlSearchTabFile(tabId), payload as unknown as Record<string, unknown>);
}

export async function deleteSqlTabState(tabId: string): Promise<void> {
  if (!tabId) return;
  await removeStorageFile(getSqlSearchTabFile(tabId));
}

export async function loadSqlSearchTabFiles(): Promise<void> {
  const index = getIndexFromMemory();
  const tabIds = new Set<string>();
  Object.values(index.users).forEach(user => {
    user.tabIds.forEach(tabId => tabIds.add(tabId));
    user.detachedTabIds.forEach(tabId => tabIds.add(tabId));
  });
  await Promise.all([...tabIds].map(tabId => ensureStorageFileLoaded(getSqlSearchTabFile(tabId))));
}

/** Create a deterministic UUID-shaped ID for a migrated legacy tab. */
function stableLegacyTabId(username: string, scope: string, legacyId: string, index: number): string {
  const input = `${username}:${scope}:${legacyId}:${index}`;
  let hash1 = 2166136261;
  let hash2 = 374761393;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    hash1 = Math.imul(hash1 ^ code, 16777619);
    hash2 = Math.imul(hash2 ^ code, 2246822519);
  }
  const hex = (value: number) => (value >>> 0).toString(16).padStart(8, '0');
  const raw = `${hex(hash1)}${hex(hash2)}${hex(hash1 ^ hash2)}${hex(hash2 ^ 0x9e3779b9)}`;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-8${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}

function getLegacyTabList(state: Partial<StateData>, key: string): Array<Record<string, unknown>> {
  const page = state.pageStates?.[key];
  if (!page || typeof page !== 'object') return [];
  const tabs = (page as { tabs?: unknown }).tabs;
  return Array.isArray(tabs)
    ? tabs.filter((tab): tab is Record<string, unknown> => Boolean(tab && typeof tab === 'object'))
    : [];
}

function buildMigratedTab(
  username: string,
  scope: 'main' | 'detached',
  legacyTab: Record<string, unknown>,
  index: number,
): SqlSearchTabState {
  const legacyId = String(legacyTab.id || index + 1);
  const tabId = stableLegacyTabId(username, scope, legacyId, index);
  return {
    tabId,
    legacyId,
    name: typeof legacyTab.name === 'string' ? legacyTab.name : `Query ${index + 1}`,
    project: typeof legacyTab.project === 'string' ? legacyTab.project : '',
    dbName: typeof legacyTab.dbName === 'string' ? legacyTab.dbName : '',
    sqlQuery: typeof legacyTab.sqlQuery === 'string' ? legacyTab.sqlQuery : '',
    dbList: Array.isArray(legacyTab.dbList) ? legacyTab.dbList as string[] : [],
    tableList: Array.isArray(legacyTab.tableList) ? legacyTab.tableList as string[] : [],
    currentPage: typeof legacyTab.currentPage === 'number' ? legacyTab.currentPage : 1,
    pageSize: typeof legacyTab.pageSize === 'number' ? legacyTab.pageSize : 50,
    lastExecutedSql: typeof legacyTab.lastExecutedSql === 'string' ? legacyTab.lastExecutedSql : '',
    detached: scope === 'detached',
    updatedAt: Date.now(),
  };
}

/** Migrate SQL tabs directly from states.dat. */
export async function migrateSqlSearchFromLegacyStates(
  legacy: MultiUserData<Partial<StateData>>,
): Promise<void> {
  const current = getIndexFromMemory();
  if (current.migration.status === 'completed') return;

  const startedAt = current.migration.startedAt || Date.now();
  await setStorageData(SQL_SEARCH_INDEX_FILE, {
    ...current,
    migration: { source: 'states.dat', status: 'writing', startedAt },
    updatedAt: Date.now(),
  } as unknown as Record<string, unknown>);

  const users = { ...current.users };
  for (const [username, state] of Object.entries(legacy || {})) {
    const mainTabs = getLegacyTabList(state || {}, 'sql/search');
    const detachedTabs = getLegacyTabList(state || {}, 'sql/detached-tabs');
    const idMap = new Map<string, string>();
    const tabIds: string[] = [];
    const detachedTabIds: string[] = [];

    for (const [index, tab] of mainTabs.entries()) {
      const payload = buildMigratedTab(username, 'main', tab, index);
      await setStorageData(
        getSqlSearchTabFile(payload.tabId),
        payload as unknown as Record<string, unknown>,
      );
      tabIds.push(payload.tabId);
      idMap.set(String(tab.id || index + 1), payload.tabId);
    }

    for (const [index, tab] of detachedTabs.entries()) {
      const payload = buildMigratedTab(username, 'detached', tab, index);
      await setStorageData(
        getSqlSearchTabFile(payload.tabId),
        payload as unknown as Record<string, unknown>,
      );
      tabIds.push(payload.tabId);
      detachedTabIds.push(payload.tabId);
      idMap.set(String(tab.id || index + 1), payload.tabId);
    }

    const legacyPage = state?.pageStates?.['sql/search'] as { activeTabId?: unknown } | undefined;
    const oldActiveId = typeof legacyPage?.activeTabId === 'string' ? legacyPage.activeTabId : '';
    const previous = users[username];
    users[username] = {
      userName: username,
      tabIds: Array.from(new Set([...(previous?.tabIds || []), ...tabIds])),
      activeTabId: idMap.get(oldActiveId) || previous?.activeTabId || tabIds[0] || '',
      detachedTabIds: Array.from(new Set([...(previous?.detachedTabIds || []), ...detachedTabIds])),
      updatedAt: Date.now(),
    };

    await setStorageData(SQL_SEARCH_INDEX_FILE, {
      schemaVersion: 1,
      source: 'states.dat',
      migration: { source: 'states.dat', status: 'writing', startedAt },
      users,
      updatedAt: Date.now(),
    } as unknown as Record<string, unknown>);
  }

  await setStorageData(SQL_SEARCH_INDEX_FILE, {
    schemaVersion: 1,
    source: 'states.dat',
    migration: { source: 'states.dat', status: 'completed', startedAt, completedAt: Date.now() },
    users,
    updatedAt: Date.now(),
  } as unknown as Record<string, unknown>);
}

export async function resetSqlSearchStorage(): Promise<void> {
  const index = getIndexFromMemory();
  const ids = new Set<string>();
  Object.values(index.users).forEach(user => {
    user.tabIds.forEach(tabId => ids.add(tabId));
    user.detachedTabIds.forEach(tabId => ids.add(tabId));
  });
  for (const tabId of ids) await deleteSqlTabState(tabId);
  await removeStorageFile(SQL_SEARCH_INDEX_FILE);
}

function getUserTabs(username: string, detached: boolean): SqlSearchTabState[] {
  const user = getIndexFromMemory().users[username];
  if (!user) return [];
  const ids = detached ? user.detachedTabIds : user.tabIds.filter(id => !user.detachedTabIds.includes(id));
  return ids.map(getSqlTabState).filter((tab): tab is SqlSearchTabState => Boolean(tab));
}

/** Compatibility wrapper for the old page-state API. */
export function getSqlSearchState<T>(username: string, key: string): T | undefined {
  if (!username) return undefined;
  const detached = key === 'sql/detached-tabs';
  const tabs = getUserTabs(username, detached);
  if (tabs.length === 0) return undefined;
  return { tabs } as T;
}

/** Compatibility wrapper: write each tab to its own file. */
export function saveSqlSearchState(username: string, key: string, value: unknown): void {
  if (!username || !value || typeof value !== 'object') return;
  const tabs = (value as { tabs?: Array<Partial<SqlSearchTabState>> }).tabs;
  if (!Array.isArray(tabs)) return;

  const detached = key === 'sql/detached-tabs';
  const index = getIndexFromMemory();
  const existing = index.users[username] || {
    userName: username,
    tabIds: [],
    activeTabId: '',
    detachedTabIds: [],
    updatedAt: Date.now(),
  };
  const nextIds = new Set(existing.tabIds);
  const nextDetachedIds = new Set(existing.detachedTabIds);

  tabs.forEach(tab => {
    const tabId = tab.tabId || (tab as { id?: string }).id || createSqlTabId();
    saveSqlTabState(tabId, { ...tab, detached });
    nextIds.add(tabId);
    if (detached) nextDetachedIds.add(tabId);
  });

  updateSqlSearchUser(username, {
    tabIds: [...nextIds],
    detachedTabIds: [...nextDetachedIds],
  });
}

export function clearSqlSearchState(username: string, key: string): void {
  if (!username) return;
  const index = getIndexFromMemory();
  const user = index.users[username];
  if (!user) return;

  const detached = key === 'sql/detached-tabs';
  const removeIds = detached
    ? user.detachedTabIds
    : user.tabIds.filter(id => !user.detachedTabIds.includes(id));
  const nextTabIds = user.tabIds.filter(id => !removeIds.includes(id));
  const nextDetachedIds = user.detachedTabIds.filter(id => !removeIds.includes(id));

  removeIds.forEach(tabId => { void deleteSqlTabState(tabId); });
  updateSqlSearchUser(username, {
    tabIds: nextTabIds,
    detachedTabIds: nextDetachedIds,
    activeTabId: removeIds.includes(user.activeTabId) ? (nextTabIds[0] || '') : user.activeTabId,
  });
}
