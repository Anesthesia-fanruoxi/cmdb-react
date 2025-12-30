/**
 * 时间范围管理 Hook
 */

import { useState, useCallback, useMemo } from 'react';
import type { TimeRangeType } from '../../../types/monitor';

/** 时间范围选项配置 */
export const TIME_RANGE_OPTIONS = [
  { label: '1小时', value: '1h' as TimeRangeType, seconds: 3600 },
  { label: '3小时', value: '3h' as TimeRangeType, seconds: 10800 },
  { label: '6小时', value: '6h' as TimeRangeType, seconds: 21600 },
  { label: '12小时', value: '12h' as TimeRangeType, seconds: 43200 },
  { label: '1天', value: '1d' as TimeRangeType, seconds: 86400 },
  { label: '3天', value: '3d' as TimeRangeType, seconds: 259200 },
  { label: '7天', value: '7d' as TimeRangeType, seconds: 604800 },
  { label: '30天', value: '30d' as TimeRangeType, seconds: 2592000 },
];

interface UseTimeRangeOptions {
  defaultRange?: TimeRangeType;
}

export function useTimeRange(options: UseTimeRangeOptions = {}) {
  const { defaultRange = '1h' } = options;
  
  const [timeRange, setTimeRange] = useState<TimeRangeType>(defaultRange);
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  /** 获取时间范围参数 */
  const getTimeParams = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    
    if (timeRange === 'custom' && customStart && customEnd) {
      return {
        start: Math.floor(new Date(customStart).getTime() / 1000),
        end: Math.floor(new Date(customEnd).getTime() / 1000),
      };
    }
    
    const option = TIME_RANGE_OPTIONS.find(o => o.value === timeRange);
    const seconds = option?.seconds || 3600;
    
    return {
      start: now - seconds,
      end: now,
    };
  }, [timeRange, customStart, customEnd]);

  /** 格式化时间戳为日期字符串 */
  const formatTimestamp = useCallback((timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }, []);

  /** 获取格式化的时间参数 */
  const getFormattedTimeParams = useCallback(() => {
    const { start, end } = getTimeParams();
    return {
      start: formatTimestamp(start),
      end: formatTimestamp(end),
    };
  }, [getTimeParams, formatTimestamp]);

  /** 当前选中的时间范围标签 */
  const currentLabel = useMemo(() => {
    if (timeRange === 'custom') return '自定义';
    return TIME_RANGE_OPTIONS.find(o => o.value === timeRange)?.label || '1小时';
  }, [timeRange]);

  return {
    timeRange,
    setTimeRange,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    getTimeParams,
    getFormattedTimeParams,
    formatTimestamp,
    currentLabel,
    timeRangeOptions: TIME_RANGE_OPTIONS,
  };
}
