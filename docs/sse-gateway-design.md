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

---

## 11. 服务端事件驱动实现（已落地）

### 11.1 设计思路

**核心问题**：原有 SSE 端点使用定时轮询（2-3 秒查一次 MySQL），大部分查询是浪费的。

**解决方案**：事件驱动 + 兜底轮询

```
业务写入（创建/更新/删除）
    ↓
发布事件 → Redis Pub/Sub
    ↓
SSE 端点收到事件 → 查 MySQL → 推给客户端
    ↓
兜底轮询（30秒，防止事件丢失）
```

**效果**：没人操作时 0 次查询/秒，有人操作时 1 次查询/秒推给所有人。

### 11.2 事件总线实现

#### 文件：`pkg/eventbus/eventbus.go`

```go
package eventbus

import (
    "cmdb/pkg/database"
    "context"
    "github.com/redis/go-redis/v9"
)

// 频道常量
const (
    SQLApply  = "sse:events:sql_apply"  // SQL审批
    SQLExport = "sse:events:sql_export" // SQL导出
    Task      = "sse:events:task"       // 任务中心
    ProUpdate = "sse:events:pro_update" // 项目发版
    DataBI    = "sse:events:databi"     // DataBI刷新
)

// Publish 发布事件
func Publish(ctx context.Context, channel string) error {
    return database.RDB.Publish(ctx, channel, "changed").Err()
}

// Subscribe 订阅指定频道
func Subscribe(ctx context.Context, channels ...string) *redis.PubSub {
    return database.RDB.Subscribe(ctx, channels...)
}
```

### 11.3 事件发布点

在每个业务写入点（Create/Update/Delete）后发布事件：

```go
// 示例：api/sql/apply/applyCreate.go
// 创建审批后
if err := database.DB.Create(apply).Error; err != nil {
    // 错误处理...
}

// 发布事件（通知SSE端点数据已变化）
go eventbus.Publish(context.Background(), eventbus.SQLApply)

// 发送飞书通知...
```

#### 事件发布点清单

| 模块 | 文件 | 触发时机 | 事件频道 |
|------|------|---------|---------|
| SQL审批 | `api/sql/apply/applyCreate.go` | 创建审批 | `SQLApply` |
| SQL审批 | `api/sql/apply/applyUpdate.go` | 更新审批状态 | `SQLApply` |
| SQL审批 | `api/sql/apply/applyFeiShuCallback.go` | 飞书卡片回调 | `SQLApply` |
| SQL导出 | `api/sql/export/exportCreate.go` | 创建导出 | `SQLExport` |
| SQL导出 | `api/sql/export/exportUpdate.go` | 更新导出状态 | `SQLExport` |
| 任务中心 | `api/task/taskManager.go` | 任务创建 | `Task` |
| 任务中心 | `api/task/taskManager.go` | 任务状态变更 | `Task` |
| 任务中心 | `api/task/taskManager.go` | 任务完成/失败 | `Task` |
| 任务中心 | `api/task/taskManager.go` | 任务取消 | `Task` |
| 发版记录 | `api/assets/proUpdate/proUpdateRecords.go` | 任务信息更新 | `ProUpdate` |
| 发版记录 | `api/assets/proUpdate/proUpdateRecords.go` | 步骤信息更新 | `ProUpdate` |
| DataBI | `api/sql/databi/databiCache.go` | 刷新状态保存 | `DataBI` |

### 11.4 SSE 端点改造

#### 改造前（轮询模式）

```go
ticker := time.NewTicker(3 * time.Second)
defer ticker.Stop()

for {
    select {
    case <-ctx.Done():
        return
    case <-ticker.C:
        data := queryDB()  // 每次都查库
        push(data)
    }
}
```

#### 改造后（事件驱动 + 兜底）

```go
// 订阅Redis事件频道
pubsub := database.RDB.Subscribe(ctx, eventbus.SQLApply)
defer pubsub.Close()

// 兜底轮询（30秒）
ticker := time.NewTicker(30 * time.Second)
defer ticker.Stop()

eventCh := pubsub.Channel()

for {
    select {
    case <-ctx.Done():
        return
    case <-eventCh:
        // 收到事件，查库推送
        data := queryDB()
        push(data)
    case <-ticker.C:
        // 兜底：30秒还没事件也查一次
        data := queryDB()
        push(data)
    }
}
```

