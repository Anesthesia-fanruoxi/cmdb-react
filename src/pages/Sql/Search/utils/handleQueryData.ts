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
}

// 处理结果
export interface HandleQueryDataResult {
  allResults: ResultSet[];
  queryResults: unknown[][];
  resultColumns: string[];
  total: number;
  took: number;
  queryId: string;
}

/**
 * 处理查询响应数据，统一转换为多结果集格式
 * @param data API 响应数据
 * @param defaultDbName 默认数据库名
 * @param executedSql 执行的 SQL 语句
 * @returns 处理后的结果
 */
export function handleQueryData(
  data: QueryResponseData,
  defaultDbName: string = '',
  executedSql: string = ''
): HandleQueryDataResult {
  const allResults: ResultSet[] = [];

  // 检查是否为多结果集格式
  if (data.results && Array.isArray(data.results) && data.results.length > 0) {
    // 多结果集处理
    data.results.forEach((result, index) => {
      const processedRows = processBigInt(result.rows || []) as unknown[][];
      allResults.push({
        data: processedRows,
        columns: result.columns || [],
        total: result.total || processedRows.length,
        took: result.took || 0,
        db_name: result.db_name || defaultDbName,
        sql: result.sql || '',
        queryId: result.query_id || '',
        name: `结果集 ${index + 1}`
      });
    });
  } else {
    // 单结果集处理
    const processedRows = processBigInt(data.rows || []) as unknown[][];
    allResults.push({
      data: processedRows,
      columns: data.columns || [],
      total: data.total || processedRows.length,
      took: data.took || 0,
      db_name: data.db_name || defaultDbName,
      sql: executedSql,
      queryId: data.query_id || '',
      name: '结果集 1'
    });
  }

  // 返回第一个结果集作为当前显示
  const firstResult = allResults[0] || {
    data: [],
    columns: [],
    total: 0,
    took: 0,
    queryId: ''
  };

  return {
    allResults,
    queryResults: firstResult.data,
    resultColumns: firstResult.columns,
    total: firstResult.total,
    took: firstResult.took,
    queryId: firstResult.queryId
  };
}

export default handleQueryData;
