/**
 * SQL变更申请相关API
 */

import { apiClient } from '../request';
import { createSSEConnection } from './search';

// 类型定义
export interface ApplyProject {
  project: string;
  project_name: string;
  agent?: number;
}

export interface ProcessInfo {
  agent: number;
  projectName: string;
  applyId: number;
  applyName: string;
  executorId: number;
  executorName: string;
}

export interface RuleInfo {
  rule_name: string;
  rule_type: string;
  rule_category: string;
  rule_level: number;
  rule_description?: string;
  passed: boolean;
  error_message?: string;
  violation_details?: Array<{
    target: string;
    target_type: string;
    issue: string;
    current_value: string;
  }>;
}

export interface SqlCheckResult {
  sql: string;
  sql_type: string;
  sql_category?: string;
  table_names?: string[];
  has_violation: boolean;
  has_blocker: boolean;
  rule_infos?: RuleInfo[];
  rule_results?: RuleInfo[];
  parse_result?: {
    basic_info?: {
      risk_level?: string;
      risk_reason?: string;
    };
    analyze?: {
      operation?: string;
      table?: string;
      data_source?: string;
      row_count?: number;
      columns?: string[];
      values?: any[][];
      // DML 相关字段
      has_where?: boolean;
      where_clause?: string;
      estimated_rows?: number;
      has_limit?: boolean;
      set_clauses?: Array<{
        column: string;
        value: any;
        is_expr?: boolean;
      }>;
      // ALTER 相关字段
      alter_info?: {
        table_name?: string;
        total_actions?: number;
        add_field_count?: number;
        modify_field_count?: number;
        change_field_count?: number;
        drop_field_count?: number;
        add_index_count?: number;
        drop_index_count?: number;
      };
      alter_detail?: Array<{
        action?: string;
        target?: string;
        column?: {
          name?: string;
          type?: string;
          nullable?: boolean;
          comment?: string;
        };
        index?: {
          name?: string;
        };
        position?: string;
        description?: string;
      }>;
      table_info?: {
        table_name: string;
        primary_key?: string;
        field_count?: number;
        index_count?: number;
        engine?: string;
        charset?: string;
        collation?: string;
        comment?: string;
      };
      field_info?: {
        comment_summary?: string;  // 如 "15/17 (88%)"
        default_summary?: string;
        nullable_summary?: string;
      };
      field_detail?: Array<{
        name?: string;
        column_name?: string;
        type?: string;
        column_type?: string;
        nullable?: boolean;
        default?: string;
        default_value?: string;
        comment?: string;
      }>;
      index_detail?: Array<{
        name?: string;
        index_name?: string;
        type?: string;
        is_primary?: boolean;
        is_unique?: boolean;
        columns?: string[];
      }>;
    };
  };
}

export interface ApplyItem {
  id: string;
  project: string;
  project_name?: string;
  database_name: string;
  sql_content: string;
  remark?: string;
  description?: string; // 申请说明
  status: number | string;
  submitter_id: number;
  submitter_name: string;
  apply_id: number;
  apply_name: string;
  executor_id: number;
  executor_name: string;
  current_operator?: string;
  execution_time?: string;
  created_at: string;
  updated_at?: string;
}

export interface ApplyDetail extends ApplyItem {
  description?: string;
  rule_check_result?: SqlCheckResult[];
  has_violation?: boolean;
  has_blocker?: boolean;
  apply_role?: string;
}

export interface CreateApplyData {
  project: string;
  database_name: string;
  sql_content: string;
  remark: string;
  apply_id?: number | null;
  apply_name?: string;
  executor_id?: number | null;
  executor_name?: string;
  execution_time?: string;
}

export interface UpdateApplyData {
  id: string;
  process_type: number; // 0驳回/撤销, 1通过/执行
}

// 获取项目列表（权限过滤）
export function getSqlApplyProjects() {
  return apiClient.get<{ items: ApplyProject[] }>('/sql/apply/projects');
}

// 获取流程列表
export function getProcessList() {
  return apiClient.get<{ list: ProcessInfo[] }>('/sql/process/list');
}

// 获取SQL变更申请列表（SSE流式）
export function getApplyListSSE(
  onMessage: (data: ApplyItem[]) => void,
  onError?: (error: Event) => void,
  onComplete?: () => void
) {
  return createSSEConnection('/sql/apply/list', (data) => {
    const result = data as { apply?: ApplyItem[]; total_count?: number };
    onMessage(result.apply || []);
  }, onError, onComplete);
}

// 获取SQL变更申请列表（普通请求）
export function getApplyList(params?: { status?: number; project?: string }) {
  return apiClient.get<{ list: ApplyItem[]; total: number }>('/sql/apply/list', params);
}

// 提交SQL变更申请
export function submitApply(data: CreateApplyData) {
  return apiClient.post<{ id: string }>('/sql/apply/create', data);
}

// 审批SQL变更申请
export function updateApply(data: UpdateApplyData) {
  return apiClient.put<void>('/sql/apply/update', data);
}

// 获取SQL变更申请详情
export function getApplyDetail(id: string) {
  return apiClient.get<ApplyDetail>('/sql/apply/detail', { id });
}

// SQL语法检查
export function checkSql(data: { sql: string; project: string; database: string }) {
  return apiClient.post<{ sql_results: SqlCheckResult[] }>('/sql/rules/check', data);
}

// 状态映射 (Vue版本: 0-待审批、1-待执行、2-执行中、3-执行完成、4-执行失败、5-已驳回、6-已撤销)
export const APPLY_STATUS_MAP: Record<number | string, { text: string; type: string }> = {
  0: { text: '待审批', type: 'warning' },
  1: { text: '待执行', type: 'info' },
  2: { text: '执行中', type: 'primary' },
  3: { text: '执行完成', type: 'success' },
  4: { text: '执行失败', type: 'danger' },
  5: { text: '已驳回', type: 'danger' },
  6: { text: '已撤销', type: 'info' },
};

// 流程完成状态
export const FINISHED_STATUS = [3, 4, 5, 6, '3', '4', '5', '6'];
