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
  SubscriptionInfo,
  BufferedMessage,
} from './types';
import { SubscriptionManager } from './SubscriptionManager';
import { getToken } from '../storage/tokenStorage';

/** 事件处理器类型 */
type EventHandler = (...args: unknown[]) => void;

/** 环形缓冲最大容量（供监控面板查看近期消息） */
const MESSAGE_BUFFER_SIZE = 20;

export class SSEGateway {
  private static instance: SSEGateway | null = null;

  private config: Required<GatewayConfig>;
  private eventSource: EventSource | null = null;
  private connectionId: string | null = null;
  private connectionState: SSEConnectionState = 'closed';
  private _reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private lastHeartbeatAt = 0;
  private subscriptionManager: SubscriptionManager;
  private listeners = new Map<string, Set<EventHandler>>();
  /** 环形缓冲：最近 N 条消息（connected/heartbeat 不入缓冲） */
  private messageBuffer: BufferedMessage[] = [];

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

  /** 获取最后一次心跳时间戳 */
  getLastHeartbeatAt(): number {
    return this.lastHeartbeatAt;
  }

  /** 获取重连尝试次数 */
  getReconnectAttempts(): number {
    return this._reconnectAttempts;
  }

  /** 获取订阅列表快照 */
  listSubscriptions(): SubscriptionInfo[] {
    return this.subscriptionManager.listSubscriptions();
  }

  /** 获取环形缓冲中的消息。传 subId 仅返回匹配该订阅的 */
  getMessageHistory(subId?: string): BufferedMessage[] {
    if (!subId) return [...this.messageBuffer];
    return this.messageBuffer.filter(m => m.subscriptionId === subId);
  }

  /** 手动强制重连（供监控面板调用） */
  forceReconnect(): void {
    this._reconnectAttempts = 0;
    this.handleDisconnect();
  }

  /** 建立连接 */
  connect(): void {
    // 防止重复连接
    if (this.connectionState === 'connecting' || this.connectionState === 'open') {
      return;
    }

    this.clearReconnectTimer();

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.setConnectionState('connecting');
    const token = getToken();
    const url = `${this.config.url}?token=${token || ''}`;

    // 连接超时：10s 内未收到 connected 事件则视为连接失败
    this.clearConnectionTimer();
    this.connectionTimer = setTimeout(() => {
      console.warn('[SSE] 连接超时，主动断开重连');
      this.handleDisconnect();
    }, 10_000);

    this.eventSource = new EventSource(url);

    // 连接确认
    this.eventSource.addEventListener('connected', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.connectionId = data.data?.connection_id || data.connection_id;
        this._reconnectAttempts = 0;
        this.setConnectionState('open');
        this.clearConnectionTimer();
        this.resetHeartbeat();

        // 重连后重新订阅（首次连接也会在此同步补发之前 connectionId 为 null 时被丢弃的订阅）
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
        this.resetHeartbeat();
        this.pushMessageBuffer(message);
        this.emit('message', message);
        this.subscriptionManager.handleMessage(message);
      } catch (e) {
        console.error('[SSE Gateway] 消息解析失败:', e);
      }
    });

    // 心跳事件：后端每 30s 推送一次，记录时间戳并重置超时计时器
    this.eventSource.addEventListener('heartbeat', () => {
      this.lastHeartbeatAt = Date.now();
      this.resetHeartbeat();
    });

    // 完成事件
    this.eventSource.addEventListener('complete', () => {
      this.emit('complete');
    });

    // 错误处理：仅在连接真正关闭时重连，避免浏览器 CONNECTING 状态下的中间态 onerror 误重连
    this.eventSource.onerror = (e) => {
      const rs = this.eventSource?.readyState;
      // 0 = CONNECTING（浏览器正在重试），1 = OPEN（2 = CLOSED
      if (rs === EventSource.CLOSED) {
        console.warn('[SSE Gateway] ❌ 连接已关闭，准备重连');
        this.handleDisconnect();
      } else {
        console.warn('[SSE Gateway] ⚠️ 连接错误但未关闭，readyState:', rs, e);
      }
    };
  }

  /** 断开连接 */
  disconnect(): void {
    this.clearReconnectTimer();
    this.clearConnectionTimer();
    this.clearHeartbeat();

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
    this.clearConnectionTimer();
    this.clearHeartbeat();

    // 关闭旧 EventSource，阻止浏览器内置重连干扰
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.connectionId = null;

    this.setConnectionState('closed');
    this.emit('disconnected');
    this.scheduleReconnect();
  }

  /** 计划重连（无限重连，指数退避封顶 60s） */
  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const base = this.config.reconnectInterval;
    const raw = base * Math.pow(1.5, this._reconnectAttempts);
    const delay = Math.min(raw, 60_000); // 封顶 60s
    this._reconnectAttempts++;

    console.log(`[SSE] ${(delay / 1000).toFixed(1)}s 后尝试第 ${this._reconnectAttempts} 次重连`);
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

  /** 推入环形缓冲（超出容量则按 FIFO 弹出） */
  private pushMessageBuffer(message: SSEMessage): void {
    this.messageBuffer.push({
      ts: Date.now(),
      subscriptionId: message.subscription_id,
      channel: message.channel,
      event: message.event,
      raw: message,
    });
    if (this.messageBuffer.length > MESSAGE_BUFFER_SIZE) {
      this.messageBuffer.splice(0, this.messageBuffer.length - MESSAGE_BUFFER_SIZE);
    }
  }

  /** 清除重连定时器 */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearConnectionTimer(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 重置心跳守护：后端每 30s 发一次心跳，60s 内未收到任何事件
   * （connected/data/heartbeat）则认为连接已死，主动重连。
   */
  private resetHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatTimer = setTimeout(() => {
      console.warn('[SSE] 心跳超时（超 60s 未收到事件），主动断开重连');
      this.handleDisconnect();
    }, 60_000);
  }
}
