/**
 * SSE 网关 + 订阅模式 导出入口
 */

export { SSEGateway } from './SSEGateway';
export { SubscriptionManager } from './SubscriptionManager';
export { useSSESubscription } from './hooks/useSSESubscription';
export { useSSEChannel } from './hooks/useSSEChannel';
export type {
  SSEConnectionState,
  SubscriptionState,
  GatewayConfig,
  SubscriptionConfig,
  Subscription,
  SSEMessage,
  SubscribeRequest,
  UnsubscribeRequest,
  ChannelParams,
  SubscriptionInfo,
  BufferedMessage,
} from './types';
export { CHANNELS } from './types';
