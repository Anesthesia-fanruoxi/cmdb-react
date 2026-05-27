/**
 * 发版管理 API
 */

import { apiClient } from '../request';
import { createGatewayConnection } from '../sse/compat';

/** 项目更新信息 */
export interface ProjectUpdate {
  project: string;
  project_name: string;
  git_url: string;
  feishu_url: string;
  update_feishu?: string;
  notify_feishu?: string;
  enable_skywalking: boolean;
  backend_tool: string;
  frontend_tool: string;
  tool?: string;
  last_update: string;
  status: string;
  total_updates: number;
}

/** 发版记录 */
export interface ReleaseRecord {
  id: number;
  task_id: string;
  project: string;
  type: string;
  branch: string;
  commit: string;
  status: string;
  started_at: string;
  completed_at: string;
  start_time?: string;
  end_time?: string;
  description?: string;
  steps: ReleaseStep[];
}

/** 发版步骤 */
export interface ReleaseStep {
  name: string;
  status: string;
  start_time: string;
  end_time: string;
  logs?: string;
}

/** SSE 详情响应 */
export interface ProjectDetailResponse {
  project_info: ProjectUpdate;
  records: ReleaseRecord[];
  total_updates: number;
  last_update: string;
}

// 获取项目列表
export function getProUpdateProjects() {
  return apiClient.get<{ items: { project: string; project_name: string }[] }>('/assets/proUpdate/projects');
}

// 获取项目更新列表
export function getProjectUpdateList(params?: { type?: string }) {
  return apiClient.get<{ items: ProjectUpdate[] }>('/assets/proUpdate/list', params);
}

/**
 * 订阅项目更新详情 (SSE)
 * @param project 项目代码
 * @param type 项目类型
 * @param onMessage 消息回调
 * @param onError 错误回调
 * @returns 包含 close 方法的控制器
 */
export function subscribeProjectDetail(
  project: string,
  type: string | undefined,
  onMessage: (data: ProjectDetailResponse) => void,
  onError?: (error: Event) => void
): { close: () => void } {
  // 网关模式
  const gatewayResult = createGatewayConnection<ProjectDetailResponse>(
    'assets.project.detail',
    { project, type: type || '' },
    onMessage,
    () => onError?.(new Event('error')),
  );
  if (gatewayResult) return gatewayResult;

  // 旧模式
  const baseUrl = import.meta.env.VITE_SSE_BASE_URL || import.meta.env.VITE_API_BASE_URL || '';
  const url = `${baseUrl}/assets/proUpdate/list-detail?project=${project}${type ? `&type=${type}` : ''}`;
  
  const eventSource = new EventSource(url);
  
  // 监听自定义 'data' 事件
  eventSource.addEventListener('data', (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      console.error('SSE 解析错误:', e);
    }
  });
  
  eventSource.onerror = (error) => {
    console.error('SSE 连接错误:', error);
    onError?.(error);
    eventSource.close();
  };
  
  return {
    close: () => eventSource.close()
  };
}

// 获取任务详情
export function getRecordDetail(taskId: string) {
  return apiClient.get<ReleaseRecord>('/assets/proUpdate/records-detail', { id: taskId });
}

// 取消任务
export function cancelTask(taskId: string) {
  return apiClient.post('/assets/proUpdate/cancel', { id: taskId });
}

// 删除任务
export function deleteTask(taskId: string) {
  return apiClient.post('/assets/proUpdate/delete', { task_id: taskId });
}

// 开始发版
export function startRelease(data: { project: string; type?: string; branch?: string; category?: string; description?: string }) {
  return apiClient.post<{ task_id: string }>('/assets/proUpdate/create', data);
}

// 更新项目配置
export function updateProjectConfig(data: Record<string, unknown>) {
  return apiClient.post('/system/project/update', data);
}
