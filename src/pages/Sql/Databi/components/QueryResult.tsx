/**
 * BI 查询结果组件
 */

import { useState, useRef, useCallback } from 'react';
import { useUserPrefsStore } from '@/stores/userPrefsStore';

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
  
  // 颜色选取器
  const { uiPrefs, setUiPref } = useUserPrefsStore();
  const highlightColor = uiPrefs.sqlRowHighlightColor || '#8b5cf6';
  const colorInputRef = useRef<HTMLInputElement>(null);

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

      <div className="result-content">
        {loading ? (
          <div className="loading">查询中...</div>
        ) : resultData.length > 0 ? (
          <table className="result-table">
            <thead>
              <tr>
                <th className="copy-column">#</th>
                {resultColumns.map((col, colIndex) => (
                  <th key={col}>
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
                      background: isSelected ? `rgba(${r},${g},${b},0.18)` : undefined,
                      userSelect: 'none'
                    }}
                    onClick={(e) => handleRowClick(rowIndex, e)}
                  >
                    <td className="copy-column">
                      <button
                        className="copy-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCopyRow(rowIndex);
                        }}
                        title="复制整行"
                      >
                        📋
                      </button>
                    </td>
                    {resultColumns.map((col, colIndex) => {
                      const value = typeof row === 'object' && !Array.isArray(row)
                        ? row[col]
                        : row[colIndex];
                      return (
                        <td key={colIndex}>
                          {formatValue(value)}
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
    </div>
  );
};

