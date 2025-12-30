/**
 * 图表工具函数
 */

import type { MonitorMetric, MetricResult } from '../../../services/monitor';
import type { ChartSeries, ChartDataPoint, DataStandard } from '../../../types/monitor';
import { formatDateTime } from './format';

/** 预定义颜色列表 */
const CHART_COLORS = [
  '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
  '#13c2c2', '#eb2f96', '#fa541c', '#2f54eb', '#a0d911',
  '#fadb14', '#1890ff', '#52c41a', '#faad14', '#f5222d',
];

/**
 * 获取图表颜色
 */
export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

/**
 * 将监控数据转换为图表系列数据
 */
export function convertToChartSeries(
  metric: MonitorMetric,
  standard: DataStandard = 'default'
): ChartSeries[] {
  if (!metric.data || metric.data.resultType !== 'matrix' || !metric.data.result) {
    return [];
  }

  return metric.data.result.map((result, index) => {
    const name = getSeriesName(result);
    const data = convertValues(result.values || [], standard);
    
    return {
      name,
      data,
      color: getChartColor(index),
    };
  });
}

/**
 * 获取系列名称
 */
function getSeriesName(result: MetricResult): string {
  const m = result.metric;
  return m.hostName || m.instance || m.pod || m.container || m.name || '未知';
}

/**
 * 转换数值数组
 */
function convertValues(
  values: [number, string][],
  standard: DataStandard
): ChartDataPoint[] {
  return values.map(([timestamp, value]) => {
    let numValue = parseFloat(value);
    
    // 根据标准转换值
    if (standard === 'percent(0-1)') {
      numValue = numValue * 100;
    }
    
    return {
      time: formatDateTime(timestamp),
      timestamp,
      value: numValue,
    };
  });
}

/**
 * 获取Y轴最大值
 */
export function getYAxisMax(standard: DataStandard): number | undefined {
  if (standard === 'percent(1-100)' || standard === 'percent(0-1)') {
    return 100;
  }
  return undefined;
}

/**
 * 格式化Y轴标签
 */
export function formatYAxisLabel(value: number, standard: DataStandard): string {
  if (standard === 'percent(1-100)' || standard === 'percent(0-1)') {
    return `${value}%`;
  }
  if (standard === 'data(b)' || standard === 'data(kb)') {
    const k = 1024;
    if (value >= k * k * k) return `${(value / (k * k * k)).toFixed(1)}GB`;
    if (value >= k * k) return `${(value / (k * k)).toFixed(1)}MB`;
    if (value >= k) return `${(value / k).toFixed(1)}KB`;
    return `${value}B`;
  }
  return String(value);
}

/**
 * 提取所有主机名
 */
export function extractHostNames(metrics: MonitorMetric[]): string[] {
  const hosts = new Set<string>();
  
  metrics.forEach(metric => {
    if (metric.data?.resultType === 'matrix' && metric.data.result) {
      metric.data.result.forEach(item => {
        const hostName = item.metric?.hostName || item.metric?.instance;
        if (hostName) hosts.add(hostName);
      });
    }
  });
  
  return Array.from(hosts).sort();
}

/**
 * 提取所有容器/控制器名
 */
export function extractContainerNames(metrics: MonitorMetric[]): string[] {
  const containers = new Set<string>();
  
  metrics.forEach(metric => {
    if (metric.data?.resultType === 'matrix' && metric.data.result) {
      metric.data.result.forEach(item => {
        const name = item.metric?.container || item.metric?.controller || 
                     item.metric?.deployment || item.metric?.pod;
        if (name) containers.add(name);
      });
    }
  });
  
  return Array.from(containers).sort();
}

/**
 * 按主机过滤指标数据
 */
export function filterMetricsByHost(
  metrics: MonitorMetric[],
  hostName: string
): MonitorMetric[] {
  if (!hostName) return metrics;
  
  return metrics.map(metric => {
    if (!metric.data?.result) return metric;
    
    const filteredResult = metric.data.result.filter(item => {
      const name = item.metric?.hostName || item.metric?.instance;
      return name === hostName || (name && name.includes(hostName));
    });
    
    return {
      ...metric,
      data: { ...metric.data, result: filteredResult },
      hosts_count: filteredResult.length,
    };
  });
}

/**
 * 按容器过滤指标数据
 */
export function filterMetricsByContainer(
  metrics: MonitorMetric[],
  containerName: string
): MonitorMetric[] {
  if (!containerName) return metrics;
  
  return metrics.map(metric => {
    if (!metric.data?.result) return metric;
    
    const filteredResult = metric.data.result.filter(item => {
      // 与 Vue 一致：检查 container, controller, deployment, podName
      const name = item.metric?.container || item.metric?.controller || 
                   item.metric?.deployment || item.metric?.pod || item.metric?.podName;
      return name === containerName || (name && name.includes(containerName));
    });
    
    return {
      ...metric,
      data: { ...metric.data, result: filteredResult },
      hosts_count: filteredResult.length,
    };
  });
}
