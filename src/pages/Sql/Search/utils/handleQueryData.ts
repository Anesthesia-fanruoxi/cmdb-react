/**
 * 查询结果处理工具函数
 * 支持单结果集和多结果集的统一处理
 */

import { processBigInt } from './processBigInt';
import type { ResultSet } from '../index';

// API 响应中的单个结果集
interface QueryResultItem {
  rows?: unknown[][];
  columns?: string[];
  total?: number;
  took?: number;
  db_name?: string;
  query_id?: string;
  sql?: string;
  page?: number;
  pages?: number;
}

/** 按语句拆分执行的 SQL（忽略语句内字符串中的分号） */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inQuote: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inQuote) {
      current += ch;
      if (ch === inQuote && sql[i - 1] !== '\\') inQuote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inQuote = ch;
      current += ch;
      continue;
    }
    if (ch === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

// API 响应数据结构
interface QueryResponseData {
  results?: QueryResultItem[];
  rows?: unknown[][];
  columns?: string[];
  total?: number;
  took?: number;
  query_id?: string;
  db_name?: string;
  page?: number;
  pages?: number;
}

// 处理结果
export interface HandleQueryDataResult {
  allResults: ResultSet[];
  queryResults: unknown[][];
  resultColumns: string[];
  total: number;
  took: number;
  /** Tab 级主会话 ID（一次执行共用） */
  queryId: string;
}

/**
 * 解析分页响应。
 * 后端 /page 约定：带 result_index 时返回 results 长度为 1 的数组（即当前结果切片），
 * 取 results[0]；若误回全量多结果数组，则按 resultIndex 取值。
 */
export function parsePageResponse(
  data: unknown,
  resultIndex: number,
): { rows: unknown[][]; columns?: string[]; total?: number } {
  const d = data as QueryResponseData & { results?: QueryResultItem[] };
  let raw: QueryResultItem | QueryResponseData | undefined;

  if (d?.results && Array.isArray(d.results) && d.results.length > 0) {
    raw =
      d.results.length === 1
        ? d.results[0]
        : d.results[resultIndex] ?? d.results[0];
  } else {
    raw = d;
  }

  return {
    rows: processBigInt(raw?.rows || []) as unknown[][],
    columns: raw?.columns,
    total: raw?.total,
  };
}

/**
 * 处理查询响应数据，统一转换为多结果集格式
 * @param sessionQueryId 前端本次执行生成的主会话 ID；多结果共用，优先于单项 query_id
 */
export function handleQueryData(
  data: QueryResponseData,
  defaultDbName: string = '',
  executedSql: string = '',
  sessionQueryId: string = '',
): HandleQueryDataResult {
  const allResults: ResultSet[] = [];
  // 后端多结果集不一定回传每条 sql，按顺序用执行 SQL 拆分补齐
  const executedStatements = splitSqlStatements(executedSql);
  // 主会话 ID：前端传入 > 顶层 query_id（一次执行一个）
  const sessionId = sessionQueryId || data.query_id || '';

  // 检查是否为多结果集格式
  if (data.results && Array.isArray(data.results) && data.results.length > 0) {
    data.results.forEach((result, index) => {
      const processedRows = processBigInt(result.rows || []) as unknown[][];
      allResults.push({
        data: processedRows,
        columns: result.columns || [],
        total: result.total || processedRows.length,
        took: result.took || 0,
        db_name: result.db_name || defaultDbName,
        sql: result.sql || executedStatements[index] || executedSql,
        // 后端每个结果集有独立 query_id，分页必须用该项自己的 id
        queryId: result.query_id || sessionId,
        name: `结果集 ${index + 1}`,
        page: result.page ?? 1,
      });
    });
  } else {
    const processedRows = processBigInt(data.rows || []) as unknown[][];
    allResults.push({
      data: processedRows,
      columns: data.columns || [],
      total: data.total || processedRows.length,
      took: data.took || 0,
      db_name: data.db_name || defaultDbName,
      sql: executedSql,
      queryId: data.query_id || sessionId,
      name: '结果集 1',
      page: data.page ?? 1,
    });
  }

  const firstResult = allResults[0] || {
    data: [],
    columns: [],
    total: 0,
    took: 0,
    queryId: '',
  };

  return {
    allResults,
    queryResults: firstResult.data,
    resultColumns: firstResult.columns,
    total: firstResult.total,
    took: firstResult.took,
    // Tab 始终用主会话 ID，不用某个结果项覆盖
    queryId: sessionId || firstResult.queryId,
  };
}

export default handleQueryData;
