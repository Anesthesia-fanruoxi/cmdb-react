/**
 * SSE 兼容层
 * 根据特性开关决定使用新网关模式还是旧模式
 */

import { shouldUseGateway } from '@/config/features';
import { SSEGateway } from './SSEGateway';

/** 兼容层返回的连接对象（与旧 createSSEConnection 接口一致） */
export interface CompatibleSSEConnection {
  close: () => void;
  getStatus: () => string;
  readyState?: number;
}

/**
 * 创建兼容的 SSE 连接
 * - 如果通道已迁移到网关，使用新模式
 * - 否则使用旧模式（调用旧函数）
 */
export function createGatewayConnection<T>(
  channel: string,
  params: Record<string, unknown>,
  onMessage: (data: T) => void,
  onError?: (error: Error) => void,
  onComplete?: () => void,
): CompatibleSSEConnection | null {
  if (!shouldUseGateway(channel)) return null;

  const baseUrl = import.meta.env.VITE_SSE_BASE_URL || import.meta.env.VITE_API_BASE_URL || '';
  const gateway = SSEGateway.getInstance({
    url: `${baseUrl}/gateway`,
    subscribeApiUrl: baseUrl,
  });

  // 确保连接
  if (gateway.getState() === 'closed') {
    gateway.connect();
  }

  const subscription = gateway.subscribe<T>({
    id: `compat_${channel}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    channel,
    params,
    onData: onMessage,
    onError,
    onComplete,
  });

  return {
    close: () => subscription.unsubscribe(),
    getStatus: () => subscription.state,
  };
}
