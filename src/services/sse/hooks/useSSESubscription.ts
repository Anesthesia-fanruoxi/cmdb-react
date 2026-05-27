/**
 * SSE 订阅 Hook
 * 自动管理订阅生命周期（组件挂载时订阅，卸载时取消）
 */

import { useEffect, useRef, useCallback } from 'react';
import { SSEGateway } from '../SSEGateway';
import type { Subscription } from '../types';

interface UseSSESubscriptionOptions<T> {
  /** 通道名称 */
  channel: string;
  /** 订阅参数 */
  params: Record<string, unknown>;
  /** 数据回调 */
  onData: (data: T) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
  /** 完成回调 */
  onComplete?: () => void;
  /** 是否启用（false 时不订阅） */
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

  // 生成稳定的订阅 ID
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
