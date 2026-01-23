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

/** 获取监控指标实时数据（SSE） */
export interface GetMetricsSSEParams {
  project: string;
  category: string;
  service?: string;
  namespace?: string;
  token: string;
}

export const getMonitorMetricsSSE = (
  params: GetMetricsSSEParams,
  onMessage: (data: MonitorMetric[]) => void,
  onError?: (error: Event) => void,
  onComplete?: () => void
): EventSource => {
  const baseUrl = import.meta.env.VITE_SSE_BASE_URL || import.meta.env.VITE_API_BASE_URL || '';
  
  // 构建查询参数，只添加有值的参数
  const queryObj: Record<string, string> = {
    project: params.project,
    category: params.category,
    token: params.token,
  };
  
  if (params.service) {
    queryObj.service = params.service;
  }
  
  if (params.namespace) {
    queryObj.namespace = params.namespace;
  }
  
  const queryParams = new URLSearchParams(queryObj);
  const url = `${baseUrl}/monitor/metrics/list?${queryParams.toString()}`;
  
  console.log('[SSE] 连接地址:', url);
  const eventSource = new EventSource(url);
  
  eventSource.addEventListener('connected', () => {
    console.log('[SSE] 监控数据流已连接');
  });
  
  eventSource.addEventListener('data', (event) => {
    try {
      const response = JSON.parse(event.data);
      console.log('[SSE] 收到原始响应:', response);
      
      // 如果响应有 data 字段，说明是包装过的数据
      const data = response.data || response;
      
      console.log('[SSE] 解析后的数据:', data);
      if (Array.isArray(data)) {
        onMessage(data);
      } else {
        console.error('[SSE] 数据格式错误，期望数组，实际:', typeof data);
      }
    } catch (err) {
      console.error('[SSE] 数据解析失败:', err);
    }
  });
  
  eventSource.onerror = (error) => {
    console.error('[SSE] 连接错误:', error);
    eventSource.close();
    onError?.(error);
  };
  
  eventSource.addEventListener('complete', () => {
    eventSource.close();
    onComplete?.();
  });
  
  return eventSource;
};
