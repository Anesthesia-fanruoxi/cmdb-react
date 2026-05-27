# SSE 网关 + 订阅模式 架构设计方案

## 1. 背景与目标

### 1.1 当前问题

当前项目有 **8 个独立的 SSE 端点**，每个功能各自管理连接，存在以下问题：

| 问题 | 影响 |
|------|------|
| 连接数过多 | 每个页面打开都会创建新的 SSE 连接，浏览器并发限制（6个）导致连接排队 |
| 资源浪费 | 大部分时间连接空闲，但仍占用服务端资源 |
| 代码重复 | 每个端点都重复实现连接、重连、错误处理逻辑 |
| 状态分散 | 连接状态分散在各个组件/Store 中，难以统一管理 |

### 1.2 目标架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              客户端 (Browser)                                │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  SQL审批页面  │  │  任务中心   │  │  监控页面    │  │  项目更新   │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                    │                                        │
│                           ┌────────▼────────┐                               │
│                           │   SSE Gateway    │                               │
│                           │   (单例管理器)    │                               │
│                           └────────┬────────┘                               │
│                                    │                                        │
│                           ┌────────▼────────┐                               │
│                           │   订阅管理器     │                               │
│                           │  (Subscription)  │                               │
│                           └────────┬────────┘                               │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │ 仅 1 个 SSE 连接
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│                           服务端 (Go Backend)                               │
│                                    │                                        │
│                           ┌────────▼────────┐                               │
│                           │   SSE Gateway    │                               │
│                           │    Handler       │                               │
│                           └────────┬────────┘                               │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────┐             │
│         │                          │                          │             │
│  ┌──────▼──────┐           ┌───────▼───────┐          ┌───────▼───────┐    │
│  │  SQL 模块   │           │  任务模块      │          │  监控模块      │    │
│  │  订阅管理   │           │  订阅管理      │          │  订阅管理      │    │
│  └─────────────┘           └───────────────┘          └───────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 核心设计原则

1. **单一连接**：客户端只维护 1 个 SSE 连接
2. **按需订阅**：客户端通过消息订阅/取消订阅来控制接收的数据
3. **服务端过滤**：服务端根据订阅列表过滤推送数据
4. **渐进迁移**：支持新旧模式并存，逐步迁移

---

## 2. 当前 SSE 使用情况分析

### 2.1 端点清单

| # | 端点 | 功能 | 使用位置 | 重连机制 | 数据特征 |
|---|------|------|----------|----------|----------|
| 1 | `/sql/apply/list` | SQL审批列表 | SqlApply页面 | ✅ 有 | 列表全量推送 |
| 2 | `/sql/databi/tables` | BI表树 | useDatabiTables Hook | ❌ 无 | 事件流(进度+结果) |
| 3 | `/sql/export/list` | SQL导出列表 | SqlExport页面 | ❌ 无 | 列表+进度数据 |
| 4 | `/tasks/list` | 任务中心列表 | taskCenterStore | ❌ 无 | 列表全量推送 |
| 5 | `/tasks/detail?id=xxx` | 任务详情 | TaskItem组件 | ❌ 无 | 单任务详情 |
| 6 | `/monitor/metrics/list` | 监控指标 | 3个监控页面 | ❌ 无 | 时序数据流 |
| 7 | `/assets/proUpdate/list-detail` | 项目更新详情 | ProjectDetailDrawer | ❌ 无 | 项目+记录列表 |
| 8 | `/assets/proUpdate/records-detail` | 发版记录详情 | RecordDetailDialog | ❌ 无 | 记录+步骤详情 |

### 2.2 数据流模式

```
模式A: 列表订阅 (List Subscription)
┌──────────┐     ┌──────────┐     ┌──────────┐
│  客户端   │────▶│  服务端   │────▶│  客户端   │
│ subscribe │     │  过滤数据  │     │  推送数据  │
└──────────┘     └──────────┘     └──────────┘
     │                                  │
     │         持续推送直到取消           │
     └──────────────────────────────────┘

模式B: 事件流订阅 (Event Stream Subscription)
┌──────────┐     ┌──────────┐     ┌──────────┐
│  客户端   │────▶│  服务端   │────▶│  客户端   │
│ subscribe │     │  处理任务  │     │  进度事件  │
└──────────┘     └──────────┘     └──────────┘
     │                                  │
     │         事件流直到完成             │
     └──────────────────────────────────┘
```

---

## 3. API 接口设计

### 3.1 SSE 网关端点

```
GET /sse/gateway?token={jwt_token}
```

**连接建立后，服务端发送：**
```typescript
// 连接确认
event: connected
data: {"connection_id": "conn_abc123", "server_time": 1716800000}
```

### 3.2 客户端请求消息格式

客户端通过 HTTP POST 请求管理订阅（不是通过 SSE 连接发送）：

```
POST /sse/subscribe
Content-Type: application/json
Authorization: Bearer {token}
```

#### 3.2.1 订阅请求

```typescript
interface SubscribeRequest {
  connection_id: string;           // SSE 连接 ID
  subscriptions: Subscription[];   // 订阅列表
}

interface Subscription {
  id: string;                      // 订阅唯一ID (客户端生成)
  channel: string;                 // 通道名称
  params: Record<string, unknown>; // 订阅参数
}

// 示例
{
  "connection_id": "conn_abc123",
  "subscriptions": [
    {
      "id": "sub_sql_apply_001",
      "channel": "sql.apply.list",
      "params": {
        "submitter_name": "",
        "status": ""
      }
    },
    {
      "id": "sub_task_list_001",
      "channel": "tasks.list",
      "params": {
        "type": "analysis"
      }
    }
  ]
}
```

