/**
 * SSE 通道 Hook
 * 封装订阅逻辑，提供 data/loading/error 状态
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSSESubscription } from './useSSESubscription';

interface UseSSEChannelOptions {
  /** 通道名称 */
  channel: string;
  /** 订阅参数 */
  params: Record<string, unknown>;
  /** 是否启用（默认 true） */
  enabled?: boolean;
}

interface UseSSEChannelResult<T> {
  /** 最新数据 */
  data: T | null;
  /** 加载状态（首次收到数据前为 true） */
  loading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 订阅实例 */
  subscription: ReturnType<typeof useSSESubscription>['subscription'];
}

export function useSSEChannel<T>({
  channel,
  params,
  enabled = true,
}: UseSSEChannelOptions): UseSSEChannelResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 使用 ref 避免闭包问题
  const dataRef = useRef(data);
  dataRef.current = data;

  const handleData = useCallback((newData: T) => {
    setData(newData);
    setLoading(false);
    setError(null);
  }, []);

  const handleError = useCallback((err: Error) => {
    setError(err);
    setLoading(false);
  }, []);

  const { subscription } = useSSESubscription<T>({
    channel,
    params,
    onData: handleData,
    onError: handleError,
    enabled,
  });

  // 当参数变化时，重置 loading 状态
  useEffect(() => {
    if (enabled) {
      setLoading(true);
      setError(null);
    }
  }, [JSON.stringify(params), enabled]);

  return {
    data,
    loading,
    error,
    subscription,
  };
}
