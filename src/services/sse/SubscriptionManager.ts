/**
 * SSE 订阅管理器
 * 管理所有订阅的生命周期，处理消息分发
 */

import type {
  SubscriptionConfig,
  Subscription as SubscriptionInstance,
  SubscriptionState,
  SSEMessage,
  SubscribeRequest,
  UnsubscribeRequest,
  SubscriptionInfo,
} from './types';
import { getToken } from '../storage/tokenStorage';

/** 订阅条目（内部管理用） */
interface SubscriptionEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: SubscriptionConfig<any>;
  state: SubscriptionState;
  createdAt: number;
  msgCount: number;
}

export class SubscriptionManager {
  private subscriptions = new Map<string, SubscriptionEntry>();
  /** 已知的孤儿订阅 ID（后端仍在推但前端已 unsub），用于去重日志与限制重发 unsub */
  private orphanIds = new Set<string>();
  private getConnectionId: () => string | null;
  private getApiUrl: () => string;

  constructor(deps: { getConnectionId: () => string | null; getApiUrl: () => string }) {
    this.getConnectionId = deps.getConnectionId;
    this.getApiUrl = deps.getApiUrl;
  }

  /** 创建订阅 */
  subscribe<T>(config: SubscriptionConfig<T>): SubscriptionInstance<T> {
    // 新订阅覆盖同 ID 的孤儿记录
    this.orphanIds.delete(config.id);
    const entry: SubscriptionEntry = {
      config: config as SubscriptionConfig,
      state: 'pending',
      createdAt: Date.now(),
      msgCount: 0,
    };

    this.subscriptions.set(config.id, entry);

    // 发送订阅请求到服务端
    this.sendSubscribeRequest([config]);

    // 返回订阅控制对象
    return {
      id: config.id,
      channel: config.channel,
      params: config.params,
      state: entry.state,
      unsubscribe: () => this.unsubscribe(config.id),
      pause: () => this.pauseSubscription(config.id),
      resume: () => this.resumeSubscription(config.id),
    };
  }

  /** 取消订阅 */
  unsubscribe(subscriptionId: string): void {
    const entry = this.subscriptions.get(subscriptionId);
    if (!entry) return;

    entry.state = 'closed';
    this.subscriptions.delete(subscriptionId);

    // 通知服务端取消订阅
    this.sendUnsubscribeRequest([subscriptionId]);
  }

  /** 取消所有订阅 */
  unsubscribeAll(): void {
    const ids = Array.from(this.subscriptions.keys());
    this.subscriptions.clear();
    this.orphanIds.clear();
    if (ids.length > 0) {
      this.sendUnsubscribeRequest(ids);
    }
  }

  /** 暂停订阅 */
  private pauseSubscription(subscriptionId: string): void {
    const entry = this.subscriptions.get(subscriptionId);
    if (entry && entry.state === 'active') {
      entry.state = 'paused';
    }
  }

  /** 恢复订阅 */
  private resumeSubscription(subscriptionId: string): void {
    const entry = this.subscriptions.get(subscriptionId);
    if (entry && entry.state === 'paused') {
      entry.state = 'active';
    }
  }

  /** 处理服务端消息 */
  handleMessage(message: SSEMessage): void {
    // 特殊事件不处理
    if (message.event === 'connected' || message.event === 'heartbeat') return;

    // 如果有 subscription_id，路由到对应的订阅
    if (message.subscription_id) {
      const entry = this.subscriptions.get(message.subscription_id);
      if (!entry) {
        this.handleOrphanMessage(message.subscription_id);
        return;
      }

      // 暂停状态不处理数据
      if (entry.state === 'paused') {
        return;
      }

      this.dispatchMessage(entry, message);
      return;
    }

    // 如果没有 subscription_id，按 channel 匹配
    if (message.channel) {
      let matched = false;
      for (const [, entry] of this.subscriptions.entries()) {
        if (entry.config.channel === message.channel && entry.state === 'active') {
          this.dispatchMessage(entry, message);
          matched = true;
        }
      }
      if (!matched) {
        console.warn('[SSE Sub] ⚠️ channel无匹配订阅:', message.channel, '当前订阅:', [...this.subscriptions.entries()].map(([id, e]) => `${id}(${e.config.channel}/${e.state})`));
      }
    }
  }

  /** 孤儿订阅消息处理：同一 ID 只警告一次并补发 unsubscribe，避免后端持续推送刷屏 */
  private handleOrphanMessage(subscriptionId: string): void {
    if (this.orphanIds.has(subscriptionId)) return;
    this.orphanIds.add(subscriptionId);
    console.warn('[SSE Sub] ⚠️ 孤儿订阅，补发 unsubscribe:', subscriptionId);
    this.sendUnsubscribeRequest([subscriptionId]);
  }

  /** 分发消息到订阅回调 */
  private dispatchMessage(entry: SubscriptionEntry, message: SSEMessage): void {
    entry.msgCount++;
    switch (message.event) {
      case 'data':
        entry.state = 'active';
        entry.config.onData(message.data);
        break;
      case 'complete':
        entry.config.onComplete?.();
        this.subscriptions.delete(entry.config.id);
        break;
      case 'error':
        entry.state = 'error';
        entry.config.onError?.(
          new Error(message.error?.message || 'Unknown error')
        );
        break;
    }
  }

  /** 重新订阅所有 (重连后调用) */
  async resubscribeAll(): Promise<void> {
    const configs = Array.from(this.subscriptions.values()).map(e => e.config);
    if (configs.length > 0) {
      await this.sendSubscribeRequest(configs);
    }
  }

  /** 获取当前订阅数量 */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /** 获取订阅快照列表（供监控面板读取） */
  listSubscriptions(): SubscriptionInfo[] {
    return Array.from(this.subscriptions.entries()).map(([id, e]) => ({
      id,
      channel: e.config.channel,
      params: e.config.params,
      state: e.state,
      createdAt: e.createdAt,
      msgCount: e.msgCount,
    }));
  }

  /** 发送订阅请求 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async sendSubscribeRequest(configs: SubscriptionConfig<any>[]): Promise<void> {
    const connectionId = this.getConnectionId();
    if (!connectionId) return;

    try {
      const response = await fetch(`${this.getApiUrl()}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          connection_id: connectionId,
          subscriptions: configs.map(c => ({
            id: c.id,
            channel: c.channel,
            params: c.params,
          })),
        } satisfies SubscribeRequest),
      });

      if (response.ok) {
        // 更新订阅状态
        configs.forEach(c => {
          const entry = this.subscriptions.get(c.id);
          if (entry) {
            entry.state = 'active';
          }
        });
      }
    } catch (error) {
      console.error('[SSE Subscription] 订阅请求失败:', error);
    }
  }

  /** 发送取消订阅请求 */
  private async sendUnsubscribeRequest(subscriptionIds: string[]): Promise<void> {
    const connectionId = this.getConnectionId();
    if (!connectionId) return;

    try {
      await fetch(`${this.getApiUrl()}/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          connection_id: connectionId,
          subscription_ids: subscriptionIds,
        } satisfies UnsubscribeRequest),
      });
    } catch (error) {
      console.error('[SSE Subscription] 取消订阅请求失败:', error);
    }
  }
}
