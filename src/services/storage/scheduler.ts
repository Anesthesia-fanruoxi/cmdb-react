/**
 * 保存调度器
 * 职责：
 * 1. 管理多个独立的防抖定时器（每种 SaveType 一个）
 * 2. 根据策略决定保存时机（立即 / 防抖）
 * 3. 合并同一类型的多次变更（防抖期间只保存最后一次）
 * 4. 提供强制刷新接口（窗口关闭、退出登录时使用）
 *
 * 数据流：
 *   Manager 调用 scheduler.schedule(type, dataBuilder)
 *   → 根据策略立即执行或防抖延迟
 *   → executeSave() 构建数据
 *   → writeToStorage() 合并到内存缓存并异步写入文件
 */

import { SaveType, SaveStrategy, SAVE_CONFIG } from './strategies';
import { getStorageData, saveStorageDataAsync, flushStorageWrites } from './core';
import { useAuthStore } from '@/stores/authStore';
import { STATE_STORAGE_FILES, excludeSqlPageStates, markStateShardUpdated } from './stateShardStorage';
import type { PageState, StorageFile } from './types';

/** 数据构建函数，延迟执行以获取最新状态 */
type DataBuilder = () => Record<string, unknown>;

class SaveScheduler {
  /** 每个 SaveType 独立的防抖定时器 */
  private timers: Map<SaveType, number> = new Map();

  /** 待保存的数据构建函数（延迟执行，保证拿到最新状态） */
  private pendingBuilders: Map<SaveType, DataBuilder> = new Map();

  /** 防止并发保存的锁 */
  private saving: Set<SaveType> = new Set();

  /**
   * 调度保存任务
   * @param type    保存类型
   * @param builder 数据构建函数（延迟执行，获取最新状态）
   */
  schedule(type: SaveType, builder: DataBuilder): void {
    const config = SAVE_CONFIG[type];

    // 始终记录最新的构建函数
    this.pendingBuilders.set(type, builder);

    // 清除该类型的旧定时器
    const oldTimer = this.timers.get(type);
    if (oldTimer) {
      clearTimeout(oldTimer);
      this.timers.delete(type);
    }

    if (config.strategy === SaveStrategy.IMMEDIATE) {
      // 立即保存
      void this.executeSave(type);
    } else {
      // 防抖保存
      const timer = window.setTimeout(() => {
        this.timers.delete(type);
        void this.executeSave(type);
      }, config.debounceMs);
      this.timers.set(type, timer);
    }
  }

  /**
   * 执行保存（构建数据 → 写入存储）
   */
  private async executeSave(type: SaveType): Promise<void> {
    // 防止同一类型并发保存
    if (this.saving.has(type)) return;

    const { userName, token } = useAuthStore.getState();
    if (!userName || !token) return;

    const builder = this.pendingBuilders.get(type);
    if (!builder) return;

    this.saving.add(type);
    try {
      const buildStarted = performance.now();
      const data = builder();
      const buildMs = performance.now() - buildStarted;
      if (buildMs >= 8) {
        console.warn(`[StoragePerf] snapshot-builder ${type}`, {
          ms: Number(buildMs.toFixed(1)),
        });
      }

      const writeStarted = performance.now();
      this.writeToStorage(type, userName, data);
      const writeMs = performance.now() - writeStarted;
      if (writeMs >= 8) {
        console.warn(`[StoragePerf] snapshot-memory-merge ${type}`, {
          ms: Number(writeMs.toFixed(1)),
        });
      }
      this.pendingBuilders.delete(type);
    } catch (error) {
      console.error(`[Scheduler] ${type} 保存失败:`, error);
      // 失败时保留 builder，等待下次调度重试
    } finally {
      this.saving.delete(type);
    }
  }

  /**
   * 写入存储（合并到内存缓存 + 异步写文件）
   *
   * 关键：合并现有数据，避免不同类型之间互相覆盖
   * 例如：TAB 保存 visitedViews 时，不能丢失已有的 pageStates
   */
  private writeToStorage(
    type: SaveType,
    username: string,
    data: Record<string, unknown>,
  ): void {
    switch (type) {
      case SaveType.TAB:
      case SaveType.ROUTE:
      case SaveType.SIDEBAR:
        this.mergeUserShard(STATE_STORAGE_FILES.navigation, username, data);
        break;

      case SaveType.SNAPSHOT: {
        // 快照中的普通页面状态与当前路由分开写入，避免再次触碰完整 states.dat。
        if (data.pageStates && typeof data.pageStates === 'object') {
          const pageStates = excludeSqlPageStates(data.pageStates as Record<string, PageState>);
          const existing = getStorageData<Record<string, Record<string, unknown>>>(
            STATE_STORAGE_FILES.pageStates,
          );
          const existingUserState = existing[username] || {};
          saveStorageDataAsync(STATE_STORAGE_FILES.pageStates, {
            ...existing,
            [username]: {
              ...existingUserState,
              pageStates,
              lastSnapshot: Date.now(),
            },
          });
          markStateShardUpdated('pageStates');
        }

        if (typeof data.activeRoute === 'string') {
          this.mergeUserShard(
            STATE_STORAGE_FILES.navigation,
            username,
            { activeRoute: data.activeRoute },
          );
        }
        break;
      }
      case SaveType.PREFERENCE: {
        // 写入 preferences.dat
        const existingPrefs = getStorageData<Record<string, Record<string, unknown>>>('preferences.dat');
        const existingUserPrefs = existingPrefs[username] || {};

        const newPrefs = {
          ...existingUserPrefs,
          ...data,
        };

        saveStorageDataAsync('preferences.dat', {
          ...existingPrefs,
          [username]: newPrefs,
        });
        break;
      }
    }
  }

  /** 将同一用户的局部状态合并到指定分片，绝不读取旧的 states.dat。 */
  private mergeUserShard(
    file: StorageFile,
    username: string,
    data: Record<string, unknown>,
  ): void {
    const existing = getStorageData<Record<string, Record<string, unknown>>>(file);
    const existingUserState = existing[username] || {};

    saveStorageDataAsync(file, {
      ...existing,
      [username]: {
        ...existingUserState,
        ...data,
        lastSnapshot: Date.now(),
      },
    });
    markStateShardUpdated('navigation');
  }

  /**
   * 强制立即保存指定类型（清除防抖定时器，立即执行）
   */
  async flush(type: SaveType): Promise<void> {
    const timer = this.timers.get(type);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(type);
    }

    if (this.pendingBuilders.has(type)) {
      await this.executeSave(type);
    }
    await flushStorageWrites();
  }

  /**
   * 强制立即保存所有待保存数据（窗口关闭 / 退出登录时调用）
   */
  async flushAll(): Promise<void> {
    // 清除所有定时器
    for (const [, timer] of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // 依次保存所有待保存数据
    const types = Array.from(this.pendingBuilders.keys());
    for (const type of types) {
      await this.executeSave(type);
    }
    await flushStorageWrites();
  }

  /**
   * 清理所有资源（停止自动保存时调用）
   */
  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.pendingBuilders.clear();
  }
}

/** 单例导出 */
export const scheduler = new SaveScheduler();