#### 3.2.2 取消订阅请求

```typescript
interface UnsubscribeRequest {
  connection_id: string;
  subscription_ids: string[];  // 要取消的订阅ID列表
}
```

### 3.3 服务端推送消息格式

```typescript
interface SSEMessage {
  subscription_id: string;  // 对应订阅的ID
  channel: string;          // 通道名称
  event: 'data' | 'complete' | 'error';
  data: unknown;            // 业务数据
  timestamp: number;        // 服务端时间戳
}

// 推送示例
event: data
data: {
  "subscription_id": "sub_sql_apply_001",
  "channel": "sql.apply.list",
  "event": "data",
  "data": {
    "apply": [...],
    "total_count": 10
  },
  "timestamp": 1716800000
}
```

### 3.4 通道定义

```typescript
// 通道名称常量
const CHANNELS = {
  // SQL 相关
  SQL_APPLY_LIST: 'sql.apply.list',           // SQL审批列表
  SQL_DATABI_TABLES: 'sql.databi.tables',     // BI表树
  SQL_EXPORT_LIST: 'sql.export.list',         // SQL导出列表
  
  // 任务相关
  TASKS_LIST: 'tasks.list',                   // 任务列表
  TASKS_DETAIL: 'tasks.detail',              // 任务详情
  
  // 监控相关
  MONITOR_METRICS: 'monitor.metrics',         // 监控指标
  
  // 资产相关
  ASSETS_PROJECT_DETAIL: 'assets.project.detail',     // 项目更新详情
  ASSETS_RECORD_DETAIL: 'assets.record.detail',       // 发版记录详情
} as const;

// 通道参数定义
interface ChannelParams {
  'sql.apply.list': {
    submitter_name?: string;
    status?: string;
  };
  'sql.databi.tables': {
    project: string;
  };
  'sql.export.list': Record<string, never>;
  'tasks.list': {
    type: 'analysis' | 'es_export' | 'sql_export';
    keyword?: string;
  };
  'tasks.detail': {
    task_id: string;
  };
  'monitor.metrics': {
    project: string;
    category: string;
    service?: string;
  };
  'assets.project.detail': {
    project: string;
    type?: string;
  };
  'assets.record.detail': {
    task_id: string;
  };
}
```

---

## 4. 客户端设计 (TypeScript)

### 4.1 核心类结构

```
src/services/sse/
├── SSEGateway.ts          # SSE 网关管理器 (单例)
├── SubscriptionManager.ts # 订阅管理器
├── types.ts               # 类型定义
├── channels/              # 通道处理器
│   ├── index.ts
│   ├── sqlApply.ts
│   ├── tasksList.ts
│   └── ...
└── hooks/                 # React Hooks
    ├── useSSESubscription.ts
    ├── useSSEChannel.ts
    └── ...
```

### 4.2 类型定义

```typescript
// src/services/sse/types.ts

/** SSE 连接状态 */
export type SSEConnectionState = 'connecting' | 'open' | 'closed' | 'reconnecting';

/** 订阅状态 */
export type SubscriptionState = 'pending' | 'active' | 'paused' | 'error' | 'closed';

/** 订阅配置 */
export interface SubscriptionConfig<T = unknown> {
  id: string;
  channel: string;
  params: Record<string, unknown>;
  onData: (data: T) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

/** 订阅实例 */
export interface Subscription<T = unknown> {
  id: string;
  channel: string;
  params: Record<string, unknown>;
  state: SubscriptionState;
  unsubscribe: () => void;
  pause: () => void;
  resume: () => void;
}

/** SSE 消息 */
export interface SSEMessage<T = unknown> {
  subscription_id: string;
  channel: string;
  event: 'data' | 'complete' | 'error';
  data: T;
  timestamp: number;
  error?: {
    code: string;
    message: string;
  };
}

/** 网关配置 */
export interface GatewayConfig {
  /** SSE 端点 URL */
  url: string;
  /** 重连间隔 (ms) */
  reconnectInterval?: number;
  /** 最大重连次数 */
  maxReconnectAttempts?: number;
  /** 心跳间隔 (ms) */
  heartbeatInterval?: number;
  /** 订阅 API 基础 URL */
  subscribeApiUrl?: string;
}
```

### 4.3 SSEGateway 类

