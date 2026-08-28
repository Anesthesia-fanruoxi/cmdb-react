/**
 * SQL metadata sharded by project.
 *
 * states/sqlMetadata/index.dat       project index
 * states/sqlMetadata/<project>.dat      one project metadata file
 *
 * Migration source is states.dat; the old states/sql-metadata.dat is never read.
 */

import {
  ensureStorageFileLoaded,
  getStorageData,
  isTauriEnv,
  removeStorageFile,
  setStorageData,
} from './core';
import type { MultiUserData, SqlMetadataCache, StateData, StorageFile } from './types';

const METADATA_INDEX_FILE = 'states/sqlMetadata/index.dat' as StorageFile;

type ProjectSqlMetadata = SqlMetadataCache[string];

interface SqlMetadataIndex {
  schemaVersion: 1;
  source: 'states.dat';
  migrationStatus: 'pending' | 'completed';
  projects: string[];
  updatedAt: number;
}

function getProjectMetadataFile(projectName: string): StorageFile {
  const safe = projectName.replace(/[^a-zA-Z0-9_\-.]/g, '_');
  return `states/sqlMetadata/${safe}.dat`;
}

function getMetadataIndex(): SqlMetadataIndex {
  const stored = getStorageData<Partial<SqlMetadataIndex>>(METADATA_INDEX_FILE);
  return {
    schemaVersion: 1,
    source: 'states.dat',
    migrationStatus: stored.migrationStatus || 'pending',
    projects: Array.isArray(stored.projects) ? stored.projects : [],
    updatedAt: stored.updatedAt || 0,
  };
}

export function isSqlMetadataMigrationCompleted(): boolean {
  return getMetadataIndex().migrationStatus === 'completed';
}

async function saveMetadataIndex(index: SqlMetadataIndex): Promise<void> {
  await setStorageData(METADATA_INDEX_FILE, index as unknown as Record<string, unknown>);
}

async function addProjectToIndex(projectName: string): Promise<void> {
  if (!isTauriEnv()) return;
  await ensureStorageFileLoaded(METADATA_INDEX_FILE);
  const index = getMetadataIndex();
  if (index.projects.includes(projectName)) return;
  await saveMetadataIndex({
    ...index,
    projects: [...index.projects, projectName],
    updatedAt: Date.now(),
  });
}

async function removeProjectFromIndex(projectName: string): Promise<void> {
  if (!isTauriEnv()) return;
  await ensureStorageFileLoaded(METADATA_INDEX_FILE);
  const index = getMetadataIndex();
  if (!index.projects.includes(projectName)) return;
  await saveMetadataIndex({
    ...index,
    projects: index.projects.filter(name => name !== projectName),
    updatedAt: Date.now(),
  });
}

export async function loadSqlMetadataFiles(concurrency = 4): Promise<void> {
  await ensureStorageFileLoaded(METADATA_INDEX_FILE);
  const index = getMetadataIndex();
  const projects = index.projects;
  if (projects.length === 0) return;

  const limit = Math.max(1, Math.min(concurrency, projects.length));
  let cursor = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (cursor < projects.length) {
        const project = projects[cursor];
        cursor += 1;
        await ensureStorageFileLoaded(getProjectMetadataFile(project));
        await new Promise<void>((resolve) => {
          if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
          else setTimeout(resolve, 0);
        });
      }
    }),
  );
}

/** Migrate SQL metadata directly from states.dat. */
export async function migrateSqlMetadataFromLegacyStates(
  legacy: MultiUserData<Partial<StateData>>,
): Promise<void> {
  await ensureStorageFileLoaded(METADATA_INDEX_FILE);
  const current = getMetadataIndex();
  if (current.migrationStatus === 'completed') return;

  const latest = new Map<string, ProjectSqlMetadata>();
  for (const state of Object.values(legacy || {})) {
    const metadata = state?.sqlMetadata || {};
    for (const [project, entry] of Object.entries(metadata)) {
      const previous = latest.get(project);
      if (!previous || (entry.timestamp || 0) >= (previous.timestamp || 0)) {
        latest.set(project, entry);
      }
    }
  }

  const projects = new Set(current.projects);
  for (const [project, entry] of latest) {
    await setStorageData(
      getProjectMetadataFile(project),
      entry as unknown as Record<string, unknown>,
    );
    projects.add(project);
  }

  await saveMetadataIndex({
    ...current,
    migrationStatus: 'completed',
    projects: [...projects],
    updatedAt: Date.now(),
  });
}

export async function getSqlMetadata(projectName: string): Promise<ProjectSqlMetadata | null> {
  if (!projectName) return null;
  const file = getProjectMetadataFile(projectName);
  await ensureStorageFileLoaded(file);
  const data = getStorageData<ProjectSqlMetadata>(file);
  if (data && Array.isArray(data.databases)) return data;
  return null;
}

export async function saveSqlMetadata(
  projectName: string,
  metadata: Omit<ProjectSqlMetadata, 'timestamp' | 'version'>,
): Promise<void> {
  const payload: ProjectSqlMetadata = {
    ...metadata,
    timestamp: Date.now(),
    version: '1.1',
  };
  await setStorageData(
    getProjectMetadataFile(projectName),
    payload as unknown as Record<string, unknown>,
  );
  await addProjectToIndex(projectName);
}

export async function clearSqlMetadata(projectName: string): Promise<void> {
  await removeStorageFile(getProjectMetadataFile(projectName));
  await removeProjectFromIndex(projectName);
}

export async function resetSqlMetadataDir(): Promise<void> {
  await ensureStorageFileLoaded(METADATA_INDEX_FILE);
  const projects = getMetadataIndex().projects;
  for (const project of projects) {
    await removeStorageFile(getProjectMetadataFile(project));
  }
  await removeStorageFile(METADATA_INDEX_FILE);
}
