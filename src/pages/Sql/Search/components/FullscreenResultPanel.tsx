/**
 * 全屏结果面板组件
 * 支持无限滚动加载、列宽拖拽调整
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUserPrefsStore } from '../../../../stores/userPrefsStore';
import toast from '../../../../components/Toast';

const copyCellValue = async (value: unknown) => {
  try {
    const text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    await navigator.clipboard.writeText(text);
    const display = text.length > 20 ? text.substring(0, 20) + '...' : text;
    toast.success(`已复制: ${display}`);
  } catch {
    toast.error('复制失败');
  }
};

interface Props {
  columns: string[];
  results: unknown[][];
  total: number;
  took: number;
  dbName?: string;
  currentPage: number;
  onPageChange: (page: number, size: number) => void;
  onClose: () => void;
}

const pageSize = 20;
const MIN_COL_WIDTH = 40;

const FullscreenResultPanel = ({
  columns, results, total, took, dbName, currentPage, onPageChange, onClose
}: Props) => {
  const [accumulatedData, setAccumulatedData] = useState<unknown[][]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const lastClickedRow = useRef<number | null>(null);

  const { uiPrefs, setUiPref } = useUserPrefsStore();
  const highlightColor = uiPrefs.sqlRowHighlightColor || '#8b5cf6';
  const colorInputRef = useRef<HTMLInputElement>(null);

  const batchLoadingDataRef = useRef<unknown[][]>([]);
  const batchLoadingPageRef = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const theadWrapperRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<number | null>(null);

  // 列宽
  const [colWidths, setColWidths] = useState<number[]>([]);
  const colWidthsRef = useRef<number[]>([]);
  const resizingCol = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.font = '500 12px sans-serif';
    const widths = columns.map(col => {
      const textWidth = ctx ? ctx.measureText(col).width : col.length * 8;
      return Math.max(MIN_COL_WIDTH, Math.ceil(textWidth) + 62);
    });
    colWidthsRef.current = widths;
    setColWidths(widths);
  }, [columns]);

  const handleResizeMouseDown = useCallback((colIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = colWidthsRef.current[colIdx] ?? 120;
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

  const totalPages = Math.ceil(total / pageSize) || 1;
  const hasMore = currentPage < totalPages;

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  useEffect(() => {
    if (currentPage === 1 && total > 20) {
      batchLoadingDataRef.current = [...results];
      batchLoadingPageRef.current = 1;
      onPageChange(2, pageSize);
    } else {
      setAccumulatedData([...results]);
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isInitialLoading || batchLoadingPageRef.current === 0) return;
    if (currentPage === 2 && batchLoadingPageRef.current === 1 && results.length > 0) {
      batchLoadingDataRef.current.push(...results);
      batchLoadingPageRef.current = 2;
      if (total > 40) {
        onPageChange(3, pageSize);
      } else {
        setAccumulatedData(batchLoadingDataRef.current.slice(0, total));
        setIsInitialLoading(false);
        batchLoadingPageRef.current = 0;
      }
    } else if (currentPage === 3 && batchLoadingPageRef.current === 2 && results.length > 0) {
      batchLoadingDataRef.current.push(...results);
      setAccumulatedData(batchLoadingDataRef.current.slice(0, total));
      setIsInitialLoading(false);
      batchLoadingPageRef.current = 0;
    }
  }, [isInitialLoading, currentPage, results, total, onPageChange]);

  useEffect(() => {
    if (isInitialLoading || !isLoadingMore) return;
    if (currentPage > 3 && results.length > 0) {
      const savedScrollTop = scrollContainerRef.current?.scrollTop || 0;
      setAccumulatedData(prev => {
        if (prev.length === 0) return prev;
        const lastRow = prev[prev.length - 1];
        const firstNewRow = results[0];
        if (JSON.stringify(lastRow) !== JSON.stringify(firstNewRow)) {
          const newData = [...prev, ...results].slice(0, total);
          requestAnimationFrame(() => {
            if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = savedScrollTop;
          });
          return newData;
        }
        return prev;
      });
      setIsLoadingMore(false);
    }
  }, [isInitialLoading, isLoadingMore, currentPage, results]);

  const handleRowClick = useCallback((idx: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedRow.current !== null) {
      const start = Math.min(lastClickedRow.current, idx);
      const end = Math.max(lastClickedRow.current, idx);
      setSelectedRows(prev => { const next = new Set(prev); for (let i = start; i <= end; i++) next.add(i); return next; });
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedRows(prev => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; });
      lastClickedRow.current = idx;
    } else {
      setSelectedRows(prev => (prev.size === 1 && prev.has(idx) ? new Set() : new Set([idx])));
      lastClickedRow.current = idx;
    }
  }, []);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    // 同步表头横向滚动
    if (theadWrapperRef.current) {
      theadWrapperRef.current.scrollLeft = target.scrollLeft;
    }
    if (scrollTimerRef.current) cancelAnimationFrame(scrollTimerRef.current);
    scrollTimerRef.current = requestAnimationFrame(() => {
      const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
      if (distanceToBottom < 100 && !isLoadingMore && hasMore && !isInitialLoading) {
        setIsLoadingMore(true);
        onPageChange(currentPage + 1, pageSize);
      }
    }) as unknown as number;
  }, [isLoadingMore, hasMore, isInitialLoading, currentPage, onPageChange]);

  useEffect(() => {
    return () => { if (scrollTimerRef.current) cancelAnimationFrame(scrollTimerRef.current); };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (!scrollContainerRef.current) return;
      const c = scrollContainerRef.current;
      const step = 100;
      switch (e.key) {
        case 'ArrowUp': e.preventDefault(); c.scrollTop -= step; break;
        case 'ArrowDown': e.preventDefault(); c.scrollTop += step; break;
        case 'ArrowLeft': e.preventDefault(); c.scrollLeft -= step; break;
        case 'ArrowRight': e.preventDefault(); c.scrollLeft += step; break;
        case 'PageUp': e.preventDefault(); c.scrollTop -= c.clientHeight; break;
        case 'PageDown': e.preventDefault(); c.scrollTop += c.clientHeight; break;
        case 'Home': e.preventDefault(); c.scrollTop = 0; break;
        case 'End': e.preventDefault(); c.scrollTop = c.scrollHeight; break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const hex = highlightColor.replace('#', '');
  const hr = parseInt(hex.slice(0, 2), 16);
  const hg = parseInt(hex.slice(2, 4), 16);
  const hb = parseInt(hex.slice(4, 6), 16);

  return (
    <div className="fullscreen-result-panel">
      <div className="fullscreen-header">
        <div className="header-left">
          <span className="header-title">查询结果（全屏）</span>
        </div>
        <div className="header-right">
          <div className="row-highlight-picker" title="自定义选中行高亮颜色">
            <span className="highlight-color-dot" style={{ background: highlightColor }} onClick={() => colorInputRef.current?.click()} />
            <input ref={colorInputRef} type="color" value={highlightColor}
              onChange={(e) => setUiPref('sqlRowHighlightColor', e.target.value as string)}
              className="highlight-color-input" />
          </div>
          <button className="btn btn-link" onClick={onClose} title="退出全屏">⤢</button>
        </div>
      </div>

      {/* 固定表头 */}
      <div ref={theadWrapperRef} className="fullscreen-thead-wrapper">
        {!isInitialLoading && (
          <table className="fullscreen-table" style={{ tableLayout: 'fixed', minWidth: 'max-content' }}>
            <thead>
              <tr>
                <th className="row-num" style={{ width: 48, minWidth: 48 }}>#</th>
                {columns.map((col, colIdx) => {
                  const w = colWidths[colIdx] ?? 120;
                  return (
                    <th key={col} style={{ width: w, minWidth: w, maxWidth: w, position: 'relative' }}>
                      {col}
                      <div className="col-resize-handle" onMouseDown={(e) => handleResizeMouseDown(colIdx, e)} />
                    </th>
                  );
                })}
              </tr>
            </thead>
          </table>
        )}
      </div>

      {/* 滚动内容区 */}
      <div ref={scrollContainerRef} className="fullscreen-table-wrapper" onScroll={handleScroll}>
        {isInitialLoading ? (
          <div className="result-loading">加载中...</div>
        ) : (
          <>
            <table className="fullscreen-table" style={{ tableLayout: 'fixed', minWidth: 'max-content' }}>
              <tbody>
                {accumulatedData.map((row, idx) => {
                  const isSelected = selectedRows.has(idx);
                  const selectedStyle = isSelected ? { background: `rgba(${hr},${hg},${hb},0.18)` } : {};
                  return (
                    <tr key={idx} className={isSelected ? 'row-selected' : ''}
                      style={{ userSelect: 'none' }}
                      onClick={(e) => handleRowClick(idx, e)}>
                      <td className="row-num" style={{ ...selectedStyle, width: 48, minWidth: 48 }}>{idx + 1}</td>
                      {(row as unknown[]).map((val, colIdx) => {
                        const w = colWidths[colIdx] ?? 120;
                        return (
                          <td key={colIdx} title="双击复制"
                            onDoubleClick={(e) => { e.stopPropagation(); copyCellValue(val); }}
                            className="cell-copyable"
                            style={{ ...selectedStyle, width: w, minWidth: w, maxWidth: w }}>
                            {formatValue(val)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {isLoadingMore && <div className="loading-more"><span>加载中...</span></div>}
            {!hasMore && accumulatedData.length > 0 && (
              <div className="no-more-data"><span>已加载全部数据 (共 {accumulatedData.length} 条)</span></div>
            )}
          </>
        )}
      </div>

      <div className="fullscreen-footer">
        <div className="result-stats">
          <span>总行数: {total}</span>
          <span>耗时: {took}ms</span>
          {dbName && <span>数据库: {dbName}</span>}
          <span>已加载: {accumulatedData.length} 条 / 共 {total} 条</span>
        </div>
      </div>
    </div>
  );
};

export default FullscreenResultPanel;
