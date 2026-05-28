/**
 * SSE 网关管理器（单例）
 * 维护单一 SSE 连接，管理连接生命周期、重连、心跳
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
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastHeartbeat = 0;
  private subscriptionManager: SubscriptionManager;
  private listeners = new Map<string, Set<EventHandler>>();

  private constructor(config: GatewayConfig) {
    this.config = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
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
        this.reconnectAttempts = 0;
        this.setConnectionState('open');
        this.lastHeartbeat = Date.now();
        this.startHeartbeat();

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

    // 心跳
    this.eventSource.addEventListener('heartbeat', () => {
      this.lastHeartbeat = Date.now();
      this.emit('heartbeat');
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
    this.stopHeartbeat();
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
    this.stopHeartbeat();
    this.setConnectionState('closed');
    console.warn('[SSE Gateway] 连接断开，已禁用自动重连');
    this.emit('disconnected');
  }

  /** 设置连接状态 */
  private setConnectionState(state: SSEConnectionState): void {
    const prev = this.connectionState;
    this.connectionState = state;
    if (prev !== state) {
      this.emit('stateChange', state);
    }
  }

  /** 启动心跳检测 */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastHeartbeat = Date.now();

    // 心跳超时检测已禁用，由连接的 onerror 处理断开
    // this.heartbeatTimer = setInterval(() => {
    //   const elapsed = Date.now() - this.lastHeartbeat;
    //   if (elapsed > this.config.heartbeatInterval * 2) {
    //     console.warn('[SSE Gateway] 心跳超时，触发重连');
    //     this.handleDisconnect();
    //   }
    // }, this.config.heartbeatInterval);
  }

  /** 停止心跳检测 */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
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
