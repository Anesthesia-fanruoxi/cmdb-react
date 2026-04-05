/**
 * BI 查询全屏结果面板组件
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUserPrefsStore } from '@/stores/userPrefsStore';

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

  // 行点击：普通=单选，Ctrl=切换，Shift=范围选
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
      setSelectedRows(prev => (prev.size === 1 && prev.has(idx) ? new Set() : new Set([idx])));
      lastClickedRow.current = idx;
    }
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
                <th key={col}>{col}</th>
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
                    background: isSelected ? `rgba(${r},${g},${b},0.18)` : undefined, 
                    userSelect: 'none' 
                  }}
                  onClick={(e) => handleRowClick(idx, e)}
                >
                  <td className="row-num">{idx + 1}</td>
                  {Array.isArray(row) ? (
                    row.map((val, colIdx) => (
                      <td key={colIdx}>{formatValue(val)}</td>
                    ))
                  ) : (
                    columns.map((col, colIdx) => (
                      <td key={colIdx}>{formatValue((row as any)[col])}</td>
                    ))
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
    </div>
  );
};

export default FullscreenResultPanel;
