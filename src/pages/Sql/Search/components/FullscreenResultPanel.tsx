/**
 * 全屏结果面板组件
 * 支持无限滚动加载、列宽拖拽调整
 * 注意：全屏模式仅用于数据预览，不提供任何复制功能（数据安全）
 *
 * 加载状态机（loadPhase）：
 *   init   → 组件挂载，等待第1页数据
 *   batch  → 自动预加载第2、3页（最多 PRELOAD_PAGES 页）
 *   scroll → 用户滚动到底部时按需加载
 *   done   → 全部数据已加载完毕
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUserPrefsStore } from '@/stores/userPrefsStore';
import CellDetailModal from './CellDetailModal';
import { useCellHoverTip, CellHoverTip } from './CellHoverTip';
import type { CommentMap } from '../hooks/useColumnComments';

interface Props {
  columns: string[];
  results: unknown[][];
  total: number;
  took: number;
  dbName?: string;
  currentPage: number;
  onPageChange: (page: number, size: number) => void;
  onClose: () => void;
  columnComments?: CommentMap;
}

const PAGE_SIZE = 20;
const MIN_COL_WIDTH = 80;
const MAX_COL_WIDTH = 360;
// 初始化时自动预加载的最大页数
const PRELOAD_PAGES = 3;

type LoadPhase = 'init' | 'batch' | 'scroll' | 'done';

const FullscreenResultPanel = ({
  columns,
  results,
  total,
  took,
  dbName,
  onPageChange,
  onClose,
  columnComments = new Map(),
}: Props) => {
  const [accumulatedData, setAccumulatedData] = useState<unknown[][]>([]);
  const [loadPhase, setLoadPhase] = useState<LoadPhase>('init');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [cellDetail, setCellDetail] = useState<{ value: string; colName: string } | null>(null);
  const { tip: cellTip, showTip, hideTip } = useCellHoverTip();
  const lastClickedRow = useRef<number | null>(null);

  // 划选（拖拽选择）状态
  const dragSelectRef = useRef<{ anchor: number; active: boolean }>({ anchor: -1, active: false });

  const { uiPrefs, setUiPref } = useUserPrefsStore();
  const highlightColor = uiPrefs.sqlRowHighlightColor || '#8b5cf6';
  const colorInputRef = useRef<HTMLInputElement>(null);

  // 当前已发出请求、等待响应的页码
  const pendingPageRef = useRef<number>(1);
  // 批量预加载阶段的数据缓冲区
  const batchBufferRef = useRef<unknown[][]>([]);
  // 防止滚动事件重复触发加载
  const isScrollLoadingRef = useRef(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const theadWrapperRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<number | null>(null);

  // 列宽
  const [colWidths, setColWidths] = useState<number[]>([]);
  const colWidthsRef = useRef<number[]>([]);
  const resizingCol = useRef<{
    colIdx: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  // 根据列名 + 采样数据自动计算初始列宽
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const headerFont = '500 12px sans-serif';
    const cellFont = '13px sans-serif';
    const sampleRows = results.slice(0, 10);

    const widths = columns.map((col, colIdx) => {
      if (ctx) ctx.font = headerFont;
      const headerWidth = ctx ? ctx.measureText(col).width : col.length * 7;

      if (ctx) ctx.font = cellFont;
      let maxDataWidth = 0;
      for (const row of sampleRows) {
        if (Array.isArray(row) && row[colIdx] !== undefined && row[colIdx] !== null) {
          const text = String(row[colIdx]);
          const w = ctx ? ctx.measureText(text).width : text.length * 7;
          if (w > maxDataWidth) maxDataWidth = w;
        }
      }

      const contentWidth = Math.max(headerWidth, maxDataWidth) + 40;
      return Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, Math.ceil(contentWidth)));
    });
    colWidthsRef.current = widths;
    setColWidths(widths);
  }, [columns, results]);

  // 列宽拖拽
  const handleResizeMouseDown = useCallback(
    (colIdx: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startWidth = colWidthsRef.current[colIdx] ?? 120;
      resizingCol.current = { colIdx, startX: e.clientX, startWidth };

      const onMouseMove = (ev: MouseEvent) => {
        if (!resizingCol.current) return;
        const delta = ev.clientX - resizingCol.current.startX;
        const newWidth = Math.max(
          MIN_COL_WIDTH,
          resizingCol.current.startWidth + delta
        );
        colWidthsRef.current = colWidthsRef.current.map((w, i) =>
          i === colIdx ? newWidth : w
        );
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
    },
    []
  );

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // ─── 初始化：挂载时处理第1页数据（仅执行一次）────────────────────────────
  useEffect(() => {
    if (results.length === 0) {
      setLoadPhase('done');
      return;
    }

    if (totalPages > 1) {
      // 缓存第1页，进入批量预加载阶段
      batchBufferRef.current = [...results];
      pendingPageRef.current = 2;
      setLoadPhase('batch');
      onPageChange(2, PAGE_SIZE);
    } else {
      // 只有一页，直接完成
      setAccumulatedData([...results]);
      setLoadPhase('done');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅挂载时执行一次，不依赖任何变量

  // ─── 统一响应 results 变化（init 阶段由上面的 effect 处理，这里跳过）──────
  useEffect(() => {
    if (loadPhase === 'init') return;
    if (results.length === 0) return;

    // ── 批量预加载阶段 ──
    if (loadPhase === 'batch') {
      const receivedPage = pendingPageRef.current;
      batchBufferRef.current.push(...results);

      const nextPage = receivedPage + 1;
      const canContinue = nextPage <= PRELOAD_PAGES && nextPage <= totalPages;

      if (canContinue) {
        pendingPageRef.current = nextPage;
        onPageChange(nextPage, PAGE_SIZE);
        // 继续等待，不改变 loadPhase
      } else {
        // 预加载完成，展示数据
        const finalData = batchBufferRef.current.slice(0, total);
        batchBufferRef.current = [];
        setAccumulatedData(finalData);

        if (finalData.length >= total) {
          setLoadPhase('done');
        } else {
          // 还有更多数据，等待用户滚动
          pendingPageRef.current = receivedPage + 1;
          isScrollLoadingRef.current = false;
          setLoadPhase('scroll');
        }
      }
      return;
    }

    // ── 滚动加载阶段 ──
    if (loadPhase === 'scroll') {
      const savedScrollTop = scrollContainerRef.current?.scrollTop ?? 0;

      setAccumulatedData((prev) => {
        const merged = [...prev, ...results].slice(0, total);
        // 恢复滚动位置，防止追加数据后页面跳动
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = savedScrollTop;
          }
        });
        return merged;
      });

      // 更新下一次请求的页码，解锁滚动加载
      pendingPageRef.current = pendingPageRef.current + 1;
      isScrollLoadingRef.current = false;

      // 判断是否还有更多
      if (pendingPageRef.current > totalPages) {
        setLoadPhase('done');
      }
      return;
    }
  // results 变化是唯一触发条件；loadPhase 作为读取值，不作为触发条件
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  // ─── 行选中 ────────────────────────────────────────────────────────────────
  const handleRowNumClick = useCallback((idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey && lastClickedRow.current !== null) {
      const start = Math.min(lastClickedRow.current, idx);
      const end = Math.max(lastClickedRow.current, idx);
      setSelectedRows((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) next.add(i);
        return next;
      });
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        return next;
      });
      lastClickedRow.current = idx;
    } else {
      setSelectedRows((prev) =>
        prev.size === 1 && prev.has(idx) ? new Set() : new Set([idx])
      );
      lastClickedRow.current = idx;
    }
  }, []);

  // 序号列按下开始划选
  const handleRowNumMouseDown = useCallback((idx: number, e: React.MouseEvent) => {
    if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey) return;
    dragSelectRef.current = { anchor: idx, active: true };
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
  const handleRowDragEnter = useCallback((idx: number) => {
    if (!dragSelectRef.current.active) return;
    const anchor = dragSelectRef.current.anchor;
    const start = Math.min(anchor, idx);
    const end = Math.max(anchor, idx);
    setSelectedRows(() => {
      const next = new Set<number>();
      for (let i = start; i <= end; i++) next.add(i);
      return next;
    });
  }, []);

  // 单击单元格：弹出详情框（全屏模式仅预览，无复制，无双击冲突）
  const handleCellClick = useCallback((val: unknown, colName: string) => {
    if (val === null || val === undefined) return; // NULL 不弹框
    const text = typeof val === 'object' ? JSON.stringify(val) : String(val);
    setCellDetail({ value: text, colName });
  }, []);

  // ─── 滚动处理 ──────────────────────────────────────────────────────────────
  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;

      // 同步表头横向滚动
      if (theadWrapperRef.current) {
        theadWrapperRef.current.scrollLeft = target.scrollLeft;
      }

      if (scrollTimerRef.current) cancelAnimationFrame(scrollTimerRef.current);
      scrollTimerRef.current = requestAnimationFrame(() => {
        const distanceToBottom =
          target.scrollHeight - target.scrollTop - target.clientHeight;

        // 只有在 scroll 阶段、未在加载中、距底部 < 150px 时才触发
        if (
          distanceToBottom < 150 &&
          loadPhase === 'scroll' &&
          !isScrollLoadingRef.current
        ) {
          isScrollLoadingRef.current = true;
          onPageChange(pendingPageRef.current, PAGE_SIZE);
        }
      }) as unknown as number;
    },
    [loadPhase, onPageChange]
  );

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) cancelAnimationFrame(scrollTimerRef.current);
    };
  }, []);

  // ─── 键盘快捷键 ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 详情弹框打开时，按键全部交给弹框处理（Esc 先关弹框，再按一次才退出全屏）
      if (cellDetail) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (!scrollContainerRef.current) return;
      const c = scrollContainerRef.current;
      const step = 100;
      switch (e.key) {
        case 'ArrowUp':    e.preventDefault(); c.scrollTop -= step; break;
        case 'ArrowDown':  e.preventDefault(); c.scrollTop += step; break;
        case 'ArrowLeft':  e.preventDefault(); c.scrollLeft -= step; break;
        case 'ArrowRight': e.preventDefault(); c.scrollLeft += step; break;
        case 'PageUp':     e.preventDefault(); c.scrollTop -= c.clientHeight; break;
        case 'PageDown':   e.preventDefault(); c.scrollTop += c.clientHeight; break;
        case 'Home':       e.preventDefault(); c.scrollTop = 0; break;
        case 'End':        e.preventDefault(); c.scrollTop = c.scrollHeight; break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, cellDetail]);

  // ─── 高亮颜色解析 ──────────────────────────────────────────────────────────
  const hex = highlightColor.replace('#', '');
  const hr = parseInt(hex.slice(0, 2), 16);
  const hg = parseInt(hex.slice(2, 4), 16);
  const hb = parseInt(hex.slice(4, 6), 16);

  const isInitialLoading = loadPhase === 'init' || loadPhase === 'batch';
  const isLoadingMore = isScrollLoadingRef.current && loadPhase === 'scroll';

  // ─── 渲染 ──────────────────────────────────────────────────────────────────
  return (
    <div className="fullscreen-result-panel">
      <div className="fullscreen-header">
        <div className="header-left">
          <span className="header-title">查询结果（全屏）</span>
        </div>
        <div className="header-right">
          <div className="row-highlight-picker" title="自定义选中行高亮颜色">
            <span
              className="highlight-color-dot"
              style={{ background: highlightColor }}
              onClick={() => colorInputRef.current?.click()}
            />
            <input
              ref={colorInputRef}
              type="color"
              value={highlightColor}
              onChange={(e) =>
                setUiPref('sqlRowHighlightColor', e.target.value as string)
              }
              className="highlight-color-input"
            />
          </div>
          <button className="btn btn-link" onClick={onClose} title="退出全屏">
            ⤢
          </button>
        </div>
      </div>

      {/* 固定表头 */}
      <div ref={theadWrapperRef} className="fullscreen-thead-wrapper">
        {!isInitialLoading && (
          <table
            className="fullscreen-table"
            style={{ tableLayout: 'fixed', minWidth: 'max-content' }}
          >
            <thead>
              <tr>
                <th className="row-num" style={{ width: 48, minWidth: 48 }}>
                  #
                </th>
                {columns.map((col, colIdx) => {
                  const comment = columnComments.get(col.toLowerCase()) || '';
                  const w = colWidths[colIdx] ?? 120;
                  return (
                    <th
                      key={col}
                      style={{
                        width: w,
                        minWidth: w,
                        maxWidth: w,
                        position: 'relative',
                        overflow: 'visible',
                      }}
                    >
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
                      <div
                        className="col-resize-handle"
                        onMouseDown={(e) => handleResizeMouseDown(colIdx, e)}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
          </table>
        )}
      </div>

      {/* 滚动内容区 */}
      <div
        ref={scrollContainerRef}
        className="fullscreen-table-wrapper"
        onScroll={handleScroll}
      >
        {isInitialLoading ? (
          <div className="result-loading">加载中...</div>
        ) : (
          <>
            <table
              className="fullscreen-table"
              style={{ tableLayout: 'fixed', minWidth: 'max-content' }}
            >
              <tbody>
                {accumulatedData.map((row, idx) => {
                  const isSelected = selectedRows.has(idx);
                  const selectedStyle = isSelected
                    ? { background: `rgba(${hr},${hg},${hb},0.18)` }
                    : {};
                  return (
                    <tr
                      key={idx}
                      className={isSelected ? 'row-selected' : ''}
                      style={{ userSelect: 'none' }}
                      onMouseEnter={() => handleRowDragEnter(idx)}
                    >
                      <td
                        className="row-num row-num-selectable"
                        style={{ ...selectedStyle, width: 48, minWidth: 48 }}
                        onClick={(e) => handleRowNumClick(idx, e)}
                        onMouseDown={(e) => handleRowNumMouseDown(idx, e)}
                      >
                        {idx + 1}
                      </td>
                      {(row as unknown[]).map((val, colIdx) => {
                        const w = colWidths[colIdx] ?? 120;
                        return (
                          <td
                            key={colIdx}
                            onClick={() => handleCellClick(val, columns[colIdx] ?? `col_${colIdx}`)}
                            onMouseEnter={(e) => {
                              const td = e.currentTarget;
                              if (td.scrollWidth > td.clientWidth) showTip(formatValue(val), td);
                            }}
                            onMouseLeave={hideTip}
                            style={{
                              ...selectedStyle,
                              width: w,
                              minWidth: w,
                              maxWidth: w,
                            }}
                          >
                            {formatValue(val)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {isLoadingMore && (
              <div className="loading-more">
                <span>加载中...</span>
              </div>
            )}
            {loadPhase === 'done' && accumulatedData.length > 0 && (
              <div className="no-more-data">
                <span>已加载全部数据 (共 {accumulatedData.length} 条)</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* 单元格悬浮提示 */}
      <CellHoverTip tip={cellTip} />

      {/* 单元格详情弹框（仅预览，不提供复制） */}
      {cellDetail && (
        <CellDetailModal
          value={cellDetail.value}
          colName={cellDetail.colName}
          readonly
          onClose={() => setCellDetail(null)}
        />
      )}

      <div className="fullscreen-footer">
        <div className="result-stats">
          <span>总行数: {total}</span>
          <span>耗时: {took}ms</span>
          {dbName && <span>数据库: {dbName}</span>}
          <span>
            已加载: {accumulatedData.length} 条 / 共 {total} 条
          </span>
        </div>
      </div>
    </div>
  );
};

export default FullscreenResultPanel;
