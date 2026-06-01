/**
 * SSE 网关管理器（单例）
 * 维护单一 SSE 连接，管理连接生命周期、重连
 * @ts-nocheck
 */

import type {
  SSEConnectionState,
  SSEMessage,
  GatewayConfig,
  SubscriptionConfig,
  Subscription,
} from './types';
import { SubscriptionManager } from './SubscriptionManager';
import { getToken } from '../storage/tokenStorage';

/** 事件处理器类型 */
type EventHandler = (...args: unknown[]) => void;

export class SSEGateway {
  private static instance: SSEGateway | null = null;

  private config: Required<GatewayConfig>;
  private eventSource: EventSource | null = null;
  private connectionId: string | null = null;
  private connectionState: SSEConnectionState = 'closed';
  private _reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private subscriptionManager: SubscriptionManager;
  private listeners = new Map<string, Set<EventHandler>>();

  private constructor(config: GatewayConfig) {
    this.config = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      subscribeApiUrl: '/sse',
      ...config,
    };
    this.subscriptionManager = new SubscriptionManager({
      getConnectionId: () => this.connectionId,
      getApiUrl: () => this.config.subscribeApiUrl,
    });
  }

  /** 获取单例实例 */
  static getInstance(config?: GatewayConfig): SSEGateway {
    if (!SSEGateway.instance && config) {
      SSEGateway.instance = new SSEGateway(config);
    }
    return SSEGateway.instance!;
  }

  /** 重置单例（仅用于测试） */
  static resetInstance(): void {
    if (SSEGateway.instance) {
      SSEGateway.instance.disconnect();
      SSEGateway.instance = null;
    }
  }

  /** 获取连接状态 */
  getState(): SSEConnectionState {
    return this.connectionState;
  }

  /** 获取连接 ID */
  getConnectionId(): string | null {
    return this.connectionId;
  }

  /** 是否已连接 */
  isConnected(): boolean {
    return this.connectionState === 'open';
  }

  /** 建立连接 */
  connect(): void {
    if (this.eventSource) {
      this.eventSource.close();
    }

    this.setConnectionState('connecting');
    const token = getToken();
    const url = `${this.config.url}?token=${token || ''}`;

    this.eventSource = new EventSource(url);

    // 连接确认
    this.eventSource.addEventListener('connected', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.connectionId = data.data?.connection_id || data.connection_id;
        this._reconnectAttempts = 0;
        this.setConnectionState('open');

        // 重连后重新订阅
        this.subscriptionManager.resubscribeAll();

        this.emit('connected', data);
      } catch (e) {
        console.error('[SSE Gateway] connected 事件解析失败:', e);
      }
    });

    // 数据消息
    this.eventSource.addEventListener('data', (event) => {
      try {
        const message: SSEMessage = JSON.parse(event.data);
        this.emit('message', message);
        this.subscriptionManager.handleMessage(message);
      } catch (e) {
        console.error('[SSE Gateway] 消息解析失败:', e);
      }
    });

    // 完成事件
    this.eventSource.addEventListener('complete', () => {
      this.emit('complete');
    });

    // 错误处理
    this.eventSource.onerror = () => {
      this.handleDisconnect();
    };
  }

  /** 断开连接 */
  disconnect(): void {
    this.clearReconnectTimer();

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.connectionId = null;
    this.setConnectionState('closed');
    this.subscriptionManager.unsubscribeAll();
  }

  /** 订阅 */
  subscribe<T>(config: SubscriptionConfig<T>): Subscription<T> {
    return this.subscriptionManager.subscribe(config);
  }

  /** 监听事件 */
  on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  /** 触发事件 */
  private emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach(handler => {
      try {
        handler(...args);
      } catch (e) {
        console.error(`[SSE Gateway] 事件处理错误 (${event}):`, e);
      }
    });
  }

  /** 处理断开连接 */
  private handleDisconnect(): void {
    this.setConnectionState('closed');
    this.emit('disconnected');
    this.scheduleReconnect();
  }

  /** 计划重连 */
  private scheduleReconnect(): void {
    if (this._reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.warn('[SSE Gateway] 达到最大重连次数，停止重连');
      return;
    }

    this.clearReconnectTimer();
    const delay = this.config.reconnectInterval * Math.pow(1.5, this._reconnectAttempts);
    this._reconnectAttempts++;

    console.log(`[SSE Gateway] ${delay / 1000}s 后尝试第 ${this._reconnectAttempts} 次重连`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.connectionState === 'closed') {
        this.connect();
      }
    }, delay);
  }

  /** 设置连接状态 */
  private setConnectionState(state: SSEConnectionState): void {
    const prev = this.connectionState;
    this.connectionState = state;
    if (prev !== state) {
      this.emit('stateChange', state);
    }
  }

  /** 清除重连定时器 */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
