/**
 * ELFK 日志搜索 API
 */

import { apiClient } from '../request';
import type { ApiResponse } from '../../types/api';

/** 项目信息 */
export interface ElfkProject {
  project: string;
  project_name: string;
}

/** 视图信息 */
export interface ElfkView {
  id: string;
  name: string;
  project: string;
  category?: string;
  index_pattern: string;
  time_field: string;
  description?: string;
  log_type?: string;
  all_field?: {
    properties: Record<string, FieldInfo>;
  };
}

/** 字段信息 */
export interface FieldInfo {
  type: string;
  format?: string;
}

/** 搜索参数 */
export interface SearchParams {
  project: string;
  view_id: string;
  view_name?: string;
  index_pattern: string;
  time_field: string;
  start_time: string;
  end_time: string;
  keyword?: string;
  size?: number;
  sort_order?: 'asc' | 'desc';
  query_id?: string;
  page?: number;
}

/** 日志条目 */
export interface LogHit {
  _index: string;
  _id: string;
  _source: Record<string, unknown>;
  sort?: unknown[];
}

/** 搜索结果 */
export interface SearchResult {
  hits: LogHit[];
  total_hits: number;
  query_id?: string;
  pages?: number;
  page?: number;
}

/** 上下文参数 */
export interface ContextParams {
  log_type?: string;
  project: string;
  // ELFK 类型
  doc_id?: string;
  index?: string;
  before?: number;
  after?: number;
  sort_field?: string;
  _source?: boolean;
  // SLS 类型
  logstore?: string;
  pack_id?: string;
  pack_meta?: string;
  back_lines?: number;
  forward_lines?: number;
  index_pattern?: string;
}

/** 上下文结果 */
export interface ContextResult {
  before: LogHit[];
  center: LogHit;
  after: LogHit[];
  total?: number;
  before_total?: number;
  after_total?: number;
  took?: number;
}

/** 字段分析参数 */
export interface AnalyzeParams {
  qid: string;           // 查询ID
  field: string;         // 分析字段
  log_type?: string;     // 日志类型
  count?: number;        // 总数
  startDelimiter?: string; // 开始分隔符
  endDelimiter?: string;   // 结束分隔符
}

/** 字段分析结果 */
export interface AnalyzeResult {
  task_id?: string;      // 任务ID（异步任务）
  field?: string;
  total?: number;
  buckets?: Array<{
    key: string;
    doc_count: number;
  }>;
}

// 获取项目列表
export function getElfkSearchProjects(): Promise<ApiResponse<ElfkProject[]>> {
  return apiClient.get<ElfkProject[]>('/elfk/search/projects');
}

// 获取索引列表
export function getIndices(project: string): Promise<ApiResponse<string[]>> {
  return apiClient.get<string[]>('/elfk/search/indices', { project });
}

/** 索引字段匹配结果 */
export interface IndexFieldsResult {
  fields?: {
    properties: Record<string, FieldInfo & { fields?: Record<string, FieldInfo> }>;
  };
}

// 匹配索引字段（用于视图创建/编辑，传 index_pattern 模糊匹配）
export function matchIndexFields(params: {
  project: string;
  index: string;
  log_type?: string;
}): Promise<ApiResponse<IndexFieldsResult>> {
  return apiClient.get<IndexFieldsResult>('/elfk/search/indices', params);
}

// 获取索引字段结构
export function getFields(
  project: string,
  index: string
): Promise<ApiResponse<{ properties: Record<string, FieldInfo> }>> {
  return apiClient.get('/elfk/search/fields', { project, index });
}

// 模糊获取索引字段
export function vagueGetFields(
  project: string,
  index: string
): Promise<ApiResponse<{ properties: Record<string, FieldInfo> }>> {
  return apiClient.get('/elfk/search/vaguefields', { project, index });
}

// 搜索日志 - platform 由后端通过 User-Agent / X-Client-Agent header 识别
export function searchLogs(data: SearchParams): Promise<ApiResponse<SearchResult>> {
  return apiClient.post<SearchResult>('/elfk/search/list', data);
}

// 分页查询日志
export function searchLogsPage(data: SearchParams): Promise<ApiResponse<SearchResult>> {
  return apiClient.post<SearchResult>('/elfk/search/page', data);
}

// 获取日志上下文
export function getLogsContext(data: ContextParams): Promise<ApiResponse<ContextResult>> {
  return apiClient.post<ContextResult>('/elfk/search/context', data);
}

// 分析字段数据
export function analyzeField(data: AnalyzeParams): Promise<ApiResponse<AnalyzeResult>> {
  return apiClient.post<AnalyzeResult>('/elfk/search/analyze', data);
}

// 导出日志（后端异步下载，完成后通知）
export function exportLogs(data: {
  project: string;
  index_pattern: string;
  start_time: string;
  end_time: string;
  time_field: string;
  keyword?: string;
  fields?: string[];
  view_name?: string;
}): Promise<ApiResponse<{ task_id: string; message: string }>> {
  return apiClient.post('/elfk/search/export', data);
}
