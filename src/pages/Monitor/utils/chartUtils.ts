/**
 * 图表工具函数
 */

import type { DataStandard } from '../../../types/monitor';

/** 配色方案 */
const colorPalette = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
  '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#48b0f7',
];

/** 获取系列颜色 */
export function getSeriesColor(index: number): string {
  return colorPalette[index % colorPalette.length];
}

/** 解析主机名 */
export function parseHostName(metric: Record<string, string> | undefined, idx: number): string {
  if (!metric) return `实例${idx + 1}`;
  
  return metric.container || 
         metric.container_name || 
         metric.hostName || 
         metric.instance?.replace(/^.*?([^:]+)$/, '$1') || 
         metric.job || 
         `实例${idx + 1}`;
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
