/**
 * 图表工具函数
 */

import type { DataStandard } from '@/types/monitor';

/** 配色方案 */
const colorPalette = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
  '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#48b0f7',
];

/** 根据图表名称获取颜色 */
const chartColorMap: Record<string, string> = {
  'QPS': '#409eff',
  '成功': '#67c23a',
  '错误': '#f56c6c',
  '延迟': '#e6a23c',
  '连接': '#909399',
  '内存': '#b37feb',
  'Goroutine': '#36cfc9',
  'GC': '#ff85c0',
  '请求': '#409eff',
  '响应': '#67c23a',
  '超时': '#f56c6c',
};

/** 根据图表名称获取颜色 */
export function getChartColorByName(viewName: string): string {
  for (const [key, color] of Object.entries(chartColorMap)) {
    if (viewName.includes(key)) return color;
  }
  return '#409eff'; // 默认蓝色
}

/** 获取系列颜色 */
export function getSeriesColor(index: number): string {
  return colorPalette[index % colorPalette.length];
}

/** 解析主机名 */
export function parseHostName(metric: Record<string, string> | undefined, idx: number): string {
  if (!metric) return `实例${idx + 1}`;
  
  // 优先使用有意义的字段
  if (metric.container) return metric.container;
  if (metric.container_name) return metric.container_name;
  if (metric.hostName) return metric.hostName;
  if (metric.service) return metric.service;
  if (metric.job && metric.job !== 'agent') return metric.job;
  
  // instance 字段：去掉端口号，只保留主机名
  if (metric.instance) {
    const host = metric.instance.replace(/:\d+$/, '');
    if (host) return host;
  }
  
  return `实例${idx + 1}`;
}

/** 根据标准格式化数值 */
export function formatValueByStandard(value: string | number, standard: DataStandard): number {
  let num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) num = 0;

  switch (standard) {
    case 'percent(0-1)':
      return num * 100;
    case 'data(kb)':
      return num * 1024;
    default:
      return num;
  }
}

/** 格式化 Y 轴标签 */
export function formatYAxisLabel(value: number, standard: DataStandard): string {
  if (typeof value !== 'number' || isNaN(value)) return '0';

  switch (standard) {
    case 'percent(1-100)':
    case 'percent(0-1)':
      return `${value.toFixed(2)}%`;
    case 'data(b)':
    case 'data(kb)':
      return formatBytes(value);
    default:
      if (Math.abs(value) >= 1000) {
        return `${(value / 1000).toFixed(1)}k`;
      }
      return value % 1 === 0 ? String(value) : value.toFixed(2);
  }
}

/** 格式化字节数 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  const sign = bytes < 0 ? '-' : '';
  return `${sign}${(Math.abs(bytes) / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
