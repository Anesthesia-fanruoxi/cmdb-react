/**
 * 监控数据格式化工具
 */

import type { DataStandard } from '../../../types/monitor';

/**
 * 根据数据标准格式化数值
 */
export function formatValue(value: number, standard: DataStandard = 'default'): string {
  if (isNaN(value)) return '-';
  
  switch (standard) {
    case 'percent(1-100)':
      return `${value.toFixed(2)}%`;
    case 'percent(0-1)':
      return `${(value * 100).toFixed(2)}%`;
    case 'data(b)':
      return formatBytes(value);
    case 'data(kb)':
      return formatBytes(value * 1024);
    default:
      return value.toFixed(2);
  }
}

/**
 * 格式化字节数
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * 格式化时间戳
 */
export function formatTimestamp(timestamp: number | string | undefined): string {
  if (!timestamp) return '-';
  const ts = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
  const date = new Date(ts > 1e12 ? ts : ts * 1000);
  
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 格式化时间（仅时分秒）
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 格式化日期时间（简短格式）
 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 截断字符串
 */
export function truncateString(str: string, maxLength: number): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

/**
 * 获取趋势颜色
 */
export function getTrendColor(trend: number): string {
  if (trend > 5) return '#f5222d';  // 上升 - 红色
  if (trend < -5) return '#52c41a'; // 下降 - 绿色
  return '#8c8c8c';                 // 平稳 - 灰色
}

/**
 * 获取百分比颜色
 */
export function getPercentColor(percent: number): string {
  if (percent >= 90) return '#f5222d'; // 危险
  if (percent >= 70) return '#fa8c16'; // 警告
  if (percent >= 50) return '#1890ff'; // 正常
  return '#52c41a';                    // 良好
}

/**
 * 获取状态标签类型
 */
export function getStatusType(status: string): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case '正常': return 'success';
    case '警告': return 'warning';
    case '异常':
    case '过期': return 'error';
    default: return 'default';
  }
}
