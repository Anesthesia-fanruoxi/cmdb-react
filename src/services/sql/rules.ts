/**
 * SQL规则管理相关API
 */

import { apiClient } from '../request';

// 类型定义
export interface RuleItem {
  id: number;
  rule_name: string;
  rule_description: string;
  rule_category: 'security' | 'standard';
  rule_type: string;
  rule_content: string;
  sql_tag: string;
  error_message: string;
  is_enabled: number; // 0禁用, 1启用
  created_at: string;
  updated_at: string;
}

export interface CheckSqlData {
  sql: string;
  project: string;
  database: string;
}

export interface CheckSqlResult {
  valid: boolean;
  errors: Array<{
    rule_name: string;
    error_message: string;
  }>;
}

// 获取规则列表
export function getRulesList() {
  return apiClient.get<RuleItem[]>('/sql/rules/list');
}

// 更新规则状态
export function updateRuleStatus(id: number, isEnabled: boolean) {
  return apiClient.put<void>(`/sql/rules/update?id=${id}`, {
    is_enable: isEnabled ? 1 : 0
  });
}

// SQL语法检查
export function checkSql(data: CheckSqlData) {
  return apiClient.post<CheckSqlResult>('/sql/rules/check', data);
}

// SQL标签类型映射
export const SQL_TAG_TYPE_MAP: Record<string, string> = {
  'CREATE': 'success',
  'ALTER': 'warning',
  'DROP': 'danger',
  'TRUNCATE': 'danger',
  'DELETE': 'danger',
  'UPDATE': 'warning',
  'INSERT': 'primary',
  'SELECT': 'info',
};
