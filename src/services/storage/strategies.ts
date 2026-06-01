/**
 * 保存策略配置
 * 定义不同状态类型的保存策略（立即保存 / 防抖保存）
 */

/**
 * 保存策略类型
 */
export enum SaveStrategy {
  /** 立即保存（不防抖） */
  IMMEDIATE = 'immediate',
  /** 防抖保存 */
  DEBOUNCE = 'debounce',
}

/**
 * 保存类型枚举
 */
export enum SaveType {
  /** 标签页操作 */
  TAB = 'tab',
  /** 页面状态快照 */
  SNAPSHOT = 'snapshot',
  /** 偏好设置 */
  PREFERENCE = 'preference',
  /** 路由状态 */
  ROUTE = 'route',
  /** 侧边栏状态 */
  SIDEBAR = 'sidebar',
}

/**
 * 单个保存类型的配置
 */
export interface SaveConfig {
  strategy: SaveStrategy;
  debounceMs: number;
  description: string;
}

/**
 * 各类型的保存策略配置
 */
export const SAVE_CONFIG: Record<SaveType, SaveConfig> = {
  [SaveType.TAB]: {
    strategy: SaveStrategy.IMMEDIATE,
    debounceMs: 0,
    description: '标签页操作，立即保存',
  },
  [SaveType.SNAPSHOT]: {
    strategy: SaveStrategy.DEBOUNCE,
    debounceMs: 3000,
    description: '页面状态快照，防抖 3 秒保存',
  },
  [SaveType.PREFERENCE]: {
    strategy: SaveStrategy.DEBOUNCE,
    debounceMs: 3000,
    description: '偏好设置，防抖 3 秒保存',
  },
  [SaveType.ROUTE]: {
    strategy: SaveStrategy.DEBOUNCE,
    debounceMs: 1000,
    description: '路由状态，防抖 1 秒保存',
  },
  [SaveType.SIDEBAR]: {
    strategy: SaveStrategy.DEBOUNCE,
    debounceMs: 1000,
    description: '侧边栏状态，防抖 1 秒保存',
  },
};
