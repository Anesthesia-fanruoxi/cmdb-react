/**
 * BI 查询单个标签页工作区组件
 */

import { useRef, useEffect, useState } from 'react';
import SqlEditor, { type SqlEditorRef } from '../../Search/components/SqlEditor';
import { QueryResult } from './QueryResult';
import type { DatabiTab, TreeNode } from '../types';

interface DatabiWorkspaceProps {
  tab: DatabiTab;
  onSqlChange: (sql: string) => void;
  onExecute: () => void;
  onClear: () => void;
  onCopyColumn: (colIndex: number) => void;
  onCopyRow: (rowIndex: number) => void;
  onFullscreen: () => void;
  onEditorHeightChange: (percent: number) => void;
  onEditorRefReady: (ref: SqlEditorRef | null) => void;
}

export const DatabiWorkspace = ({
  tab,
  onSqlChange,
  onExecute,
  onClear,
  onCopyColumn,
  onCopyRow,
  onFullscreen,
  onEditorHeightChange,
  onEditorRefReady
}: DatabiWorkspaceProps) => {
  const sqlEditorRef = useRef<SqlEditorRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartPercent = useRef(0);

  // 通知父组件编辑器引用已准备好
  useEffect(() => {
    onEditorRefReady(sqlEditorRef.current);
  }, [onEditorRefReady]);

  // 处理拖动开始
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartPercent.current = tab.editorHeightPercent;
  };

  // 处理拖动
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const containerHeight = containerRef.current.clientHeight;
      const delta = e.clientY - dragStartY.current;
      const deltaPercent = (delta / containerHeight) * 100;
      
      const newPercent = Math.max(10, Math.min(90, dragStartPercent.current + deltaPercent));
      onEditorHeightChange(newPercent);
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
  }, [isDragging, onEditorHeightChange]);

  return (
    <div ref={containerRef} className="databi-workspace">
      {/* 工具栏 */}
      <div className="workspace-toolbar">
        <div className="toolbar-left">
          <button
            className="btn btn-primary"
            onClick={onExecute}
            disabled={tab.queryLoading || !tab.project}
          >
            {tab.queryLoading ? '执行中...' : '▶ 执行'}
          </button>
          <button 
            className="btn" 
            onClick={onClear} 
            disabled={!tab.sqlQuery}
          >
            清空
          </button>
        </div>
      </div>

      {/* 编辑器容器 */}
      <div
        className="editor-container"
        style={{ height: `${tab.editorHeightPercent}%`, flexShrink: 0 }}
      >
        <SqlEditor
          ref={sqlEditorRef}
          value={tab.sqlQuery}
          onChange={onSqlChange}
          onExecute={onExecute}
          loading={tab.queryLoading}
        />
      </div>

      {/* 拖拽分隔条 */}
      <div
        className={`editor-resize-handle ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleDragStart}
      >
        <div className="resize-handle-bar" />
      </div>

      {/* 查询结果 */}
      <div className="result-panel-wrapper">
        <QueryResult
          loading={tab.queryLoading}
          resultData={tab.resultData}
          resultColumns={tab.resultColumns}
          took={tab.took}
          onCopyColumn={onCopyColumn}
          onCopyRow={onCopyRow}
          onFullscreen={onFullscreen}
        />
      </div>
    </div>
  );
};