```typescript
// src/services/sse/SSEGateway.ts

import { EventEmitter } from 'eventemitter3';
import type {
  SSEConnectionState,
  SSEMessage,
  GatewayConfig,
  SubscriptionConfig,
  Subscription,
} from './types';
import { SubscriptionManager } from './SubscriptionManager';

export class SSEGateway extends EventEmitter {
  private static instance: SSEGateway | null = null;
  
  private config: Required<GatewayConfig>;
  private eventSource: EventSource | null = null;
  private connectionId: string | null = null;
  private connectionState: SSEConnectionState = 'closed';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private subscriptionManager: SubscriptionManager;
  
  private constructor(config: GatewayConfig) {
    super();
    this.config = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      subscribeApiUrl: '/sse',
      ...config,
    };
    this.subscriptionManager = new SubscriptionManager(this);
  }
  
  /** 获取单例实例 */
  static getInstance(config?: GatewayConfig): SSEGateway {
    if (!SSEGateway.instance && config) {
      SSEGateway.instance = new SSEGateway(config);
    }
    return SSEGateway.instance!;
  }
  
  /** 获取连接状态 */
  getState(): SSEConnectionState {
    return this.connectionState;
  }
  
  /** 获取连接 ID */
  getConnectionId(): string | null {
    return this.connectionId;
  }
  
  /** 建立连接 */
  connect(): void {
    if (this.eventSource) {
      this.eventSource.close();
    }
    
    this.setConnectionState('connecting');
    const url = `${this.config.url}?token=${this.getToken()}`;
    
    this.eventSource = new EventSource(url);
    
    this.eventSource.addEventListener('connected', (event) => {
      const data = JSON.parse(event.data);
      this.connectionId = data.connection_id;
      this.reconnectAttempts = 0;
      this.setConnectionState('open');
      this.startHeartbeat();
      this.emit('connected', data);
      
      // 重新订阅之前的订阅
      this.subscriptionManager.resubscribeAll();
    });
    
    this.eventSource.addEventListener('data', (event) => {
      try {
        const message: SSEMessage = JSON.parse(event.data);
        this.emit('message', message);
        this.subscriptionManager.handleMessage(message);
      } catch (e) {
        console.error('[SSE Gateway] 消息解析失败:', e);
      }
    });
    
    this.eventSource.addEventListener('heartbeat', () => {
      this.emit('heartbeat');
    });
    
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
  
  /** 处理断开连接 */
  private handleDisconnect(): void {
    this.stopHeartbeat();
    this.setConnectionState('reconnecting');
    
    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.config.reconnectInterval * Math.min(this.reconnectAttempts, 5);
      
      console.log(`[SSE Gateway] ${delay}ms 后重连 (第${this.reconnectAttempts}次)`);
      
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('[SSE Gateway] 达到最大重连次数');
      this.emit('maxReconnectReached');
    }
  }
  
  /** 设置连接状态 */
  private setConnectionState(state: SSEConnectionState): void {
    this.connectionState = state;
    this.emit('stateChange', state);
  }
  
  /** 启动心跳 */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      // 心跳超时检测
    }, this.config.heartbeatInterval);
  }
  
  /** 停止心跳 */
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
  
  /** 获取 Token */
  private getToken(): string {
    return localStorage.getItem('token') || '';
  }
}
```

### 4.4 SubscriptionManager 类

