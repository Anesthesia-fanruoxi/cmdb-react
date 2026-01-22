/**
 * 监控管理 API
 */

import { apiClient } from '../request';

/** 监控视图项 */
export interface MonitorView {
  view_id: number;
  view_name: string;
  query: string;
  description?: string;
  category?: string;
  chart_type: 'line' | 'bar' | 'pie' | 'gauge' | 'tab';
  standard?: 'default' | 'percent(1-100)' | 'percent(0-1)' | 'data(b)' | 'data(kb)';
  refresh_interval?: number;
  time_range?: string;
  sort?: number;
  project?: string;
  created_at?: string;
  updated_at?: string | number;  // 支持字符串或时间戳
}

/** 监控指标数据 */
export interface MetricData {
  resultType: 'matrix' | 'vector' | 'scalar';
  result: MetricResult[];
}

/** 指标结果项 */
export interface MetricResult {
  metric: Record<string, string>;
  values?: [number, string][]; // matrix 类型
  value?: [number, string];    // vector 类型
}

/** 监控指标（包含数据） */
export interface MonitorMetric extends MonitorView {
  data?: MetricData;
  hosts_count?: number;
  avg?: number;
  max?: number;
  min?: number;
  trend?: number;
}

/** 项目选项 */
export interface ProjectOption {
  key: string;
  value: string;
}

/** 获取监控指标列表参数 */
export interface GetMetricsParams {
  project: string;
  category?: string;
  start?: string;
  end?: string;
  namespace?: string;
  service?: string;
}

/** 获取监控指标项目列表 */
export const getMetricsProjects = () => {
  return apiClient.get<ProjectOption[]>('/monitor/metrics/projects');
};

/** 获取监控视图项目列表 */
export const getMonitorViewProjects = () => {
  return apiClient.get<ProjectOption[]>('/monitor/view/projects');
};

/** 获取告警项目列表 */
export const getAlertProjects = () => {
  return apiClient.get<ProjectOption[]>('/monitor/alert/projects');
};

/** 获取监控指标数据列表 (POST) */
export const getMonitorMetricsList = (data: GetMetricsParams) => {
  return apiClient.post<MonitorMetric[]>('/monitor/metrics/list', data);
};

/** 获取告警列表 */
export const getAlertList = () => {
  return apiClient.get<MonitorMetric[]>('/monitor/alert/list');
};

/** 创建监控视图 */
export interface CreateViewParams {
  view_name: string;
  query: string;
  description?: string;
  category?: string;
  chart_type?: string;
  time_range?: string;
}

export const createMonitorView = (data: CreateViewParams) => {
  return apiClient.post<null>('/monitor/view/create', data);
};

/** 获取监控视图列表 */
export const getMonitorViewList = (params?: Record<string, unknown>) => {
  return apiClient.get<MonitorMetric[]>('/monitor/view/list', params);
};

/** 获取监控视图详情 */
export const getMonitorViewDetail = (id: number) => {
  return apiClient.get<MonitorView>('/monitor/view/detail', { id });
};

/** 更新监控视图 */
export interface UpdateViewParams extends CreateViewParams {
  id: number;
}

export const updateMonitorView = (data: UpdateViewParams) => {
  return apiClient.put<null>('/monitor/view/update', data);
};

/** 删除监控视图 */
export const deleteMonitorView = (id: number) => {
  return apiClient.delete<null>(`/monitor/view/delete?id=${id}`);
};
