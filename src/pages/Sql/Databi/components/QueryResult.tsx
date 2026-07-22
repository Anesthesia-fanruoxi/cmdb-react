/**
 * BI 查询结果组件
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useUserPrefsStore } from '@/stores/userPrefsStore';
import { toast } from '@/components/AppNotification';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  rowIndex: number;
  cellValue: string;
}

interface QueryResultProps {
  loading: boolean;
  resultData: unknown[][];
  resultColumns: string[];
  took: number;
  onCopyColumn: (colIndex: number) => void;
  onCopyRow: (rowIndex: number) => void;
  onFullscreen?: () => void;
}

export const QueryResult = ({
  loading,
  resultData,
  resultColumns,
  took,
  onCopyColumn,
  onCopyRow,
  onFullscreen
}: QueryResultProps) => {
  // 多选
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const lastClickedRow = useRef<number | null>(null);

  // 划选（拖拽选择）状态
  const dragSelectRef = useRef<{ anchor: number; active: boolean }>({ anchor: -1, active: false });

  // 右键菜单
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, rowIndex: -1, cellValue: ''
  });
  const menuRef = useRef<HTMLDivElement>(null);

  // 滚动容器
  const resultContentRef = useRef<HTMLDivElement>(null);
  
  // 颜色选取器
  const { uiPrefs, setUiPref } = useUserPrefsStore();
  const highlightColor = uiPrefs.sqlRowHighlightColor || '#8b5cf6';
  const colorInputRef = useRef<HTMLInputElement>(null);

  // 点击其他地方关闭右键菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu.visible]);

  // 键盘横向滚动（按住方向键连续滚动）
  useEffect(() => {
    const el = resultContentRef.current;
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
  }, [resultData.length > 0]);

  // 序号列点击：选中/取消选中
  const handleRowNumClick = useCallback((idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey && lastClickedRow.current !== null) {
      const start = Math.min(lastClickedRow.current, idx);
      const end = Math.max(lastClickedRow.current, idx);
      setSelectedRows(prev => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) next.add(i);
        return next;
      });
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedRows(prev => {
        const next = new Set(prev);
        if (next.has(idx)) next.delete(idx); else next.add(idx);
        return next;
      });
      lastClickedRow.current = idx;
    } else {
      setSelectedRows(prev => (prev.size === 1 && prev.has(idx) ? new Set() : new Set([idx])));
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

  // 双击单元格复制
  const handleCellDoubleClick = useCallback((value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      const display = value.length > 20 ? value.slice(0, 20) + '...' : value;
      toast.success(`已复制: ${display}`);
    });
  }, []);

  // 右键菜单
  const handleContextMenu = useCallback((e: React.MouseEvent, rowIndex: number, cellValue: string) => {
    e.preventDefault();
    e.stopPropagation();
    // 如果右键的行未选中，先选中它
    setSelectedRows(prev => {
      if (!prev.has(rowIndex)) {
        return new Set([rowIndex]);
      }
      return prev;
    });
    lastClickedRow.current = rowIndex;
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, rowIndex, cellValue });
  }, []);

  // 复制单元格
  const handleCopyCell = useCallback(() => {
    navigator.clipboard.writeText(contextMenu.cellValue).then(() => {
      const display = contextMenu.cellValue.length > 50
        ? contextMenu.cellValue.slice(0, 50) + '...'
        : contextMenu.cellValue;
      toast.success(`已复制: ${display}`);
    });
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, [contextMenu.cellValue]);

  // 复制整行（通过右键菜单）
  const handleCopyRowFromMenu = useCallback(() => {
    onCopyRow(contextMenu.rowIndex);
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, [contextMenu.rowIndex, onCopyRow]);

  // 双击复制表头
  const handleDoubleClickHeader = useCallback((col: string) => {
    navigator.clipboard.writeText(col).then(() => {
      toast.success(`已复制表头: ${col}`);
    });
  }, []);

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="result-section">
      <div className="result-header">
        <span className="title">查询结果</span>
        <div className="result-header-right">
          {resultData.length > 0 && (
            <>
              <span className="info">
                共 {resultData.length} 条记录
                {took > 0 && ` | 耗时: ${took}ms`}
                {selectedRows.size > 0 && ` | 已选中: ${selectedRows.size} 行`}
              </span>
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
                  onChange={(e) => setUiPref('sqlRowHighlightColor', e.target.value as string)}
                  className="highlight-color-input"
                />
              </div>
              {onFullscreen && (
                <button 
                  className="btn-fullscreen" 
                  onClick={onFullscreen}
                  title="全屏查看"
                >
                  ⛶
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="result-content" ref={resultContentRef} tabIndex={0}>
        {loading ? (
          <div className="loading">查询中...</div>
        ) : resultData.length > 0 ? (
          <table className="result-table">
            <thead>
              <tr>
                <th className="copy-column">#</th>
                {resultColumns.map((col, colIndex) => (
                  <th key={col} onDoubleClick={() => handleDoubleClickHeader(col)} style={{ cursor: 'pointer' }}>
                    <div className="th-content">
                      <span>{col}</span>
                      <button
                        className="copy-btn"
                        onClick={() => onCopyColumn(colIndex)}
                        title="复制整列"
                      >
                        📋
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultData.map((row, rowIndex) => {
                const isSelected = selectedRows.has(rowIndex);
                const hex = highlightColor.replace('#', '');
                const r = parseInt(hex.slice(0, 2), 16);
                const g = parseInt(hex.slice(2, 4), 16);
                const b = parseInt(hex.slice(4, 6), 16);
                
                return (
                  <tr 
                    key={rowIndex}
                    className={isSelected ? 'row-selected' : ''}
                    style={{ 
                      '--row-highlight': isSelected ? `rgba(${r},${g},${b},0.35)` : undefined,
                      userSelect: 'none'
                    } as React.CSSProperties}
                    onMouseEnter={() => handleRowDragEnter(rowIndex)}
                  >
                    <td className="copy-column row-num-selectable"
                      onClick={(e) => handleRowNumClick(rowIndex, e)}
                      onMouseDown={(e) => handleRowNumMouseDown(rowIndex, e)}
                    >
                      {rowIndex + 1}
                    </td>
                    {resultColumns.map((col, colIndex) => {
                      const value = typeof row === 'object' && !Array.isArray(row)
                        ? row[col]
                        : row[colIndex];
                      const formatted = formatValue(value);
                      return (
                        <td
                          key={colIndex}
                          onDoubleClick={() => handleCellDoubleClick(formatted)}
                          onContextMenu={(e) => handleContextMenu(e, rowIndex, formatted)}
                        >
                          {formatted}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <span>暂无数据</span>
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu.visible && (
        <div
          ref={menuRef}
          className="databi-context-menu"
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="context-menu-item" onClick={handleCopyCell}>
            📋 复制单元格
          </div>
          <div className="context-menu-item" onClick={handleCopyRowFromMenu}>
            📄 复制整行
          </div>
        </div>
      )}
    </div>
  );
};
