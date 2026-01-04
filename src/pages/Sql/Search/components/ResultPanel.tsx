/**
 * 查询结果面板组件
 * 支持多结果集切换、后端分页和导出功能
 */

import { useState, useMemo, useEffect } from 'react';
import { useAuthStore } from '../../../../stores/authStore';
import toast from '../../../../components/Toast';
import type { ResultSet } from './SqlWorkspace';

interface Props {
  columns: string[];
  results: unknown[][];
  total: number;
  took: number;
  loading: boolean;
  isExecuting?: boolean;
  elapsedTime?: number;
  dbName?: string;
  allResults?: ResultSet[];
  currentResultIndex?: number;
  onResultChange?: (index: number) => void;
  currentPage?: number;
  onPageChange?: (page: number, size: number) => void;
  exportLoading?: boolean;
  onExport?: () => void;
  queryId?: string;
}

/** 格式化单元格值用于复制 */
const formatValueForCopy = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/** 复制列数据 */
const copyColumnData = async (results: unknown[][], colIndex: number, colName: string) => {
  try {
    const columnData = results.map(row => {
      if (!Array.isArray(row)) return '';
      return formatValueForCopy(row[colIndex]);
    });
    const text = columnData.join('\n');
    await navigator.clipboard.writeText(text);
    toast.success(`已复制 ${colName} 列 (${results.length} 行)`);
  } catch {
    toast.error('复制失败');
  }
};

/** 复制单元格值 */
const copyCellValue = async (value: unknown) => {
  try {
    const text = formatValueForCopy(value);
    await navigator.clipboard.writeText(text);
    const display = text.length > 20 ? text.substring(0, 20) + '...' : text;
    toast.success(`已复制: ${display}`);
  } catch {
    toast.error('复制失败');
  }
};

const ResultPanel = ({
  columns, results, total, took, loading, isExecuting = false, elapsedTime = 0, dbName,
  allResults = [], currentResultIndex = 0, onResultChange,
  currentPage: externalPage, onPageChange,
  exportLoading = false, onExport, queryId
}: Props) => {
  const [localPage, setLocalPage] = useState(1);
  
  // 检查导出权限 (sql:search:w)
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canExport = hasPermission('sql:search:w');

  // 判断是否使用后端分页
  const useBackendPagination = !!onPageChange && !!queryId;
  
  // 当前页码，后端分页固定每页 20 条
  const currentPage = useBackendPagination ? (externalPage || 1) : localPage;
  const pageSize = useBackendPagination ? 20 : 50;
  
  const totalPages = useMemo(() => Math.ceil(total / pageSize) || 1, [total, pageSize]);
  
  const currentData = useMemo(() => {
    if (useBackendPagination) return results;
    const start = (localPage - 1) * pageSize;
    return results.slice(start, start + pageSize);
  }, [useBackendPagination, results, localPage, pageSize]);

  const showResultSelector = allResults.length > 1;
  const showPagination = total > pageSize;
  const hasResults = results.length > 0;

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    if (useBackendPagination && onPageChange) {
      onPageChange(newPage, pageSize);
    } else {
      setLocalPage(newPage);
    }
  };

  const handleResultChange = (index: number) => {
    if (onResultChange && index >= 0 && index < allResults.length) {
      onResultChange(index);
      setLocalPage(1);
    }
  };

  useEffect(() => { setLocalPage(1); }, [total]);

  const handleExport = () => {
    if (onExport && queryId) onExport();
  };

  // 复制列数据（使用全部结果，不只是当前页）
  const handleCopyColumn = (colIndex: number, colName: string) => {
    copyColumnData(results, colIndex, colName);
  };

  const rowNumberStart = (currentPage - 1) * pageSize;

  return (
    <div className="result-panel">
      {/* 顶部：结果集选择器 + 导出按钮 */}
      <div className="result-header">
        <div className="header-left">
          <span className="header-title">
            {isExecuting ? '执行中' : hasResults ? '查询结果' : '暂无结果'}
          </span>
          {/* 计时器：执行中实时更新，执行结束后定格 */}
          {(isExecuting || elapsedTime > 0) && (
            <span className="elapsed-timer">{elapsedTime.toFixed(1)}s</span>
          )}
          {showResultSelector && (
            <div className="result-selector">
              {allResults.map((rs, idx) => (
                <button
                  key={idx}
                  className={`selector-tab ${idx === currentResultIndex ? 'active' : ''}`}
                  onClick={() => handleResultChange(idx)}
                  title={rs.sql || `结果集 ${idx + 1}`}
                >
                  结果{idx + 1}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="header-right">
          {hasResults && queryId && canExport && (
            <button 
              className={`btn btn-link ${exportLoading ? 'loading' : ''}`}
              onClick={handleExport}
              disabled={exportLoading}
            >
              {exportLoading ? '导出中...' : '导出'}
            </button>
          )}
        </div>
      </div>

      {/* 中间：表格 */}
      <div className="result-table-wrapper">
        {loading ? (
          <div className="result-loading">查询中...</div>
        ) : columns.length === 0 ? (
          <div className="result-empty">执行SQL查询后，结果将显示在这里</div>
        ) : (
          <table className="result-table">
            <thead>
              <tr>
                <th className="row-num">#</th>
                {columns.map((col, colIdx) => (
                  <th key={col}>
                    <div className="column-header">
                      <span>{col}</span>
                      <button 
                        className="copy-col-btn" 
                        title="复制此列数据"
                        onClick={() => handleCopyColumn(colIdx, col)}
                      >
                        📋
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentData.map((row, idx) => (
                <tr key={idx}>
                  <td className="row-num">{rowNumberStart + idx + 1}</td>
                  {row.map((val, colIdx) => (
                    <td 
                      key={colIdx} 
                      title={`双击复制: ${formatValue(val)}`}
                      onDoubleClick={() => copyCellValue(val)}
                      className="cell-copyable"
                    >
                      {formatValue(val)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 底部：统计信息（左）+ 分页控件（右） */}
      <div className="result-footer">
        <div className="result-stats">
          {total > 0 && (
            <>
              <span>总行数: {total}</span>
              <span>耗时: {took}ms</span>
              {dbName && <span>数据库: {dbName}</span>}
              {showPagination && <span>第 {currentPage}/{totalPages} 页</span>}
            </>
          )}
        </div>
        {showPagination && (
          <div className="result-pagination">
            <button disabled={currentPage <= 1} onClick={() => handlePageChange(currentPage - 1)}>
              上一页
            </button>
            <span className="page-info">
              第 <input 
                type="number" 
                className="page-input"
                defaultValue={currentPage}
                key={currentPage}
                min={1}
                max={totalPages}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = parseInt((e.target as HTMLInputElement).value, 10);
                    if (!isNaN(val) && val >= 1 && val <= totalPages) handlePageChange(val);
                  }
                }}
                onBlur={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= totalPages && val !== currentPage) {
                    handlePageChange(val);
                  }
                }}
              /> 页 / 共 {totalPages} 页
            </span>
            <button disabled={currentPage >= totalPages} onClick={() => handlePageChange(currentPage + 1)}>
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultPanel;
