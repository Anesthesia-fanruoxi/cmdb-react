/**
 * 查询结果面板组件
 * 支持多结果集切换、后端分页、导出、列宽拖拽调整
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

const formatValueForCopy = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const copyColumnData = async (results: unknown[][], colIndex: number, colName: string) => {
  try {
    const text = results.map(row => (!Array.isArray(row) ? '' : formatValueForCopy(row[colIndex]))).join('\n');
    await navigator.clipboard.writeText(text);
    toast.success(`已复制 ${colName} 列 (${results.length} 行)`);
  } catch { toast.error('复制失败'); }
};

const copyCellValue = async (value: unknown) => {
  try {
    const text = formatValueForCopy(value);
    await navigator.clipboard.writeText(text);
    const display = text.length > 20 ? text.substring(0, 20) + '...' : text;
    toast.success(`已复制: ${display}`);
  } catch { toast.error('复制失败'); }
};

const DEFAULT_COL_WIDTH = 120;
const MIN_COL_WIDTH = 40;


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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // 列宽
  const [colWidths, setColWidths] = useState<number[]>([]);
  const colWidthsRef = useRef<number[]>([]);
  const resizingCol = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    // 用 canvas 测量表头文字宽度，加上 padding + 复制按钮宽度
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.font = '500 13px sans-serif';
    const widths = columns.map(col => {
      const textWidth = ctx ? ctx.measureText(col).width : col.length * 8;
      // padding(20) + 复制按钮(28) + 手柄(6) + 余量(8)
      return Math.max(MIN_COL_WIDTH, Math.ceil(textWidth) + 62);
    });
    colWidthsRef.current = widths;
    setColWidths(widths);
  }, [columns]);

  const { uiPrefs, setUiPref } = useUserPrefsStore();
  const highlightColor = uiPrefs.sqlRowHighlightColor || '#8b5cf6';
  const colorInputRef = useRef<HTMLInputElement>(null);

  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canExport = hasPermission('sql:search:w');

  const useBackendPagination = !!onPageChange && !!queryId;
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
    if (useBackendPagination && onPageChange) onPageChange(newPage, pageSize);
    else setLocalPage(newPage);
  };

  const handleResultChange = (index: number) => {
    if (onResultChange && index >= 0 && index < allResults.length) {
      onResultChange(index);
      setLocalPage(1);
    }
  };

  useEffect(() => {
    setLocalPage(1); setSelectedRows(new Set()); lastClickedRow.current = null;
  }, [total]);

  // 键盘横向滚动
  useEffect(() => {
    const el = tableWrapperRef.current;
    if (!el) return;
    let rafId: number | null = null;
    const speed = 8;
    const startScroll = (dir: 1 | -1) => {
      if (rafId !== null) return;
      const step = () => { el.scrollLeft += dir * speed; rafId = requestAnimationFrame(step); };
      rafId = requestAnimationFrame(step);
    };
    const stopScroll = () => { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); startScroll(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); startScroll(1); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') stopScroll();
    };
    el.addEventListener('keydown', onKeyDown);
    el.addEventListener('keyup', onKeyUp);
    return () => { stopScroll(); el.removeEventListener('keydown', onKeyDown); el.removeEventListener('keyup', onKeyUp); };
  }, []);

  // 列宽拖拽 - 用 ref 读取当前宽度，避免闭包捕获旧 state
  const handleResizeMouseDown = useCallback((colIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = colWidthsRef.current[colIdx] ?? DEFAULT_COL_WIDTH;
    resizingCol.current = { colIdx, startX: e.clientX, startWidth };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingCol.current) return;
      const delta = ev.clientX - resizingCol.current.startX;
      const newWidth = Math.max(MIN_COL_WIDTH, resizingCol.current.startWidth + delta);
      colWidthsRef.current = colWidthsRef.current.map((w, i) => i === colIdx ? newWidth : w);
      setColWidths([...colWidthsRef.current]);
    };

    const onMouseUp = () => {
      resizingCol.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);


  const handleRowClick = useCallback((absoluteIndex: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedRow.current !== null) {
      const start = Math.min(lastClickedRow.current, absoluteIndex);
      const end = Math.max(lastClickedRow.current, absoluteIndex);
      setSelectedRows(prev => { const next = new Set(prev); for (let i = start; i <= end; i++) next.add(i); return next; });
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedRows(prev => { const next = new Set(prev); if (next.has(absoluteIndex)) next.delete(absoluteIndex); else next.add(absoluteIndex); return next; });
      lastClickedRow.current = absoluteIndex;
    } else {
      setSelectedRows(prev => (prev.size === 1 && prev.has(absoluteIndex) ? new Set() : new Set([absoluteIndex])));
      lastClickedRow.current = absoluteIndex;
    }
  }, []);

  const handleRowContextMenu = useCallback((absoluteIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedRows(prev => (!prev.has(absoluteIndex) ? new Set([absoluteIndex]) : prev));
    lastClickedRow.current = absoluteIndex;
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCopySelectedRows = useCallback(async () => {
    if (selectedRows.size === 0) return;
    const rowStart = (currentPage - 1) * pageSize;
    const sorted = [...selectedRows].sort((a, b) => a - b);
    const lines = sorted.map(absIdx => {
      const row = currentData[absIdx - rowStart];
      if (!Array.isArray(row)) return '';
      return row.map(v => formatValueForCopy(v)).join('\t');
    }).filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success(`已复制 ${lines.length} 行`);
    } catch { toast.error('复制失败'); }
    setContextMenu(null);
  }, [selectedRows, currentData, currentPage, pageSize]);

  const rowNumberStart = (currentPage - 1) * pageSize;

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
          if (currentPage !== 1) onPageChange(1, pageSize);
        }}
      />
    );
  }

  const hex = highlightColor.replace('#', '');
  const hr = parseInt(hex.slice(0, 2), 16);
  const hg = parseInt(hex.slice(2, 4), 16);
  const hb = parseInt(hex.slice(4, 6), 16);

  return (
    <div className={`result-panel ${isFullscreen ? 'fullscreen' : ''}`} onClick={() => setContextMenu(null)}>
      {contextMenu && (
        <div className="row-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={e => e.stopPropagation()}>
          <button onClick={handleCopySelectedRows}>📋 复制选中行 ({selectedRows.size})</button>
        </div>
      )}

      <div className="result-header">
        <div className="header-left">
          <span className="header-title">{isExecuting ? '执行中' : hasResults ? '查询结果' : '暂无结果'}</span>
          {(isExecuting || elapsedTime > 0) && <span className="elapsed-timer">{elapsedTime.toFixed(1)}s</span>}
          {showResultSelector && (
            <div className="result-selector">
              {allResults.map((rs, idx) => (
                <button key={idx} className={`selector-tab ${idx === currentResultIndex ? 'active' : ''}`}
                  onClick={() => handleResultChange(idx)} title={rs.sql || `结果集 ${idx + 1}`}>
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
              <input ref={colorInputRef} type="color" value={highlightColor}
                onChange={(e) => setUiPref('sqlRowHighlightColor', e.target.value as string)}
                className="highlight-color-input" />
            </div>
          )}
          {hasResults && (
            <button className="btn btn-link" onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? '退出全屏' : '全屏显示'}>
              {isFullscreen ? '⤢' : '⛶'}
            </button>
          )}
          {hasResults && queryId && canExport && (
            <button className={`btn btn-link ${exportLoading ? 'loading' : ''}`}
              onClick={() => { if (onExport && queryId) onExport(); }} disabled={exportLoading}>
              {exportLoading ? '导出中...' : '导出'}
            </button>
          )}
        </div>
      </div>


      <div className="result-table-wrapper" ref={tableWrapperRef} tabIndex={0}>
        {loading ? (
          <div className="result-loading">查询中...</div>
        ) : columns.length === 0 ? (
          <div className="result-empty">执行SQL查询后，结果将显示在这里</div>
        ) : (
          <table className="result-table" style={{ tableLayout: 'fixed', width: 'max-content' }}>
            <thead>
              <tr>
                <th className="row-num" style={{ width: 48, minWidth: 48 }}>#</th>
                {columns.map((col, colIdx) => {
                  const comment = columnComments.get(col.toLowerCase()) || '';
                  const w = colWidths[colIdx] ?? DEFAULT_COL_WIDTH;
                  return (
                    <th key={col} style={{ width: w, minWidth: w, maxWidth: w, overflow: 'visible', position: 'relative' }}>
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
                        <button className="copy-col-btn" title="复制此列数据"
                          onClick={(e) => { e.stopPropagation(); copyColumnData(results, colIdx, col); }}>
                          📋
                        </button>
                      </div>
                      <div className="col-resize-handle" onMouseDown={(e) => handleResizeMouseDown(colIdx, e)} />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {currentData.map((row, idx) => {
                const absoluteIndex = rowNumberStart + idx;
                const isSelected = selectedRows.has(absoluteIndex);
                const selectedTdStyle = isSelected ? { background: `rgba(${hr},${hg},${hb},0.18)` } : {};
                return (
                  <tr key={absoluteIndex} className={isSelected ? 'row-selected' : ''}
                    style={{ userSelect: 'none' }}
                    onClick={(e) => handleRowClick(absoluteIndex, e)}
                    onContextMenu={(e) => handleRowContextMenu(absoluteIndex, e)}>
                    <td className="row-num" style={selectedTdStyle}>{absoluteIndex + 1}</td>
                    {Array.isArray(row) && row.map((val, colIdx) => {
                      const w = colWidths[colIdx] ?? DEFAULT_COL_WIDTH;
                      return (
                        <td key={colIdx} title={`双击复制: ${formatValue(val)}`}
                          onDoubleClick={() => copyCellValue(val)}
                          className="cell-copyable"
                          style={{ ...selectedTdStyle, width: w, minWidth: w, maxWidth: w }}>
                          {formatValue(val)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

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
            <button disabled={currentPage <= 1} onClick={() => handlePageChange(currentPage - 1)}>上一页</button>
            <span className="page-info">
              第 <input type="number" className="page-input" defaultValue={currentPage} key={currentPage}
                min={1} max={totalPages}
                onKeyDown={(e) => { if (e.key === 'Enter') { const v = parseInt((e.target as HTMLInputElement).value, 10); if (!isNaN(v) && v >= 1 && v <= totalPages) handlePageChange(v); } }}
                onBlur={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1 && v <= totalPages && v !== currentPage) handlePageChange(v); }}
              /> 页 / 共 {totalPages} 页
            </span>
            <button disabled={currentPage >= totalPages} onClick={() => handlePageChange(currentPage + 1)}>下一页</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultPanel;