### 11.5 改造后的 SSE 端点

| 端点 | 兜底间隔 | 改造说明 |
|------|---------|---------|
| `/sql/apply/list` | 30 秒 | 订阅 `SQLApply` 频道 |
| `/sql/export/list` | 30 秒 | 订阅 `SQLExport` 频道 |
| `/tasks/list` | 10 秒 | 订阅 `Task` 频道 |
| `/tasks/detail` | 10 秒 | 订阅 `Task` 频道 |
| `/assets/proUpdate/list-detail` | 30 秒 | 订阅 `ProUpdate` 频道 |
| `/assets/proUpdate/records-detail` | 10 秒 | 订阅 `ProUpdate` 频道 |
| `/assets/proUpdate/mobile/sse` | 10 秒 | 订阅 `ProUpdate` 频道 |
| `/sql/databi/tables` | 1 秒 | 订阅 `DataBI` 频道（刷新过程需实时） |

### 11.6 事件流程图

```
用户提交SQL审批
    ↓
POST /api/sql/apply/create
    ↓
database.DB.Create(apply)
    ↓
go eventbus.Publish(ctx, "sse:events:sql_apply")
    ↓
Redis Pub/Sub 广播
    ↓
所有订阅了 SQLApply 的 SSE 连接收到通知
    ↓
各连接查询 MySQL，获取最新数据
    ↓
比较 hash，有变化则推送给客户端
```

### 11.7 性能对比

| 指标 | 改造前 | 改造后 |
|------|--------|--------|
| 10 用户在线，无人操作 | 3.3 次/秒查询 | **0 次/秒** |
| 10 用户在线，有人操作 | 3.3 次/秒查询 | **1 次/秒** |
| 推送延迟 | 2-3 秒（轮询间隔） | **< 100ms**（事件驱动） |
| 事件丢失防护 | 无 | **兜底轮询**（1-30 秒） |

### 11.8 新增模块接入指南

新增一个实时推送功能，只需 3 步：

#### 第 1 步：在 eventbus 中注册频道

```go
// pkg/eventbus/eventbus.go
const (
    // ... 已有频道
    NewModule = "sse:events:new_module"  // 新模块
)
```

#### 第 2 步：在写入点发布事件

```go
// api/newmodule/create.go
if err := database.DB.Create(&record).Error; err != nil {
    // 错误处理
}

// 发布事件
go eventbus.Publish(context.Background(), eventbus.NewModule)
```

#### 第 3 步：SSE 端点订阅事件

```go
// api/newmodule/list.go
pubsub := database.RDB.Subscribe(ctx, eventbus.NewModule)
defer pubsub.Close()

ticker := time.NewTicker(30 * time.Second) // 兜底
defer ticker.Stop()

eventCh := pubsub.Channel()

for {
    select {
    case <-ctx.Done():
        return
    case <-eventCh:
        data := queryDB()
        push(data)
    case <-ticker.C:
        data := queryDB()
        push(data)
    }
}
```

### 11.9 文件变更清单

#### 新增文件

| 文件 | 说明 |
|------|------|
| `pkg/eventbus/eventbus.go` | 事件总线（Redis Pub/Sub 封装） |

#### 修改文件

| 文件 | 改动 |
|------|------|
| `api/sql/apply/applyCreate.go` | 新增事件发布 |
| `api/sql/apply/applyUpdate.go` | 新增事件发布 |
| `api/sql/apply/applyFeiShuCallback.go` | 新增事件发布 |
| `api/sql/apply/applyList.go` | SSE 改为事件驱动 |
| `api/sql/export/exportCreate.go` | 新增事件发布 |
| `api/sql/export/exportUpdate.go` | 新增事件发布（2处） |
| `api/sql/export/exportList.go` | SSE 改为事件驱动 |
| `api/task/taskManager.go` | 新增事件发布（4处） |
| `api/task/taskAPI.go` | 2 个 SSE 端点改为事件驱动 |
| `api/assets/proUpdate/proUpdateRecords.go` | 新增事件发布（2处） |
| `api/assets/proUpdate/proUpdateListDetail.go` | SSE 改为事件驱动 |
| `api/assets/proUpdate/proUpdateRecordDetail.go` | SSE 改为事件驱动 |
| `api/assets/proUpdate/proUpdateMobile.go` | SSE 改为事件驱动 |
| `api/sql/databi/databiCache.go` | 新增事件发布 |
| `api/sql/databi/databiTables.go` | SSE 改为事件驱动 |

