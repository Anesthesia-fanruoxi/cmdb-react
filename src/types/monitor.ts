/**
 * 监控模块类型定义
 */

/** 时间范围选项 */
export type TimeRangeType = '1h' | '3h' | '6h' | '12h' | '1d' | '3d' | '7d' | '30d' | 'custom';

/** 时间范围配置 */
export interface TimeRangeOption {
  label: string;
  value: TimeRangeType;
  seconds: number;
}

/** 图表类型 */
export type ChartType = 'line' | 'bar' | 'pie' | 'gauge' | 'tab';

/** 数据标准类型 */
export type DataStandard = 'default' | 'percent(1-100)' | 'percent(0-1)' | 'data(b)' | 'data(kb)';

/** 监控分类 */
export type MonitorCategory = 'hardware' | 'container' | 'ssl' | 'alert';

/** 格式化后的图表数据点 */
export interface ChartDataPoint {
  time: string;
  timestamp: number;
  value: number;
}

/** 图表系列数据 */
export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
  color?: string;
}

/** Gauge 数据项 */
export interface GaugeDataItem {
  name: string;
  percentage: number;
  rawValue: number;
}

/** SSL 证书数据项 */
export interface SSLCertItem {
  domain: string;
  comment: string;
  days: number;
  status: string;
  project: string;
  updateTime: string;
}