```typescript
// src/services/sse/SubscriptionManager.ts

import type {
  SubscriptionConfig,
  Subscription,
  SubscriptionState,
  SSEMessage,
} from './types';
import type { SSEGateway } from './SSEGateway';

interface SubscriptionEntry {
  config: SubscriptionConfig;
  state: SubscriptionState;
}

export class SubscriptionManager {
  private gateway: SSEGateway;
  private subscriptions = new Map<string, SubscriptionEntry>();
  
  constructor(gateway: SSEGateway) {
    this.gateway = gateway;
  }
  
  /** 创建订阅 */
  subscribe<T>(config: SubscriptionConfig<T>): Subscription<T> {
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
    this.sendUnsubscribeRequest(ids);
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
    const entry = this.subscriptions.get(message.subscription_id);
    if (!entry) return;
    
    // 暂停状态不处理数据
    if (entry.state === 'paused') return;
    
    switch (message.event) {
      case 'data':
        entry.state = 'active';
        entry.config.onData(message.data);
        break;
      case 'complete':
        entry.config.onComplete?.();
        this.subscriptions.delete(message.subscription_id);
        break;
      case 'error':
        entry.config.onError?.(
          new Error(message.error?.message || 'Unknown error')
        );
        break;
    }
  }
  
  /** 重新订阅所有 (重连后) */
  async resubscribeAll(): Promise<void> {
    const configs = Array.from(this.subscriptions.values()).map(e => e.config);
    if (configs.length > 0) {
      await this.sendSubscribeRequest(configs);
    }
  }
  
  /** 发送订阅请求 */
  private async sendSubscribeRequest(configs: SubscriptionConfig[]): Promise<void> {
    const connectionId = this.gateway.getConnectionId();
    if (!connectionId) return;
    
    try {
      const response = await fetch(`${this.gateway['config'].subscribeApiUrl}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          connection_id: connectionId,
          subscriptions: configs.map(c => ({
            id: c.id,
            channel: c.channel,
            params: c.params,
          })),
        }),
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
      console.error('[Subscription] 订阅请求失败:', error);
    }
  }
  
  /** 发送取消订阅请求 */
  private async sendUnsubscribeRequest(subscriptionIds: string[]): Promise<void> {
    const connectionId = this.gateway.getConnectionId();
    if (!connectionId) return;
    
    try {
      await fetch(`${this.gateway['config'].subscribeApiUrl}/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          connection_id: connectionId,
          subscription_ids: subscriptionIds,
        }),
      });
    } catch (error) {
      console.error('[Subscription] 取消订阅请求失败:', error);
    }
  }
}
```

### 4.5 React Hooks

```typescript
// src/services/sse/hooks/useSSESubscription.ts

import { useEffect, useRef, useCallback } from 'react';
import { SSEGateway } from '../SSEGateway';
import type { SubscriptionConfig, Subscription } from '../types';

interface UseSSESubscriptionOptions<T> {
  channel: string;
  params: Record<string, unknown>;
  onData: (data: T) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
  enabled?: boolean;
}

export function useSSESubscription<T>({
  channel,
  params,
  onData,
  onError,
  onComplete,
  enabled = true,
}: UseSSESubscriptionOptions<T>) {
  const subscriptionRef = useRef<Subscription<T> | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  
  // 生成稳定的订阅ID
  const subscriptionId = useRef(
    `sub_${channel}_${Math.random().toString(36).slice(2, 8)}`
  ).current;
  
  const subscribe = useCallback(() => {
    if (!enabled) return;
    
    const gateway = SSEGateway.getInstance();
    
    // 确保连接
    if (gateway.getState() === 'closed') {
      gateway.connect();
    }
    
    subscriptionRef.current = gateway.subscribe<T>({
      id: subscriptionId,
      channel,
      params: paramsRef.current,
      onData,
      onError,
      onComplete,
    });
  }, [channel, enabled, subscriptionId, onData, onError, onComplete]);
  
  const unsubscribe = useCallback(() => {
    subscriptionRef.current?.unsubscribe();
    subscriptionRef.current = null;
  }, []);
  
  useEffect(() => {
    subscribe();
    return () => unsubscribe();
  }, [subscribe, unsubscribe]);
  
  return {
    subscription: subscriptionRef.current,
    unsubscribe,
  };
}

// src/services/sse/hooks/useSSEChannel.ts

import { useState, useEffect, useCallback } from 'react';
import { useSSESubscription } from './useSSESubscription';

interface UseSSEChannelOptions<T> {
  channel: string;
  params: Record<string, unknown>;
  enabled?: boolean;
}

export function useSSEChannel<T>({
  channel,
  params,
  enabled = true,
}: UseSSEChannelOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const handleData = useCallback((newData: T) => {
    setData(newData);
    setLoading(false);
    setError(null);
  }, []);
  
  const handleError = useCallback((err: Error) => {
    setError(err);
    setLoading(false);
  }, []);
  
  const { subscription } = useSSESubscription({
    channel,
    params,
    onData: handleData,
    onError: handleError,
    enabled,
  });
  
  return {
    data,
    loading,
    error,
    subscription,
  };
}
```

### 4.6 使用示例

```typescript
// 页面中使用 Hook

import { useSSEChannel } from '@/services/sse/hooks';

// SQL 审批列表
const SqlApplyPage = () => {
  const { data, loading, error } = useSSEChannel<ApplyListData>({
    channel: 'sql.apply.list',
    params: {
      submitter_name: filterSubmitter,
      status: filterStatus,
    },
  });
  
  if (loading) return <Loading />;
  if (error) return <Error message={error.message} />;
  
  return <ApplyTable data={data?.apply || []} />;
};

// 任务中心 Store
const useTaskCenterStore = create((set, get) => ({
  // ...
  
  startSSE: () => {
    const gateway = SSEGateway.getInstance();
    
    get().subscription?.unsubscribe();
    
    const subscription = gateway.subscribe<TaskListData>({
      id: 'sub_tasks_list',
      channel: 'tasks.list',
      params: { type: get().activeType },
      onData: (data) => {
        // 处理任务列表更新
        set({ taskList: data.tasks });
      },
    });
    
    set({ subscription });
  },
}));
```

---

## 5. 服务端设计 (Go)

### 5.1 目录结构

```
internal/
├── sse/
│   ├── gateway.go          # 网关处理器
│   ├── connection.go       # 连接管理
│   ├── subscription.go     # 订阅管理
│   ├── message.go          # 消息定义
│   └── channels/           # 通道实现
│       ├── channel.go      # 通道接口
│       ├── sql_apply.go
│       ├── tasks.go
│       └── monitor.go
└── handler/
    └── sse.go              # HTTP 处理器
```

### 5.2 核心结构体

```go
// internal/sse/message.go

package sse

import "time"

// SSEMessage 服务端推送消息
type SSEMessage struct {
    SubscriptionID string      `json:"subscription_id"`
    Channel        string      `json:"channel"`
    Event          string      `json:"event"` // data, complete, error
    Data           interface{} `json:"data"`
    Timestamp      int64       `json:"timestamp"`
    Error          *ErrorInfo  `json:"error,omitempty"`
}

// ErrorInfo 错误信息
type ErrorInfo struct {
    Code    string `json:"code"`
    Message string `json:"message"`
}

// SubscribeRequest 订阅请求
type SubscribeRequest struct {
    ConnectionID  string         `json:"connection_id"`
    Subscriptions []Subscription `json:"subscriptions"`
}

// Subscription 订阅配置
type Subscription struct {
    ID     string                 `json:"id"`
    Channel string               `json:"channel"`
    Params map[string]interface{} `json:"params"`
}

// UnsubscribeRequest 取消订阅请求
type UnsubscribeRequest struct {
    ConnectionID    string   `json:"connection_id"`
    SubscriptionIDs []string `json:"subscription_ids"`
}

// NewSSEMessage 创建消息
func NewSSEMessage(subID, channel, event string, data interface{}) SSEMessage {
    return SSEMessage{
        SubscriptionID: subID,
        Channel:        channel,
        Event:          event,
        Data:           data,
        Timestamp:      time.Now().Unix(),
    }
}

// NewErrorMessage 创建错误消息
func NewErrorMessage(subID, channel, code, message string) SSEMessage {
    return SSEMessage{
        SubscriptionID: subID,
        Channel:        channel,
        Event:          "error",
        Timestamp:      time.Now().Unix(),
        Error: &ErrorInfo{
            Code:    code,
            Message: message,
        },
    }
}
```

```go
// internal/sse/connection.go

package sse

import (
    "context"
    "sync"
    "time"
    
    "github.com/google/uuid"
)

// Connection SSE 连接
type Connection struct {
    ID            string
    UserID        int64
    Writer        chan SSEMessage
    Subscriptions map[string]*SubscriptionState
    CreatedAt     time.Time
    LastHeartbeat time.Time
    ctx           context.Context
    cancel        context.CancelFunc
    mu            sync.RWMutex
}

// SubscriptionState 订阅状态
type SubscriptionState struct {
    Subscription
    Active   bool
    Params   map[string]interface{}
}

// NewConnection 创建新连接
func NewConnection(userID int64) *Connection {
    ctx, cancel := context.WithCancel(context.Background())
    return &Connection{
        ID:            uuid.New().String(),
        UserID:        userID,
        Writer:        make(chan SSEMessage, 100),
        Subscriptions: make(map[string]*SubscriptionState),
        CreatedAt:     time.Now(),
        LastHeartbeat: time.Now(),
        ctx:           ctx,
        cancel:        cancel,
    }
}

// AddSubscription 添加订阅
func (c *Connection) AddSubscription(sub Subscription) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.Subscriptions[sub.ID] = &SubscriptionState{
        Subscription: sub,
        Active:       true,
        Params:       sub.Params,
    }
}

// RemoveSubscription 移除订阅
func (c *Connection) RemoveSubscription(subID string) {
    c.mu.Lock()
    defer c.mu.Unlock()
    delete(c.Subscriptions, subID)
}

// GetActiveSubscriptions 获取活跃订阅
func (c *Connection) GetActiveSubscriptions() []*SubscriptionState {
    c.mu.RLock()
    defer c.mu.RUnlock()
    
    subs := make([]*SubscriptionState, 0)
    for _, sub := range c.Subscriptions {
        if sub.Active {
            subs = append(subs, sub)
        }
    }
    return subs
}

// HasSubscription 检查是否有指定通道的订阅
func (c *Connection) HasSubscription(channel string) bool {
    c.mu.RLock()
    defer c.mu.RUnlock()
    
    for _, sub := range c.Subscriptions {
        if sub.Channel == channel && sub.Active {
            return true
        }
    }
    return false
}

// Send 发送消息
func (c *Connection) Send(msg SSEMessage) {
    select {
    case c.Writer <- msg:
    default:
        // 缓冲区满，丢弃消息
    }
}

// Close 关闭连接
func (c *Connection) Close() {
    c.cancel()
    close(c.Writer)
}
```

```go
// internal/sse/gateway.go

package sse

import (
    "sync"
    "time"
)

// Gateway SSE 网关
type Gateway struct {
    connections map[string]*Connection  // connectionID -> Connection
    userConns   map[int64][]string      // userID -> connectionIDs
    channels    map[string]Channel      // channelName -> Channel implementation
    mu          sync.RWMutex
}

// Channel 通道接口
type Channel interface {
    Name() string
    Subscribe(conn *Connection, sub *SubscriptionState) error
    Unsubscribe(conn *Connection, subID string)
    GetInitialData(params map[string]interface{}) (interface{}, error)
}

// NewGateway 创建网关
func NewGateway() *Gateway {
    return &Gateway{
        connections: make(map[string]*Connection),
        userConns:   make(map[int64][]string),
        channels:    make(map[string]Channel),
    }
}

// RegisterChannel 注册通道
func (g *Gateway) RegisterChannel(ch Channel) {
    g.mu.Lock()
    defer g.mu.Unlock()
    g.channels[ch.Name()] = ch
}

// AddConnection 添加连接
func (g *Gateway) AddConnection(conn *Connection) {
    g.mu.Lock()
    defer g.mu.Unlock()
    
    g.connections[conn.ID] = conn
    g.userConns[conn.UserID] = append(g.userConns[conn.UserID], conn.ID)
}

// RemoveConnection 移除连接
func (g *Gateway) RemoveConnection(connID string) {
    g.mu.Lock()
    defer g.mu.Unlock()
    
    conn, exists := g.connections[connID]
    if !exists {
        return
    }
    
    // 清理订阅
    for _, sub := range conn.GetActiveSubscriptions() {
        if ch, ok := g.channels[sub.Channel]; ok {
            ch.Unsubscribe(conn, sub.ID)
        }
    }
    
    // 移除连接
    delete(g.connections, connID)
    
    // 清理用户连接映射
    conns := g.userConns[conn.UserID]
    for i, id := range conns {
        if id == connID {
            g.userConns[conn.UserID] = append(conns[:i], conns[i+1:]...)
            break
        }
    }
    
    conn.Close()
}

// Subscribe 处理订阅请求
func (g *Gateway) Subscribe(req SubscribeRequest) error {
    g.mu.RLock()
    conn, exists := g.connections[req.ConnectionID]
    g.mu.RUnlock()
    
    if !exists {
        return ErrConnectionNotFound
    }
    
    for _, sub := range req.Subscriptions {
        ch, ok := g.channels[sub.Channel]
        if !ok {
            continue
        }
        
        // 添加到连接
        conn.AddSubscription(sub)
        
        // 调用通道订阅
        state := conn.Subscriptions[sub.ID]
        if err := ch.Subscribe(conn, state); err != nil {
            conn.RemoveSubscription(sub.ID)
            continue
        }
        
        // 发送初始数据
        if data, err := ch.GetInitialData(sub.Params); err == nil {
            conn.Send(NewSSEMessage(sub.ID, sub.Channel, "data", data))
        }
    }
    
    return nil
}

// Unsubscribe 处理取消订阅请求
func (g *Gateway) Unsubscribe(req UnsubscribeRequest) {
    g.mu.RLock()
    conn, exists := g.connections[req.ConnectionID]
    g.mu.RUnlock()
    
    if !exists {
        return
    }
    
    for _, subID := range req.SubscriptionIDs {
        sub, ok := conn.Subscriptions[subID]
        if !ok {
            continue
        }
        
        // 调用通道取消订阅
        if ch, ok := g.channels[sub.Channel]; ok {
            ch.Unsubscribe(conn, subID)
        }
        
        // 从连接移除
        conn.RemoveSubscription(subID)
    }
}

// BroadcastToChannel 向通道的所有订阅者广播消息
func (g *Gateway) BroadcastToChannel(channel string, data interface{}) {
    g.mu.RLock()
    defer g.mu.RUnlock()
    
    msg := NewSSEMessage("", channel, "data", data)
    
    for _, conn := range g.connections {
        for _, sub := range conn.GetActiveSubscriptions() {
            if sub.Channel == channel {
                msg.SubscriptionID = sub.ID
                conn.Send(msg)
            }
        }
    }
}

// GetUserConnections 获取用户的所有连接
func (g *Gateway) GetUserConnections(userID int64) []*Connection {
    g.mu.RLock()
    defer g.mu.RUnlock()
    
    conns := make([]*Connection, 0)
    for _, connID := range g.userConns[userID] {
        if conn, ok := g.connections[connID]; ok {
            conns = append(conns, conn)
        }
    }
    return conns
}
```

### 5.3 HTTP 处理器

```go
// internal/handler/sse.go

package handler

import (
    "encoding/json"
    "fmt"
    "net/http"
    "time"
    
    "your-project/internal/sse"
)

// SSEHandler SSE HTTP 处理器
type SSEHandler struct {
    gateway *sse.Gateway
}

// NewSSEHandler 创建处理器
func NewSSEHandler(gateway *sse.Gateway) *SSEHandler {
    return &SSEHandler{gateway: gateway}
}

// HandleGateway SSE 网关端点
func (h *SSEHandler) HandleGateway(w http.ResponseWriter, r *http.Request) {
    // 获取用户信息 (从 JWT 中解析)
    userID := getUserIDFromContext(r.Context())
    if userID == 0 {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }
    
    // 设置 SSE 响应头
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")
    w.Header().Set("Access-Control-Allow-Origin", "*")
    
    // 创建连接
    conn := sse.NewConnection(userID)
    h.gateway.AddConnection(conn)
    
    // 确保连接清理
    defer h.gateway.RemoveConnection(conn.ID)
    
    // 发送连接确认
    conn.Send(sse.SSEMessage{
        Event: "connected",
        Data: map[string]interface{}{
            "connection_id": conn.ID,
            "server_time":   time.Now().Unix(),
        },
        Timestamp: time.Now().Unix(),
    })
    
    // 启动心跳
    go h.startHeartbeat(conn, r.Context())
    
    // 监听消息并写入响应
    flusher, ok := w.(http.Flusher)
    if !ok {
        http.Error(w, "Streaming not supported", http.StatusInternalServerError)
        return
    }
    
    for {
        select {
        case <-r.Context().Done():
            return
        case msg, ok := <-conn.Writer:
            if !ok {
                return
            }
            
            data, err := json.Marshal(msg)
            if err != nil {
                continue
            }
            
            fmt.Fprintf(w, "event: %s\ndata: %s\n\n", msg.Event, data)
            flusher.Flush()
        }
    }
}

// HandleSubscribe 处理订阅请求
func (h *SSEHandler) HandleSubscribe(w http.ResponseWriter, r *http.Request) {
    var req sse.SubscribeRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request", http.StatusBadRequest)
        return
    }
    
    if err := h.gateway.Subscribe(req); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }
    
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// HandleUnsubscribe 处理取消订阅请求
func (h *SSEHandler) HandleUnsubscribe(w http.ResponseWriter, r *http.Request) {
    var req sse.UnsubscribeRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request", http.StatusBadRequest)
        return
    }
    
    h.gateway.Unsubscribe(req)
    
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// startHeartbeat 启动心跳
func (h *SSEHandler) startHeartbeat(conn *sse.Connection, ctx context.Context) {
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop()
    
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            conn.Send(sse.SSEMessage{
                Event:     "heartbeat",
                Timestamp: time.Now().Unix(),
            })
        }
    }
}
```

### 5.4 通道实现示例

```go
// internal/sse/channels/sql_apply.go

package channels

import (
    "encoding/json"
    "time"
    
    "your-project/internal/sse"
)

// SQLApplyChannel SQL审批列表通道
type SQLApplyChannel struct {
    gateway   *sse.Gateway
    // 数据源，例如数据库或缓存
    dataProvider SQLApplyDataProvider
}

// SQLApplyDataProvider 数据提供者接口
type SQLApplyDataProvider interface {
    GetApplyList(params map[string]interface{}) (interface{}, error)
    WatchApplyChanges(callback func(data interface{}))
}

// NewSQLApplyChannel 创建通道
func NewSQLApplyChannel(gateway *sse.Gateway, provider SQLApplyDataProvider) *SQLApplyChannel {
    return &SQLApplyChannel{
        gateway:      gateway,
        dataProvider: provider,
    }
}

// Name 通道名称
func (c *SQLApplyChannel) Name() string {
    return "sql.apply.list"
}

// Subscribe 订阅
func (c *SQLApplyChannel) Subscribe(conn *sse.Connection, sub *sse.SubscriptionState) error {
    // 启动数据监听
    go c.watchData(conn, sub)
    return nil
}

// Unsubscribe 取消订阅
func (c *SQLApplyChannel) Unsubscribe(conn *sse.Connection, subID string) {
    // 清理资源
}

// GetInitialData 获取初始数据
func (c *SQLApplyChannel) GetInitialData(params map[string]interface{}) (interface{}, error) {
    return c.dataProvider.GetApplyList(params)
}

// watchData 监听数据变化
func (c *SQLApplyChannel) watchData(conn *sse.Connection, sub *sse.SubscriptionState) {
    // 这里可以使用 WebSocket 或轮询来监听数据变化
    // 示例：定期检查数据变化
    ticker := time.NewTicker(5 * time.Second)
    defer ticker.Stop()
    
    for {
        select {
        case <-ticker.C:
            // 检查数据是否有变化
            data, err := c.dataProvider.GetApplyList(sub.Params)
            if err != nil {
                continue
            }
            
            // 发送更新
            conn.Send(sse.NewSSEMessage(sub.ID, c.Name(), "data", data))
        }
    }
}
```

### 5.5 路由注册

```go
// internal/router/router.go

func SetupRoutes(r *mux.Router, gateway *sse.Gateway) {
    sseHandler := handler.NewSSEHandler(gateway)
    
    // SSE 端点
    r.HandleFunc("/sse/gateway", sseHandler.HandleGateway).Methods("GET")
    r.HandleFunc("/sse/subscribe", sseHandler.HandleSubscribe).Methods("POST")
    r.HandleFunc("/sse/unsubscribe", sseHandler.HandleUnsubscribe).Methods("POST")
}
```

---

## 6. 迁移策略

### 6.1 渐进式迁移路径

```
阶段 1: 基础设施 (1-2周)
├── 实现 SSEGateway 和 SubscriptionManager
├── 实现服务端 Gateway 和 Connection
├── 注册新端点 /sse/gateway
└── 不影响现有功能

阶段 2: 并行运行 (1-2周)
├── 实现各通道处理器
├── 新旧模式并存
├── 通过特性开关控制
└── 逐步验证各通道

阶段 3: 逐步迁移 (2-3周)
├── 迁移低优先级功能 (监控、BI)
├── 迁移中优先级功能 (任务中心)
├── 迁移高优先级功能 (SQL审批)
└── 每步都有回滚方案

阶段 4: 清理 (1周)
├── 移除旧 SSE 端点
├── 清理旧代码
├── 性能优化
└── 文档更新
```

### 6.2 特性开关

```typescript
// src/config/features.ts

export const FEATURE_FLAGS = {
  /** 启用 SSE 网关模式 */
  SSE_GATEWAY_ENABLED: false,
  
  /** 已迁移到网关的通道 */
  SSE_GATEWAY_CHANNELS: [] as string[],
};

// 检查是否使用网关模式
export function shouldUseGateway(channel: string): boolean {
  if (!FEATURE_FLAGS.SSE_GATEWAY_ENABLED) return false;
  return FEATURE_FLAGS.SSE_GATEWAY_CHANNELS.includes(channel);
}
```

### 6.3 兼容层

```typescript
// src/services/sse/compat.ts

import { shouldUseGateway } from '@/config/features';
import { SSEGateway } from './SSEGateway';
import { createSSEConnection } from '../sql/search';

/**
 * 兼容层：根据特性开关决定使用新旧哪种方式
 */
export function createCompatibleSSEConnection<T>(
  channel: string,
  legacyUrl: string,
  params: Record<string, unknown>,
  onMessage: (data: T) => void,
  onError?: (error: Event | Error) => void,
  onComplete?: () => void
) {
  if (shouldUseGateway(channel)) {
    // 使用新网关模式
    const gateway = SSEGateway.getInstance();
    const subscription = gateway.subscribe<T>({
      id: `compat_${channel}_${Date.now()}`,
      channel,
      params,
      onData: onMessage,
      onError: onError ? (err) => onError(err) : undefined,
      onComplete,
    });
    
    return {
      close: () => subscription.unsubscribe(),
      getStatus: () => subscription.state,
    };
  } else {
    // 使用旧模式
    return createSSEConnection(legacyUrl, onMessage, onError as any, onComplete);
  }
}
```

### 6.4 迁移检查清单

```markdown
## 阶段 1: 基础设施
- [ ] 客户端 SSEGateway 类实现
- [ ] 客户端 SubscriptionManager 实现
- [ ] 客户端 Hooks 实现
- [ ] 服务端 Gateway 实现
- [ ] 服务端 Connection 实现
- [ ] 服务端 HTTP 处理器
- [ ] 单元测试
- [ ] 集成测试

## 阶段 2: 并行运行
- [ ] sql.apply.list 通道实现
- [ ] sql.databi.tables 通道实现
- [ ] sql.export.list 通道实现
- [ ] tasks.list 通道实现
- [ ] tasks.detail 通道实现
- [ ] monitor.metrics 通道实现
- [ ] assets.project.detail 通道实现
- [ ] assets.record.detail 通道实现
- [ ] 特性开关配置
- [ ] 兼容层实现

## 阶段 3: 逐步迁移
- [ ] 监控页面迁移测试
- [ ] BI 页面迁移测试
- [ ] 任务中心迁移测试
- [ ] SQL 导出迁移测试
- [ ] SQL 审批迁移测试
- [ ] 项目更新迁移测试
- [ ] 性能测试
- [ ] 压力测试

## 阶段 4: 清理
- [ ] 移除旧 SSE 端点代码
- [ ] 移除兼容层代码
- [ ] 移除特性开关
- [ ] 文档更新
- [ ] 代码审查
```

---

## 7. 需要修改的文件清单

### 7.1 新增文件

```
src/services/sse/
├── SSEGateway.ts              # SSE 网关管理器
├── SubscriptionManager.ts     # 订阅管理器
├── types.ts                   # 类型定义
├── compat.ts                  # 兼容层
├── hooks/
│   ├── useSSESubscription.ts  # 订阅 Hook
│   └── useSSEChannel.ts       # 通道 Hook
└── channels/
    ├── index.ts               # 通道注册
    ├── sqlApply.ts            # SQL 审批通道
    ├── sqlExport.ts           # SQL 导出通道
    ├── databiTables.ts        # BI 表树通道
    ├── tasksList.ts           # 任务列表通道
    ├── tasksDetail.ts         # 任务详情通道
    ├── monitorMetrics.ts      # 监控指标通道
    ├── projectDetail.ts       # 项目详情通道
    └── recordDetail.ts        # 记录详情通道

src/config/
└── features.ts                # 特性开关配置
```

### 7.2 修改文件

| 文件路径 | 修改内容 |
|----------|----------|
| `src/services/sql/apply.ts` | 改用兼容层 `createCompatibleSSEConnection` |
| `src/services/sql/search.ts` | 保留 `createSSEConnection` 作为兼容层内部实现 |
| `src/services/sql/export.ts` | 改用兼容层 |
| `src/services/sql/databi.ts` | 改用兼容层 |
| `src/services/task.ts` | 改用兼容层 |
| `src/services/monitor/index.ts` | 改用兼容层 |
| `src/services/assets/index.ts` | 改用兼容层 |
| `src/stores/taskCenterStore.ts` | 改用 `useSSESubscription` Hook 或兼容层 |
| `src/pages/Sql/Apply/index.tsx` | 使用 `useSSEChannel` Hook |
| `src/pages/Sql/Export/index.tsx` | 使用 `useSSEChannel` Hook |
| `src/pages/Sql/Databi/hooks/useDatabiTables.ts` | 使用 `useSSEChannel` Hook |
| `src/components/TaskCenter/TaskItem.tsx` | 使用 `useSSEChannel` Hook |
| `src/pages/Monitor/Trafficswitching/index.tsx` | 使用 `useSSEChannel` Hook |
| `src/pages/Monitor/Hard/index.tsx` | 使用 `useSSEChannel` Hook |
| `src/pages/Monitor/Container/index.tsx` | 使用 `useSSEChannel` Hook |
| `src/pages/Assets/ProUpdate/components/ProjectDetailDrawer.tsx` | 使用 `useSSEChannel` Hook |
| `src/pages/Assets/ProUpdate/components/RecordDetailDialog.tsx` | 使用 `useSSEChannel` Hook |

### 7.3 服务端新增文件

```
internal/sse/
├── gateway.go           # 网关核心逻辑
├── connection.go        # 连接管理
├── message.go           # 消息定义
├── subscription.go      # 订阅管理
└── channels/
    ├── channel.go       # 通道接口
    ├── sql_apply.go     # SQL 审批通道
    ├── sql_export.go    # SQL 导出通道
    ├── databi.go        # BI 通道
    ├── tasks.go         # 任务通道
    ├── monitor.go       # 监控通道
    └── assets.go        # 资产通道

internal/handler/
└── sse.go               # HTTP 处理器

internal/router/
└── router.go            # 路由注册 (修改)
```

---

## 8. 性能与监控

### 8.1 性能指标

| 指标 | 目标值 | 监控方式 |
|------|--------|----------|
| 连接数 | 每用户 1 个 | 服务端指标 |
| 消息延迟 | < 100ms | 客户端日志 |
| 订阅切换 | < 200ms | 客户端日志 |
| 内存占用 | < 10MB/连接 | 服务端监控 |

### 8.2 监控埋点

```typescript
// 客户端监控
SSEGateway.getInstance().on('stateChange', (state) => {
  analytics.track('sse_state_change', { state });
});

SSEGateway.getInstance().on('message', (msg) => {
  analytics.track('sse_message_received', {
    channel: msg.channel,
    latency: Date.now() - msg.timestamp * 1000,
  });
});
```

---

## 9. 风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 网关单点故障 | 所有实时功能不可用 | 快速回退到旧模式 |
| 消息丢失 | 数据不一致 | 客户端定期轮询补偿 |
| 内存泄漏 | 服务端 OOM | 连接超时清理、内存监控 |
| 订阅风暴 | 服务端压力过大 | 限流、队列缓冲 |

---

## 10. 总结

本方案通过 SSE 网关 + 订阅模式，将 8 个独立 SSE 端点整合为单一连接，具有以下优势：

1. **资源优化**：从 8 个连接减少到 1 个，降低服务端和客户端资源消耗
2. **代码复用**：统一的连接管理、重连、错误处理逻辑
3. **灵活扩展**：新增实时功能只需实现通道，无需新建连接
4. **渐进迁移**：兼容层确保平滑过渡，降低风险

预计总工期：**5-8 周**