### 11.10 后续演进方向

当前事件驱动已解决"频繁查库"问题，后续可演进：

1. ~~**SSE 网关合并**：将 8 个独立 SSE 端点合并为 1 个网关端点（解决浏览器 6 连接限制）~~ ✅ 已实现
2. **事件携带数据**：事件消息中携带变更摘要，SSE 端点可跳过部分查询
3. **内存事件总线**：对于单实例部署，可用 Go Channel 替代 Redis Pub/Sub，减少网络开销
4. **事件持久化**：将事件写入 Redis List，支持事件重放和审计

---

## 12. SSE 网关实现（已落地）

### 12.1 设计思路

**核心问题**：原有 8 个独立 SSE 端点，每个页面打开都创建新连接，浏览器 6 连接限制导致排队。

**解决方案**：统一 SSE 网关 + 通道订阅模式

```
客户端（1 个 SSE 连接）
    │
    ├─ GET /sse/gateway?token=xxx    → 建立连接
    ├─ POST /sse/subscribe            → 订阅通道
    └─ POST /sse/unsubscribe          → 取消订阅
    │
服务端
    │
    ├─ Gateway 管理所有连接
    ├─ Channel 监听事件（Redis Pub/Sub）
    └─ 收到事件 → 查数据库 → 推给订阅者
```

### 12.2 目录结构

```
api/sse/
├── message.go              # 消息类型定义
├── gateway.go              # 连接管理 + 订阅管理 + 广播
├── handler.go              # HTTP 处理器
└── channels/
    ├── channel.go          # Channel 接口
    ├── sql_apply.go        # SQL审批通道
    ├── sql_export.go       # SQL导出通道
    ├── tasks.go            # 任务列表通道
    ├── tasks_detail.go     # 任务详情通道
    ├── pro_update.go       # 发版记录详情通道
    ├── databi.go           # DataBI表树通道
    └── monitor.go          # 监控指标通道

routers/
├── sse.go                  # SSE 路由注册
└── path/
    └── sse.go              # 路径常量
```

### 12.3 核心结构

#### 连接管理（`api/sse/gateway.go`）

```go
// Connection SSE 连接
type Connection struct {
    ID            string
    UserID        int64
    Writer        chan Message          // 消息缓冲区
    Subscriptions map[string]*Subscription // 订阅列表
    CreatedAt     time.Time
}

// Gateway SSE 网关
type Gateway struct {
    connections map[string]*Connection  // connID -> Connection
    userConns   map[int64][]string      // userID -> connectionIDs
}
```

#### 通道接口（`api/sse/channels/channel.go`）

```go
type Channel interface {
    Name() string
    StartWatching(conn *Connection, subID string, params map[string]interface{}, userID int64)
    StopWatching(connID string, subID string)
}
```

### 12.4 API 接口

#### 建立 SSE 连接

```
GET /sse/gateway?token={jwt_token}
```

**连接建立后，服务端发送：**
```json
{
  "event": "connected",
  "data": {
    "connection_id": "conn_abc123",
    "server_time": 1716800000
  }
}
```

#### 订阅通道

```
POST /sse/subscribe
Content-Type: application/json
Authorization: Bearer {token}
```

```json
{
  "connection_id": "conn_abc123",
  "subscriptions": [
    {
      "id": "sub_sql_apply_001",
      "channel": "sql.apply.list",
      "params": {
        "submitter_name": ""
      }
    },
    {
      "id": "sub_tasks_list_001",
      "channel": "tasks.list",
      "params": {
        "type": "analysis"
      }
    }
  ]
}
```

#### 取消订阅

```
POST /sse/unsubscribe
Content-Type: application/json
Authorization: Bearer {token}
```

```json
{
  "connection_id": "conn_abc123",
  "subscription_ids": ["sub_sql_apply_001"]
}
```

#### 服务端推送消息格式

```json
{
  "subscription_id": "sub_sql_apply_001",
  "channel": "sql.apply.list",
  "event": "data",
  "data": { ... },
  "timestamp": 1716800000
}
```

### 12.5 通道实现

