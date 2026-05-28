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

  // 使用 useRef 保持对最新回调函数的引用，避免回调函数引用变化引起重新订阅
  const onDataRef = useRef(onData);
  const onErrorRef = useRef(onError);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onDataRef.current = onData;
    onErrorRef.current = onError;
    onCompleteRef.current = onComplete;
  }); // 每次渲染都更新最新引用

  // 生成稳定的订阅 ID
  const subscriptionId = useRef(
    `sub_${channel}_${Math.random().toString(36).slice(2, 8)}`
  ).current;

  // 将参数序列化，只有当参数真正发生变化时才触发重新订阅
  const paramsStr = JSON.stringify(params);

  const subscribe = useCallback(() => {
    if (!enabled) return;

    let gateway = SSEGateway.getInstance();
    if (!gateway) {
      const baseUrl = import.meta.env.VITE_SSE_BASE_URL || import.meta.env.VITE_API_BASE_URL || '';
      SSEGateway.getInstance({ url: `${baseUrl}/gateway`, subscribeApiUrl: baseUrl });
      gateway = SSEGateway.getInstance()!;
    }

    // 确保连接
    if (gateway.getState() === 'closed') {
      gateway.connect();
    }

    subscriptionRef.current = gateway.subscribe<T>({
      id: subscriptionId,
      channel,
      params: JSON.parse(paramsStr),
      onData: (data) => onDataRef.current(data),
      onError: (error) => onErrorRef.current?.(error),
      onComplete: () => onCompleteRef.current?.(),
    });
  }, [channel, enabled, subscriptionId, paramsStr]);

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
