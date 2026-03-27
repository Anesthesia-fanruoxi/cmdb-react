/**
 * 字段详情弹框组件
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { pinyin } from 'pinyin-pro';
import type { ColumnDialogState } from '../types';

interface ColumnDetailDialogProps {
  state: ColumnDialogState;
  onClose: () => void;
  onInsertField: (colName: string) => void;
  onEditField: (colName: string) => void;
  onCancelEdit: (colName: string) => void;
  onSaveField: (colName: string) => void;
  onCommentChange: (colName: string, comment: string) => void;
}

/**
 * 模糊搜索匹配函数（顺序匹配 + 拼音首字母匹配）
 * 例如: 
 * - "cs" 可以匹配 "ce_shi"、"c_shi"（英文顺序匹配）
 * - "cs" 可以匹配 "测试"（中文拼音首字母）
 * - "cs" 不匹配 "shice"（逆序）
 */
const fuzzyMatch = (text: string, search: string): boolean => {
  if (!search) return true;
  
  const textLower = text.toLowerCase();
  const searchLower = search.toLowerCase();
  
  // 1. 英文顺序匹配
  let searchIndex = 0;
  for (let i = 0; i < textLower.length && searchIndex < searchLower.length; i++) {
    if (textLower[i] === searchLower[searchIndex]) {
      searchIndex++;
    }
  }
  if (searchIndex === searchLower.length) return true;
  
  // 2. 中文拼音首字母匹配
  try {
    // 获取拼音首字母
    const pinyinFirst = pinyin(text, { pattern: 'first', toneType: 'none' }).toLowerCase();
    
    // 顺序匹配拼音首字母
    searchIndex = 0;
    for (let i = 0; i < pinyinFirst.length && searchIndex < searchLower.length; i++) {
      if (pinyinFirst[i] === searchLower[searchIndex]) {
        searchIndex++;
      }
    }
    if (searchIndex === searchLower.length) return true;
    
    // 3. 中文拼音全拼匹配
    const pinyinFull = pinyin(text, { toneType: 'none' }).toLowerCase();
    searchIndex = 0;
    for (let i = 0; i < pinyinFull.length && searchIndex < searchLower.length; i++) {
      if (pinyinFull[i] === searchLower[searchIndex]) {
        searchIndex++;
      }
    }
    if (searchIndex === searchLower.length) return true;
  } catch (e) {
    // 如果拼音转换失败，忽略错误
  }
  
  return false;
};

export const ColumnDetailDialog = ({
  state,
  onClose,
  onInsertField,
  onEditField,
  onCancelEdit,
  onSaveField,
  onCommentChange
}: ColumnDetailDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const [searchText, setSearchText] = useState('');
  const [isFocused, setIsFocused] = useState(true); // 对话框是否聚焦

  // 过滤后的字段列表
  const filteredColumns = useMemo(() => {
    if (!searchText.trim()) return state.columns;
    
    return state.columns.filter(col => 
      fuzzyMatch(col.col_name, searchText) || 
      fuzzyMatch(col.comment || '', searchText)
    );
  }, [state.columns, searchText]);

  // 拖拽开始
  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.dialog-body, input, button')) {
      return;
    }
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  // 拖拽中
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // 居中显示
  useEffect(() => {
    if (state.visible && dialogRef.current && position.x === 0 && position.y === 0) {
      const rect = dialogRef.current.getBoundingClientRect();
      setPosition({
        x: (window.innerWidth - rect.width) / 2,
        y: (window.innerHeight - rect.height) / 2
      });
    }
  }, [state.visible]);

  // 处理对话框外部点击 - 失焦但不关闭
  useEffect(() => {
    if (!state.visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        // 点击外部，失焦
        setIsFocused(false);
      }
    };

    // 延迟添加监听，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [state.visible]);

  // 点击对话框恢复聚焦
  const handleDialogClick = () => {
    if (!isFocused) {
      setIsFocused(true);
    }
  };

  if (!state.visible) return null;

  return (
    <div
      ref={dialogRef}
      className={`dialog-container ${isDragging ? 'dragging' : ''} ${!isFocused ? 'unfocused' : ''}`}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`
      }}
      onClick={handleDialogClick}
    >
      <div className="dialog-header" onMouseDown={handleDragStart}>
        <h2 className="dialog-title">字段列表 - {state.tableName}</h2>
      </div>

        <div className="dialog-body">
          {state.loading ? (
            <div className="loading-state">加载中...</div>
          ) : (
            <>
              <div className="search-box">
                <input
                  type="text"
                  placeholder="搜索字段名或注释..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="search-input"
                />
                {searchText && (
                  <button 
                    className="btn-clear-search"
                    onClick={() => setSearchText('')}
                    title="清空搜索"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="table-wrapper">
                <table className="column-table">
                  <thead>
                    <tr>
                      <th className="col-name">字段名</th>
                      <th className="col-type">数据类型</th>
                      <th className="col-comment">注释</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredColumns.length > 0 ? (
                      filteredColumns.map((col) => (
                        <tr key={col.col_name}>
                          <td 
                            className="col-name clickable"
                            onClick={() => onInsertField(col.col_name)}
                            title="点击插入字段到编辑器"
                          >
                            {col.col_name}
                          </td>
                          <td className="col-type">{col.data_type}</td>
                          <td className="col-comment">
                            {state.editingField === col.col_name ? (
                              <div className="edit-mode">
                                <input
                                  type="text"
                                  value={col.comment}
                                  onChange={(e) => onCommentChange(col.col_name, e.target.value)}
                                  placeholder="请输入注释"
                                  className="comment-input"
                                  autoFocus
                                />
                                <div className="edit-actions">
                                  <button
                                    className="btn-save"
                                    onClick={() => onSaveField(col.col_name)}
                                    disabled={state.saving}
                                  >
                                    保存
                                  </button>
                                  <button
                                    className="btn-cancel"
                                    onClick={() => onCancelEdit(col.col_name)}
                                    disabled={state.saving}
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div 
                                className="display-mode"
                                onDoubleClick={() => onEditField(col.col_name)}
                                title="双击编辑注释"
                              >
                                <span>{col.comment || '-'}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                          未找到匹配的字段
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn btn-primary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
  );
};