| 通道名 | 文件 | 事件源 | 兜底间隔 |
|--------|------|--------|---------|
| `sql.apply.list` | `channels/sql_apply.go` | Redis Pub/Sub | 30 秒 |
| `sql.export.list` | `channels/sql_export.go` | Redis Pub/Sub | 30 秒 |
| `tasks.list` | `channels/tasks.go` | Redis Pub/Sub | 10 秒 |
| `tasks.detail` | `channels/tasks_detail.go` | Redis Pub/Sub | 10 秒 |
| `assets.record.detail` | `channels/pro_update.go` | Redis Pub/Sub | 10 秒 |
| `sql.databi.tables` | `channels/databi.go` | Redis Pub/Sub | 1 秒 |
| `monitor.metrics` | `channels/monitor.go` | 轮询（无事件源） | 5 秒 |

#### 通道实现示例（SQL审批）

```go
func (c *SQLApplyChannel) StartWatching(conn *sse.Connection, subID string, params map[string]interface{}, userID int64) {
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    // 发送初始数据
    data := c.getInitialData(params, userID)
    c.sendToConn(conn, subID, data)

    // 订阅 Redis 事件
    pubsub := database.RDB.Subscribe(ctx, eventbus.SQLApply)
    defer pubsub.Close()

    eventCh := pubsub.Channel()
    ticker := time.NewTicker(30 * time.Second) // 兜底
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return
        case <-eventCh:
            // 收到事件，查库推送
            data := c.getInitialData(params, userID)
            c.sendToConn(conn, subID, data)
        case <-ticker.C:
            // 兜底：30秒还没事件也查一次
            data := c.getInitialData(params, userID)
            c.sendToConn(conn, subID, data)
        }
    }
}
```

### 12.6 路由注册

```go
// routers/sse.go
func InitSSERoutes(mux *http.ServeMux) {
    gateway := sse.NewGateway()
    handler := sse.NewHandler(gateway)

    // 注册通道
    handler.RegisterChannel(channels.NewSQLApplyChannel())
    handler.RegisterChannel(channels.NewSQLExportChannel())
    handler.RegisterChannel(channels.NewTasksChannel())
    handler.RegisterChannel(channels.NewTaskDetailChannel())
    handler.RegisterChannel(channels.NewProUpdateDetailChannel())
    handler.RegisterChannel(channels.NewDataBITablesChannel())
    handler.RegisterChannel(channels.NewMonitorMetricsChannel())

    // 注册路由（走 JWTAuth 处理 CORS）
    mux.HandleFunc(path.SSEGatewayPath, utils.JWTAuth(handler.HandleGateway, "", "", "SSE网关"))
    mux.HandleFunc(path.SSESubscribePath, utils.JWTAuth(handler.HandleSubscribe, "", "", "SSE订阅"))
    mux.HandleFunc(path.SSEUnsubscribePath, utils.JWTAuth(handler.HandleUnsubscribe, "", "", "SSE取消订阅"))
}
```

#### WhiteList 白名单

```go
// utils/jwt.go
path.SSEGatewayPath:     true, // SSE网关（token通过query参数传递）
path.SSESubscribePath:   true, // SSE订阅
path.SSEUnsubscribePath: true, // SSE取消订阅
```

### 12.7 完整数据流

```
用户打开 SQL 审批页面
    │
    ├─ 1. GET /sse/gateway?token=xxx
    │     → JWTAuth 设置 CORS + 白名单放行
    │     → 创建 Connection，返回 connection_id
    │
    ├─ 2. POST /sse/subscribe
    │     { connection_id, subscriptions: [{ id: "sub_001", channel: "sql.apply.list", params: {} }] }
    │     → Gateway.Subscribe() 添加订阅
    │     → Channel.StartWatching() 启动事件监听
    │     → 发送初始数据
    │
    ├─ 3. 用户提交 SQL 审批
    │     → applyCreate.go 写入 MySQL
    │     → go eventbus.Publish(ctx, "sse:events:sql_apply")
    │
    ├─ 4. Redis Pub/Sub 广播事件
    │     → Channel.StartWatching() 收到事件
    │     → 查询 MySQL 获取最新数据
    │     → 比较 hash，有变化则推送给客户端
    │
    └─ 5. 用户关闭页面
          → GET /sse/gateway 连接断开
          → Gateway.RemoveConnection() 清理
          → Channel.StopWatching() 停止监听
```

