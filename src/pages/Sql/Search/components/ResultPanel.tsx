/**
 * 查询结果面板组件
 * 支持多结果集切换、后端分页、导出、列宽拖拽调整
 */

import { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../../../../stores/authStore';
import { useUserPrefsStore } from '../../../../stores/userPrefsStore';
import toast from '../../../../components/Toast';
import type { ResultSet } from './SqlWorkspace';
import FullscreenResultPanel from './FullscreenResultPanel';
import CellDetailModal from './CellDetailModal';
import { useCellHoverTip, CellHoverTip } from './CellHoverTip';
import type { CommentMap } from '../hooks/useColumnComments';
import { buildInsertStatements, extractTableNameFromSql } from '../utils/copyFormat';
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
  lastExecutedSql?: string;
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

const DEFAULT_COL_WIDTH = 150;
const MIN_COL_WIDTH = 80;
const MAX_COL_WIDTH = 360;


const ResultPanel = ({
  columns, results, total, took, loading, isExecuting = false, elapsedTime = 0, dbName,
  allResults = [], currentResultIndex = 0, onResultChange,
  currentPage: externalPage, onPageChange,
  exportLoading = false, onExport, queryId,
  columnComments = new Map(),
  lastExecutedSql = ''
}: Props) => {
  const [localPage, setLocalPage] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [cellDetail, setCellDetail] = useState<{ value: string; colName: string } | null>(null);
  const { tip: cellTip, showTip, hideTip } = useCellHoverTip();
  const lastClickedRow = useRef<number | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowIndex: number; cellValue: string } | null>(null);

  // 划选（拖拽选择）状态
  const dragSelectRef = useRef<{ anchor: number; active: boolean }>({ anchor: -1, active: false });

  // 列宽
  const [colWidths, setColWidths] = useState<number[]>([]);
  const colWidthsRef = useRef<number[]>([]);
  const resizingCol = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    // 用 canvas 测量表头 + 采样前10行数据，取最大宽度
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const headerFont = '500 12px sans-serif';
    const cellFont = '13px sans-serif';
    const sampleRows = results.slice(0, 10);

    const widths = columns.map((col, colIdx) => {
      // 测量表头宽度
      if (ctx) ctx.font = headerFont;
      const headerWidth = ctx ? ctx.measureText(col).width : col.length * 7;

      // 采样数据行，取最大内容宽度
      if (ctx) ctx.font = cellFont;
      let maxDataWidth = 0;
      for (const row of sampleRows) {
        if (Array.isArray(row) && row[colIdx] !== undefined && row[colIdx] !== null) {
          const text = String(row[colIdx]);
          const w = ctx ? ctx.measureText(text).width : text.length * 7;
          if (w > maxDataWidth) maxDataWidth = w;
        }
      }

      // 取表头和数据中较大的，加 padding(24) + 余量(16)
      const contentWidth = Math.max(headerWidth, maxDataWidth) + 40;
      return Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, Math.ceil(contentWidth)));
    });
    colWidthsRef.current = widths;
    setColWidths(widths);
  }, [columns, results]);

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

  // 检测是否为错误结果（API返回错误信息作为结果）
  const isErrorResult = columns.length === 1 && columns[0] === 'error' && results.length > 0;
  const errorMessage = isErrorResult && Array.isArray(results[0]) ? formatValue(results[0][0]) : '';

  // 横向滚动位置独立管理：实时记录，每次渲染后恢复
  const scrollLeftRef = useRef<number>(0);
  const isRestoringRef = useRef<boolean>(false);

  const handleTableScroll = useCallback(() => {
    if (isRestoringRef.current) return;
    if (tableWrapperRef.current) {
      scrollLeftRef.current = tableWrapperRef.current.scrollLeft;
    }
  }, []);

  useLayoutEffect(() => {
    const el = tableWrapperRef.current;
    if (!el || scrollLeftRef.current === 0) return;
    isRestoringRef.current = true;
    requestAnimationFrame(() => {
      if (el) el.scrollLeft = scrollLeftRef.current;
      setTimeout(() => { isRestoringRef.current = false; }, 50);
    });
  });

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


  const handleRowNumClick = useCallback((absoluteIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
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

  // 序号列按下开始划选
  const handleRowNumMouseDown = useCallback((absoluteIndex: number, e: React.MouseEvent) => {
    if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey) return;
    dragSelectRef.current = { anchor: absoluteIndex, active: true };
    document.body.style.userSelect = 'none';

    const onMouseUp = () => {
      if (dragSelectRef.current.active) {
        dragSelectRef.current.active = false;
        lastClickedRow.current = dragSelectRef.current.anchor;
      }
      document.body.style.userSelect = '';
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  // 划选过程中经过行
  const handleRowDragEnter = useCallback((absoluteIndex: number) => {
    if (!dragSelectRef.current.active) return;
    const anchor = dragSelectRef.current.anchor;
    const start = Math.min(anchor, absoluteIndex);
    const end = Math.max(anchor, absoluteIndex);
    setSelectedRows(() => { const next = new Set<number>(); for (let i = start; i <= end; i++) next.add(i); return next; });
  }, []);

  // 单击单元格：延迟弹出详情框（避免与双击复制冲突）
  const handleCellClick = useCallback((val: unknown, colName: string, e: React.MouseEvent) => {
    if (e.detail !== 1) return; // 双击的第二下不处理
    const text = formatValueForCopy(val);
    if (!text) return; // NULL/空值不弹框
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = window.setTimeout(() => {
      setCellDetail({ value: text, colName });
    }, 220);
  }, []);

  // 双击单元格复制
  const handleCellDoubleClick = useCallback(async (val: unknown) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    const text = formatValueForCopy(val);
    try {
      await navigator.clipboard.writeText(text);
      const display = text.length > 20 ? text.substring(0, 20) + '...' : text;
      toast.success(`已复制: ${display}`);
    } catch { toast.error('复制失败'); }
  }, []);

  // 卸载时清理定时器
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  const handleRowContextMenu = useCallback((absoluteIndex: number, cellValue: string, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedRows(prev => (!prev.has(absoluteIndex) ? new Set([absoluteIndex]) : prev));
    lastClickedRow.current = absoluteIndex;
    setContextMenu({ x: e.clientX, y: e.clientY, rowIndex: absoluteIndex, cellValue });
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

  const handleCopyCurrentRow = useCallback(async () => {
    if (!contextMenu) return;
    const rowStart = (currentPage - 1) * pageSize;
    const row = currentData[contextMenu.rowIndex - rowStart];
    if (!Array.isArray(row)) return;
    const text = row.map(v => formatValueForCopy(v)).join('\t');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制当前行');
    } catch { toast.error('复制失败'); }
    setContextMenu(null);
  }, [contextMenu, currentData, currentPage, pageSize]);

  const handleCopyCell = useCallback(async () => {
    if (!contextMenu) return;
    try {
      await navigator.clipboard.writeText(contextMenu.cellValue);
      const display = contextMenu.cellValue.length > 20 ? contextMenu.cellValue.substring(0, 20) + '...' : contextMenu.cellValue;
      toast.success(`已复制: ${display}`);
    } catch { toast.error('复制失败'); }
    setContextMenu(null);
  }, [contextMenu]);

  // 复制为 INSERT：表名优先从执行的 SQL 解析，解析不到时弹框手动输入
  const [insertRows, setInsertRows] = useState<unknown[][] | null>(null);
  const [insertTableInput, setInsertTableInput] = useState('');

  const doCopyInsert = useCallback(async (tableName: string, rows: unknown[][]) => {
    try {
      await navigator.clipboard.writeText(buildInsertStatements(tableName, columns, rows));
      toast.success(`已复制 ${rows.length} 条 INSERT 语句`);
    } catch { toast.error('复制失败'); }
    setInsertRows(null);
    setContextMenu(null);
  }, [columns]);

  const copyAsInsert = useCallback((rows: unknown[][]) => {
    if (rows.length === 0) return;
    // 优先当前结果集对应的 SQL，其次整个执行 SQL 兜底
    const sql = allResults[currentResultIndex]?.sql || lastExecutedSql;
    const tableName = extractTableNameFromSql(sql);
    if (tableName) {
      doCopyInsert(tableName, rows);
    } else {
      setInsertTableInput('');
      setInsertRows(rows);
    }
    setContextMenu(null);
  }, [allResults, currentResultIndex, lastExecutedSql, doCopyInsert]);

  const copyCurrentRowAsInsert = useCallback(() => {
    if (!contextMenu) return;
    const rowStart = (currentPage - 1) * pageSize;
    const row = currentData[contextMenu.rowIndex - rowStart];
    if (!Array.isArray(row)) return;
    copyAsInsert([row]);
  }, [contextMenu, currentData, currentPage, pageSize, copyAsInsert]);

  const copySelectedRowsAsInsert = useCallback(() => {
    if (selectedRows.size === 0) return;
    const rowStart = (currentPage - 1) * pageSize;
    const rows = [...selectedRows].sort((a, b) => a - b)
      .map(absIdx => currentData[absIdx - rowStart])
      .filter((r): r is unknown[] => Array.isArray(r));
    copyAsInsert(rows);
  }, [selectedRows, currentData, currentPage, pageSize, copyAsInsert]);

  // 双击表头复制字段名
  const handleHeaderDoubleClick = useCallback(async (col: string) => {
    try {
      await navigator.clipboard.writeText(col);
      toast.success(`已复制字段名: ${col}`);
    } catch { toast.error('复制失败'); }
  }, []);

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
        columnComments={columnComments}
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
          <button onClick={handleCopyCell}>📋 复制此单元格</button>
          <div className="menu-divider" />
          <button onClick={handleCopyCurrentRow}>📄 当前行 - 复制数据</button>
          <button onClick={copyCurrentRowAsInsert}>📄 当前行 - 复制 INSERT</button>
          <div className="menu-divider" />
          <button onClick={handleCopySelectedRows}>📑 选中行({selectedRows.size}) - 复制数据</button>
          <button onClick={copySelectedRowsAsInsert}>📑 选中行({selectedRows.size}) - 复制 INSERT</button>
        </div>
      )}

      {/* 复制 INSERT 时表名解析失败的手动输入弹框 */}
      {insertRows && (
        <div className="insert-table-modal-overlay" onClick={() => setInsertRows(null)}>
          <div className="insert-table-modal" onClick={e => e.stopPropagation()}>
            <div className="insert-table-title">复制为 INSERT 语句</div>
            <div className="insert-table-tip">未能从 SQL 中解析到表名，请手动输入目标表名</div>
            <input
              className="insert-table-input"
              value={insertTableInput}
              autoFocus
              placeholder="如 db_name.table_name"
              onChange={e => setInsertTableInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && insertTableInput.trim()) doCopyInsert(insertTableInput.trim(), insertRows); }}
            />
            <div className="insert-table-actions">
              <button className="btn" onClick={() => setInsertRows(null)}>取消</button>
              <button className="btn btn-primary" disabled={!insertTableInput.trim()}
                onClick={() => doCopyInsert(insertTableInput.trim(), insertRows)}>复制</button>
            </div>
          </div>
        </div>
      )}

      {/* 单元格悬浮提示 */}
      <CellHoverTip tip={cellTip} />

      {/* 单元格详情弹框 */}
      {cellDetail && (
        <CellDetailModal
          value={cellDetail.value}
          colName={cellDetail.colName}
          onClose={() => setCellDetail(null)}
        />
      )}

      <div className="result-header">
        <div className="header-left">
          <span className="header-title" style={isErrorResult ? { color: '#ef4444' } : undefined}>{isExecuting ? '执行中' : isErrorResult ? '查询错误' : hasResults ? '查询结果' : '暂无结果'}</span>
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


      <div className="result-table-wrapper" ref={tableWrapperRef} tabIndex={0} onScroll={handleTableScroll}>
        {loading ? (
          <div className="result-loading">查询中...</div>
        ) : columns.length === 0 ? (
          <div className="result-empty">执行SQL查询后，结果将显示在这里</div>
        ) : isErrorResult ? (
          <div className="result-error-display">
            <div className="error-text">{errorMessage}</div>
          </div>
        ) : (
          <table className="result-table" style={{ tableLayout: 'fixed', width: 'max-content' }}>
            <thead>
              <tr>
                <th className="row-num" style={{ width: 48, minWidth: 48 }}>#</th>
                {columns.map((col, colIdx) => {
                  const comment = columnComments.get(col.toLowerCase()) || '';
                  const w = colWidths[colIdx] ?? DEFAULT_COL_WIDTH;
                  return (
                    <th key={col} style={{ width: w, minWidth: w, maxWidth: w, overflow: 'visible', position: 'relative' }}
                      onDoubleClick={() => handleHeaderDoubleClick(col)}>
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
                        <button className="col-copy-btn" title="复制此列数据"
                          onClick={(e) => { e.stopPropagation(); copyColumnData(results, colIdx, col); }}>
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                      </div>
                      {colIdx < columns.length - 1 && (
                        <div className="col-resize-handle" onMouseDown={(e) => handleResizeMouseDown(colIdx, e)} />
                      )}
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
                    onMouseEnter={() => handleRowDragEnter(absoluteIndex)}
                    onContextMenu={(e) => handleRowContextMenu(absoluteIndex, '', e)}>
                    <td className="row-num row-num-selectable" style={selectedTdStyle}
                      onClick={(e) => handleRowNumClick(absoluteIndex, e)}
                      onMouseDown={(e) => handleRowNumMouseDown(absoluteIndex, e)}>{absoluteIndex + 1}</td>
                    {Array.isArray(row) && row.map((val, colIdx) => {
                      const w = colWidths[colIdx] ?? DEFAULT_COL_WIDTH;
                      return (
                        <td key={colIdx}
                          className="cell-copyable"
                          onClick={(e) => handleCellClick(val, columns[colIdx] ?? `col_${colIdx}`, e)}
                          onDoubleClick={() => handleCellDoubleClick(val)}
                          onMouseEnter={(e) => {
                            const td = e.currentTarget;
                            if (td.scrollWidth > td.clientWidth) showTip(formatValue(val), td);
                          }}
                          onMouseLeave={hideTip}
                          onContextMenu={(e) => handleRowContextMenu(absoluteIndex, formatValue(val), e)}
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
