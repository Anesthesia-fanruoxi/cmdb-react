/**
 * SQL数据导出相关API
 */

import { apiClient } from '../request';
import { getToken } from '../storage/tokenStorage';

// 类型定义
export interface ExportProject {
  project: string;
  project_name: string;
  agent?: string;
}

export interface ExportItem {
  id: string;
  project: string;
  project_name: string;
  database_name: string;
  sql_content: string;
  export_reason: string;
  recipient_email: string;
  status: number;
  status_text: string;
  submitter_id: number;
  submitter_name: string;
  apply_id: number;
  apply_name: string;
  current_operator: string;
  created_at: string;
  updated_at: string;
}

export interface ExportDetail extends ExportItem {
  file_url?: string;
  error_message?: string;
  submitter_remark?: string;
  reviewer_id?: number;
  reviewer_name?: string;
  reviewer_status?: number;
  executor_id?: number;
  executor_name?: string;
  executor_status?: number;
  submitter_status?: number;
  apply_status?: number;
  rule_check_result?: string;
}

export interface CreateExportData {
  project: string;
  apply_id: number;
  reviewer_id: number;
  executor_id: number;
  submitter_remark: string;
  has_sql?: boolean;
  database_name?: string;
  sql_content?: string;
}

export interface UpdateExportData {
  id: string;
  process_type?: number; // 0撤销/拒绝, 1通过
  database_name?: string;
  sql_content?: string;
}

// 获取项目列表（权限过滤）
export function getSqlExportProjects() {
  return apiClient.get<ExportProject[]>('/sql/export/projects');
}

// 获取SQL导出申请列表（SSE流式）
export function getExportListSSE(
  onMessage: (data: { export: ExportItem[]; total_count: number }) => void,
  onError?: (error: Event) => void,
  onComplete?: () => void
): EventSource {
  const token = getToken();
  const baseUrl = import.meta.env.VITE_SSE_BASE_URL || import.meta.env.VITE_API_BASE_URL || '';
  const url = `${baseUrl}/sql/export/list?token=${token}`;
  
  const eventSource = new EventSource(url);
  
  eventSource.addEventListener('connected', () => {
    // 连接成功
  });
  
  eventSource.addEventListener('data', (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch {
      // 解析错误静默处理
    }
  });
  
  eventSource.onerror = (error) => {
    eventSource.close();
    onError?.(error);
  };
  
  eventSource.addEventListener('complete', () => {
    eventSource.close();
    onComplete?.();
  });
  
  return eventSource;
}

// 获取SQL导出申请列表（普通请求，备用）
export function getExportList(params?: { status?: number; project?: string; page?: number }) {
  return apiClient.get<{ export: ExportItem[]; total_count: number; page: number; page_size: number }>('/sql/export/list', params);
}

// 提交SQL导出申请
export function submitExport(data: CreateExportData) {
  return apiClient.post<{ id: string }>('/sql/export/create', data);
}

// 更新SQL导出申请
export function updateExport(data: UpdateExportData) {
  return apiClient.put<void>('/sql/export/update', data);
}

// 获取SQL导出申请详情
export function getExportDetail(id: string) {
  return apiClient.get<ExportDetail>('/sql/export/detail', { id });
}

// 移动端审核接口
export function exportMobileReview(data: { id: string; process_type: number }) {
  return apiClient.put<void>('/sql/export/url/update', data);
}

// 重新发送邮件
export function resendEmail(data: { id: string }) {
  return apiClient.post<void>('/sql/export/resend-email', data);
}

// 状态映射
export const EXPORT_STATUS_MAP: Record<number, { text: string; type: string }> = {
  0: { text: '待提交', type: 'info' },
  1: { text: '待审核', type: 'warning' },
  2: { text: '待执行', type: 'primary' },
  3: { text: '执行中', type: 'primary' },
  4: { text: '执行成功', type: 'success' },
  5: { text: '已撤销', type: 'info' },
  6: { text: '已拒绝', type: 'danger' },
  7: { text: '执行失败', type: 'danger' },
  8: { text: 'SQL执行中', type: 'primary' },
  9: { text: 'SQL导出中', type: 'primary' },
  10: { text: '邮件发送中', type: 'primary' },
  11: { text: '邮件发送失败', type: 'danger' },
};
