/**
 * 自动刷新 Hook
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseAutoRefreshOptions {
  defaultEnabled?: boolean;
  defaultInterval?: number;
  onRefresh: () => void | Promise<void>;
}

export function useAutoRefresh(options: UseAutoRefreshOptions) {
  const { defaultEnabled = false, defaultInterval = 60, onRefresh } = options;
  
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [interval, setInterval] = useState(defaultInterval);
  const [countdown, setCountdown] = useState(defaultInterval);
  const timerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  /** 清除定时器 */
  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  /** 启动自动刷新 */
  const startAutoRefresh = useCallback(() => {
    clearTimers();
    setCountdown(interval);
    
    // 倒计时
    countdownRef.current = window.setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return interval;
        return prev - 1;
      });
    }, 1000);
    
    // 刷新定时器
    timerRef.current = window.setInterval(() => {
      onRefresh();
      setCountdown(interval);
    }, interval * 1000);
  }, [interval, onRefresh, clearTimers]);

  /** 停止自动刷新 */
  const stopAutoRefresh = useCallback(() => {
    clearTimers();
    setCountdown(interval);
  }, [clearTimers, interval]);

  // 监听启用状态变化
  useEffect(() => {
    if (enabled) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
    return clearTimers;
  }, [enabled, startAutoRefresh, stopAutoRefresh, clearTimers]);

  // 监听间隔变化
  useEffect(() => {
    if (enabled) {
      startAutoRefresh();
    }
  }, [interval, enabled, startAutoRefresh]);

  /** 切换启用状态 */
  const toggle = useCallback(() => {
    setEnabled(prev => !prev);
  }, []);

  return {
    enabled,
    setEnabled,
    interval,
    setInterval,
    countdown,
    toggle,
  };
}
