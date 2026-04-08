/**
 * 查询结果面板组件
 * 支持多结果集切换、后端分页和导出功能
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../../../../stores/authStore';
import { useUserPrefsStore } from '../../../../stores/userPrefsStore';
import toast from '../../../../components/Toast';
import type { ResultSet } from './SqlWorkspace';
import FullscreenResultPanel from './FullscreenResultPanel';
import type { CommentMap } from '../hooks/useColumnComments';
import '../styles/fullscreen-result.css';

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
  columnComments?: CommentMap;
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
  exportLoading = false, onExport, queryId,
  columnComments = new Map()
}: Props) => {
  const [localPage, setLocalPage] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const lastClickedRow = useRef<number | null>(null);
  const tableWrapperRef = useRef<HTMLDivElement>(null);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // 高亮颜色偏好
  const { uiPrefs, setUiPref } = useUserPrefsStore();
  const highlightColor = uiPrefs.sqlRowHighlightColor || '#8b5cf6';
  const colorInputRef = useRef<HTMLInputElement>(null);
  
  // 检查导出权限 (sql:search:w)
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canExport = hasPermission('sql:search:w');

  // 判断是否使用后端分页
  const useBackendPagination = !!onPageChange && !!queryId;
  
  // 当前页码，后端分页固定每页 20 条
  const currentPage = useBackendPagination ? (externalPage || 1) : localPage;
  const pageSize = useBackendPagination ? 20 : 50;
  
  const totalPages = useMemo(() => Math.ceil(total / pageSize) || 1, [total, pageSize]);
  
  // 显示数据
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

  useEffect(() => { setLocalPage(1); setSelectedRows(new Set()); lastClickedRow.current = null; }, [total]);

  // 键盘左右键横向滚动表格（长按匀速，松开停止）
  useEffect(() => {
    const el = tableWrapperRef.current;
    if (!el) return;

    let rafId: number | null = null;
    const speed = 8; // px per frame

    const startScroll = (dir: 1 | -1) => {
      if (rafId !== null) return;
      const step = () => {
        el.scrollLeft += dir * speed;
        rafId = requestAnimationFrame(step);
      };
      rafId = requestAnimationFrame(step);
    };

    const stopScroll = () => {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); startScroll(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); startScroll(1); }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') stopScroll();
    };

    el.addEventListener('keydown', onKeyDown);
    el.addEventListener('keyup', onKeyUp);
    return () => {
      stopScroll();
      el.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const handleExport = () => {
    if (onExport && queryId) onExport();
  };

  // 切换全屏
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // 复制列数据（使用全部结果，不只是当前页）
  const handleCopyColumn = (colIndex: number, colName: string) => {
    copyColumnData(results, colIndex, colName);
  };

  // 行点击：普通=单选，Ctrl=切换，Shift=范围选
  const handleRowClick = useCallback((absoluteIndex: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedRow.current !== null) {
      // Shift：范围选中
      const start = Math.min(lastClickedRow.current, absoluteIndex);
      const end = Math.max(lastClickedRow.current, absoluteIndex);
      setSelectedRows(prev => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) next.add(i);
        return next;
      });
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd：切换单行
      setSelectedRows(prev => {
        const next = new Set(prev);
        if (next.has(absoluteIndex)) next.delete(absoluteIndex);
        else next.add(absoluteIndex);
        return next;
      });
      lastClickedRow.current = absoluteIndex;
    } else {
      // 普通点击：单选（再次点击取消）
      setSelectedRows(prev => {
        if (prev.size === 1 && prev.has(absoluteIndex)) return new Set();
        return new Set([absoluteIndex]);
      });
      lastClickedRow.current = absoluteIndex;
    }
  }, []);

  // 右键：若当前行未选中则先选中，再弹菜单
  const handleRowContextMenu = useCallback((absoluteIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedRows(prev => {
      if (!prev.has(absoluteIndex)) return new Set([absoluteIndex]);
      return prev;
    });
    lastClickedRow.current = absoluteIndex;
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  // 复制选中行（tab 分隔列，换行分隔行）
  const handleCopySelectedRows = useCallback(async () => {
    if (selectedRows.size === 0) return;
    const rowStart = (currentPage - 1) * pageSize;
    const sorted = [...selectedRows].sort((a, b) => a - b);
    const lines = sorted.map(absIdx => {
      // absIdx 是全局行号，需转换为当前页数据索引
      const pageIdx = absIdx - rowStart;
      const row = currentData[pageIdx];
      if (!Array.isArray(row)) return '';
      return row.map(v => formatValueForCopy(v)).join('\t');
    }).filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success(`已复制 ${lines.length} 行`);
    } catch {
      toast.error('复制失败');
    }
    setContextMenu(null);
  }, [selectedRows, currentData, currentPage, pageSize]);

  // 行号起始位置
  const rowNumberStart = (currentPage - 1) * pageSize;

  // 如果是全屏模式，渲染全屏组件
  if (isFullscreen && useBackendPagination && onPageChange) {
    return (
      <FullscreenResultPanel
        columns={columns}
        results={results}
        total={total}
        took={took}
        dbName={dbName}
        currentPage={currentPage}
        onPageChange={onPageChange}
        onClose={() => {
          setIsFullscreen(false);
          // 恢复到第1页
          if (currentPage !== 1) {
            onPageChange(1, pageSize);
          }
        }}
      />
    );
  }

  return (
    <div className={`result-panel ${isFullscreen ? 'fullscreen' : ''}`} onClick={() => setContextMenu(null)}>
      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="row-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <button onClick={handleCopySelectedRows}>
            📋 复制选中行 ({selectedRows.size})
          </button>
        </div>
      )}
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
          {hasResults && (
            <div className="row-highlight-picker" title="自定义选中行高亮颜色">
              <span className="highlight-color-dot" style={{ background: highlightColor }} onClick={() => colorInputRef.current?.click()} />
              <input
                ref={colorInputRef}
                type="color"
                value={highlightColor}
                onChange={(e) => setUiPref('sqlRowHighlightColor', e.target.value as string)}
                className="highlight-color-input"
              />
            </div>
          )}
          {hasResults && (
            <button 
              className="btn btn-link"
              onClick={toggleFullscreen}
              title={isFullscreen ? '退出全屏' : '全屏显示'}
            >
              {isFullscreen ? '⤢' : '⛶'}
            </button>
          )}
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
      <div className="result-table-wrapper" ref={tableWrapperRef} tabIndex={0}>
        {loading ? (
          <div className="result-loading">查询中...</div>
        ) : columns.length === 0 ? (
          <div className="result-empty">执行SQL查询后，结果将显示在这里</div>
        ) : (
          <>
            <table className="result-table">
              <thead>
                <tr>
                  <th className="row-num">#</th>
                  {columns.map((col, colIdx) => {
                    const comment = columnComments.get(col.toLowerCase()) || '';
                    return (
                      <th key={col} style={{ overflow: 'visible' }}>
                        <div className="column-header">
                          <span
                            className={comment ? 'col-name-has-comment' : ''}
                            onMouseEnter={comment ? (e) => {
                              const popup = (e.currentTarget as HTMLElement).querySelector('.col-comment-popup') as HTMLElement;
                              if (!popup) return;
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              popup.style.left = `${rect.left + rect.width / 2}px`;
                              popup.style.top = `${rect.top - 6}px`;
                            } : undefined}
                          >
                            {col}
                            {comment && <span className="col-comment-popup">{comment}</span>}
                          </span>
                          <button
                            className="copy-col-btn"
                            title="复制此列数据"
                            onClick={() => handleCopyColumn(colIdx, col)}
                          >
                            📋
                          </button>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {currentData.map((row, idx) => {
                  const absoluteIndex = rowNumberStart + idx;
                  const isSelected = selectedRows.has(absoluteIndex);
                  // 将 hex 颜色转为带透明度的背景色（应用到 td，避免被 td 背景覆盖）
                  const hex = highlightColor.replace('#', '');
                  const r = parseInt(hex.slice(0, 2), 16);
                  const g = parseInt(hex.slice(2, 4), 16);
                  const b = parseInt(hex.slice(4, 6), 16);
                  const selectedTdStyle = isSelected ? { background: `rgba(${r},${g},${b},0.18)` } : {};
                  return (
                    <tr
                      key={absoluteIndex}
                      className={isSelected ? 'row-selected' : ''}
                      style={{ userSelect: 'none' }}
                      onClick={(e) => handleRowClick(absoluteIndex, e)}
                      onContextMenu={(e) => handleRowContextMenu(absoluteIndex, e)}
                    >
                      <td className="row-num" style={selectedTdStyle}>{absoluteIndex + 1}</td>
                      {Array.isArray(row) && row.map((val, colIdx) => (
                        <td
                          key={colIdx}
                          title={`双击复制: ${formatValue(val)}`}
                          onDoubleClick={() => copyCellValue(val)}
                          className="cell-copyable"
                          style={selectedTdStyle}
                        >
                          {formatValue(val)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
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
