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
} from './types';
import { getToken } from '../storage/tokenStorage';

/** 订阅条目（内部管理用） */
interface SubscriptionEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: SubscriptionConfig<any>;
  state: SubscriptionState;
}

export class SubscriptionManager {
  private subscriptions = new Map<string, SubscriptionEntry>();
  private getConnectionId: () => string | null;
  private getApiUrl: () => string;

  constructor(deps: { getConnectionId: () => string | null; getApiUrl: () => string }) {
    this.getConnectionId = deps.getConnectionId;
    this.getApiUrl = deps.getApiUrl;
  }

  /** 创建订阅 */
  subscribe<T>(config: SubscriptionConfig<T>): SubscriptionInstance<T> {
    const entry: SubscriptionEntry = {
      config: config as SubscriptionConfig,
      state: 'pending',
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
      if (!entry) return;

      // 暂停状态不处理数据
      if (entry.state === 'paused') return;

      this.dispatchMessage(entry, message);
      return;
    }

    // 如果没有 subscription_id，按 channel 匹配
    if (message.channel) {
      for (const entry of this.subscriptions.values()) {
        if (entry.config.channel === message.channel && entry.state === 'active') {
          this.dispatchMessage(entry, message);
        }
      }
    }
  }

  /** 分发消息到订阅回调 */
  private dispatchMessage(entry: SubscriptionEntry, message: SSEMessage): void {
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
