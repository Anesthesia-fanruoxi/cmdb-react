/**
 * BI 查询全屏结果面板组件
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUserPrefsStore } from '@/stores/userPrefsStore';
import { toast } from '@/components/AppNotification';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  rowIndex: number;
  cellValue: string;
}

interface Props {
  columns: string[];
  results: unknown[][];
  took: number;
  onClose: () => void;
}

const FullscreenResultPanel = ({ columns, results, took, onClose }: Props) => {
  // 多选
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const lastClickedRow = useRef<number | null>(null);

  // 右键菜单
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, rowIndex: -1, cellValue: ''
  });
  const menuRef = useRef<HTMLDivElement>(null);
  
  // 颜色选取器
  const { uiPrefs, setUiPref } = useUserPrefsStore();
  const highlightColor = uiPrefs.sqlRowHighlightColor || '#8b5cf6';
  const colorInputRef = useRef<HTMLInputElement>(null);
  
  // 滚动容器引用
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

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

  // 单击行：选中
  const handleRowClick = useCallback((idx: number, e: React.MouseEvent) => {
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
      setSelectedRows(new Set([idx]));
      lastClickedRow.current = idx;
    }
  }, []);

  // 双击行：取消选中
  const handleRowDoubleClick = useCallback((idx: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.delete(idx);
      return next;
    });
  }, []);

  // 右键菜单
  const handleContextMenu = useCallback((e: React.MouseEvent, rowIndex: number, cellValue: string) => {
    e.preventDefault();
    e.stopPropagation();
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

  // 复制整行
  const handleCopyRowFromMenu = useCallback(() => {
    const rowIdx = contextMenu.rowIndex;
    if (rowIdx < 0 || rowIdx >= results.length) return;
    const row = results[rowIdx];
    const text = Array.isArray(row)
      ? row.map(v => formatValue(v)).join('\t')
      : columns.map(col => formatValue((row as any)[col])).join('\t');
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`已复制第 ${rowIdx + 1} 行`);
    });
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, [contextMenu.rowIndex, results, columns, formatValue]);

  // 双击复制表头
  const handleDoubleClickHeader = useCallback((col: string) => {
    navigator.clipboard.writeText(col).then(() => {
      toast.success(`已复制表头: ${col}`);
    });
  }, []);

  // 键盘方向键控制滚动 + ESC 退出全屏
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC 键退出全屏
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      
      if (!scrollContainerRef.current) return;
      
      const scrollStep = 100;
      const container = scrollContainerRef.current;
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          container.scrollTop -= scrollStep;
          break;
        case 'ArrowDown':
          e.preventDefault();
          container.scrollTop += scrollStep;
          break;
        case 'ArrowLeft':
          e.preventDefault();
          container.scrollLeft -= scrollStep;
          break;
        case 'ArrowRight':
          e.preventDefault();
          container.scrollLeft += scrollStep;
          break;
        case 'PageUp':
          e.preventDefault();
          container.scrollTop -= container.clientHeight;
          break;
        case 'PageDown':
          e.preventDefault();
          container.scrollTop += container.clientHeight;
          break;
        case 'Home':
          e.preventDefault();
          container.scrollTop = 0;
          break;
        case 'End':
          e.preventDefault();
          container.scrollTop = container.scrollHeight;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fullscreen-result-panel">
      {/* 顶部 */}
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
              onChange={(e) => setUiPref('sqlRowHighlightColor', e.target.value as string)}
              className="highlight-color-input"
            />
          </div>
          <button className="btn btn-link" onClick={onClose} title="退出全屏 (ESC)">
            ⤢
          </button>
        </div>
      </div>

      {/* 表格 */}
      <div ref={scrollContainerRef} className="fullscreen-table-wrapper">
        <table className="fullscreen-table">
          <thead>
            <tr>
              <th className="row-num">#</th>
              {columns.map((col) => (
                <th key={col} onDoubleClick={() => handleDoubleClickHeader(col)} style={{ cursor: 'pointer' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((row, idx) => {
              const isSelected = selectedRows.has(idx);
              const hex = highlightColor.replace('#', '');
              const r = parseInt(hex.slice(0, 2), 16);
              const g = parseInt(hex.slice(2, 4), 16);
              const b = parseInt(hex.slice(4, 6), 16);
              return (
                <tr
                  key={idx}
                  className={isSelected ? 'row-selected' : ''}
                  style={{ 
                    '--row-highlight': isSelected ? `rgba(${r},${g},${b},0.35)` : undefined,
                    userSelect: 'none' 
                  } as React.CSSProperties}
                  onClick={(e) => handleRowClick(idx, e)}
                  onDoubleClick={() => handleRowDoubleClick(idx)}
                >
                  <td className="row-num">{idx + 1}</td>
                  {Array.isArray(row) ? (
                    row.map((val, colIdx) => {
                      const formatted = formatValue(val);
                      return (
                        <td key={colIdx} onContextMenu={(e) => handleContextMenu(e, idx, formatted)}>{formatted}</td>
                      );
                    })
                  ) : (
                    columns.map((col, colIdx) => {
                      const formatted = formatValue((row as any)[col]);
                      return (
                        <td key={colIdx} onContextMenu={(e) => handleContextMenu(e, idx, formatted)}>{formatted}</td>
                      );
                    })
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 底部统计 */}
      <div className="fullscreen-footer">
        <div className="result-stats">
          <span>总行数: {results.length}</span>
          {took > 0 && <span>耗时: {took}ms</span>}
          {selectedRows.size > 0 && <span>已选中: {selectedRows.size} 行</span>}
        </div>
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

export default FullscreenResultPanel;
