/**
 * SSE 网关 + 订阅模式 类型定义
 */

/** SSE 连接状态 */
export type SSEConnectionState = 'connecting' | 'open' | 'closed' | 'reconnecting';

/** 订阅状态 */
export type SubscriptionState = 'pending' | 'active' | 'paused' | 'error' | 'closed';

/** 网关配置 */
export interface GatewayConfig {
  /** SSE 端点 URL */
  url: string;
  /** 重连间隔 (ms) */
  reconnectInterval?: number;
  /** 最大重连次数 */
  maxReconnectAttempts?: number;
  /** 订阅 API 基础 URL */
  subscribeApiUrl?: string;
}

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
  /** 占位符，保持泛型类型一致 */
  _data?: T;
}

/** SSE 消息（服务端推送） */
export interface SSEMessage<T = unknown> {
  subscription_id?: string;
  channel?: string;
  event: 'data' | 'complete' | 'error' | 'connected' | 'heartbeat';
  data?: T;
  timestamp?: number;
  error?: {
    code: string;
    message: string;
  };
}

/** 订阅请求（发送给服务端） */
export interface SubscribeRequest {
  connection_id: string;
  subscriptions: Array<{
    id: string;
    channel: string;
    params: Record<string, unknown>;
  }>;
}

/** 取消订阅请求（发送给服务端） */
export interface UnsubscribeRequest {
  connection_id: string;
  subscription_ids: string[];
}

/** 通道名称常量 */
export const CHANNELS = {
  SQL_APPLY_LIST: 'sql.apply.list',
  SQL_DATABI_TABLES: 'sql.databi.tables',
  SQL_EXPORT_LIST: 'sql.export.list',
  TASKS_LIST: 'tasks.list',
  TASKS_DETAIL: 'tasks.detail',
  MONITOR_METRICS: 'monitor.metrics',
  ASSETS_PROJECT_DETAIL: 'assets.project.detail',
  ASSETS_RECORD_DETAIL: 'assets.record.detail',
} as const;

/** 通道参数定义 */
export interface ChannelParams {
  'sql.apply.list': {
    submitter_name?: string;
    status?: string;
  };
  'sql.databi.tables': {
    project: string;
  };
  'sql.export.list': Record<string, never>;
  'tasks.list': {
    type: string;
    keyword?: string;
  };
  'tasks.detail': {
    task_id: string;
  };
  'monitor.metrics': {
    project: string;
    category: string;
    service?: string;
    namespace?: string;
  };
  'assets.project.detail': {
    project: string;
    type?: string;
  };
  'assets.record.detail': {
    task_id: string;
  };
}

/** 订阅信息快照（供监控面板读取） */
export interface SubscriptionInfo {
  id: string;
  channel: string;
  params: Record<string, unknown>;
  state: SubscriptionState;
  /** 创建时间戳 */
  createdAt: number;
  /** 订阅后收到的消息数 */
  msgCount: number;
}

/** 环形缓冲消息项 */
export interface BufferedMessage {
  /** 推送到前端的时间戳 */
  ts: number;
  /** 订阅 ID（可能为空，例如 channel 广播消息） */
  subscriptionId?: string;
  /** 频道名 */
  channel?: string;
  /** 事件类型 */
  event: SSEMessage['event'];
  /** 完整原始消息 */
  raw: SSEMessage;
}