### 12.8 文件变更清单

#### 新增文件（12 个）

| 文件 | 说明 |
|------|------|
| `api/sse/message.go` | 消息类型定义 |
| `api/sse/gateway.go` | 连接管理 + 订阅管理 + 广播 |
| `api/sse/handler.go` | HTTP 处理器 |
| `api/sse/channels/channel.go` | Channel 接口 |
| `api/sse/channels/sql_apply.go` | SQL审批通道 |
| `api/sse/channels/sql_export.go` | SQL导出通道 |
| `api/sse/channels/tasks.go` | 任务列表通道 |
| `api/sse/channels/tasks_detail.go` | 任务详情通道 |
| `api/sse/channels/pro_update.go` | 发版记录详情通道 |
| `api/sse/channels/databi.go` | DataBI表树通道 |
| `api/sse/channels/monitor.go` | 监控指标通道 |
| `routers/sse.go` | SSE 路由注册 |
| `routers/path/sse.go` | 路径常量 |

#### 修改文件（2 个）

| 文件 | 改动 |
|------|------|
| `routers/router.go` | 新增 `InitSSERoutes` |
| `utils/jwt.go` | 新增 3 个 WhiteList 条目 |

### 12.9 新增通道接入指南

新增一个实时推送功能，只需 2 步：

#### 第 1 步：实现 Channel 接口

```go
// api/sse/channels/new_channel.go
package channels

type NewChannel struct {
    watchers map[string]*watcher
    mu       sync.RWMutex
}

func NewNewChannel() *NewChannel {
    return &NewChannel{watchers: make(map[string]*watcher)}
}

func (c *NewChannel) Name() string {
    return "new.channel"
}

func (c *NewChannel) StartWatching(conn *sse.Connection, subID string, params map[string]interface{}, userID int64) {
    ctx, cancel := context.WithCancel(context.Background())
    c.mu.Lock()
    c.watchers[subID] = &watcher{connID: conn.ID, subID: subID, cancel: cancel}
    c.mu.Unlock()

    // 发送初始数据
    data := c.getInitialData(params, userID)
    c.sendToConn(conn, subID, data)

    // 订阅事件
    pubsub := database.RDB.Subscribe(ctx, eventbus.NewModule)
    defer pubsub.Close()

    eventCh := pubsub.Channel()
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return
        case <-eventCh:
            data := c.getInitialData(params, userID)
            c.sendToConn(conn, subID, data)
        case <-ticker.C:
            data := c.getInitialData(params, userID)
            c.sendToConn(conn, subID, data)
        }
    }
}

func (c *NewChannel) StopWatching(connID string, subID string) {
    c.mu.Lock()
    defer c.mu.Unlock()
    if w, ok := c.watchers[subID]; ok {
        w.cancel()
        delete(c.watchers, subID)
    }
}
```

#### 第 2 步：注册通道

```go
// routers/sse.go
handler.RegisterChannel(channels.NewNewChannel())
```

### 12.10 与事件驱动的关系

SSE 网关和事件驱动是**互补**的两层：

| 层 | 解决的问题 | 实现方式 |
|----|-----------|---------|
| 事件驱动 | 查询太频繁 | Redis Pub/Sub + 业务写入点发布事件 |
| SSE 网关 | 连接数过多 | 统一连接 + 通道订阅 + 事件路由 |

两者结合后的完整架构：

```
业务写入 → 发布事件（Redis Pub/Sub）
                ↓
        SSE 网关 Channel 收到事件
                ↓
        查询数据库获取最新数据
                ↓
        推给所有订阅了该通道的客户端
```

### 12.11 性能对比

| 指标 | 改造前（8 个独立 SSE） | 改造后（SSE 网关） |
|------|----------------------|-------------------|
| 每用户连接数 | 8 个 | **1 个** |
| 浏览器并发压力 | 容易触发 6 连接限制 | **无压力** |
| 代码重复度 | 每个端点重复实现连接/重连/错误处理 | **统一管理** |
| 新增实时功能 | 需要新建端点 + 路由 + CORS + 白名单 | **只需实现 Channel** |
| 事件驱动 | 各端点独立订阅 | **网关统一订阅** |
