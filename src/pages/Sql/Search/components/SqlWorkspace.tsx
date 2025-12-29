/**
 * SQL工作区组件 - 包含编辑器和结果面板
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import SqlEditor from './SqlEditor';
import ResultPanel from './ResultPanel';
import { getTableStructure } from '@/services/sql/search';
import type { TableInfo, FieldInfo } from '@/utils/sql';

/** 结果集类型 */
export interface ResultSet {
  data: unknown[][];
  columns: string[];
  total: number;
  took: number;
  db_name: string;
  sql: string;
  queryId: string;
  name: string;
}

/** 消息类型 */
export interface Message {
  type: 'error' | 'warning' | 'info';
  content: string;
}

interface Props {
  sql: string;
  onSqlChange: (sql: string) => void;
  onExecute: (sql: string, isSelection: boolean) => void;
  loading: boolean;
  exportLoading: boolean;
  // 结果数据
  results: unknown[][];
  columns: string[];
  total: number;
  took: number;
  dbName: string;
  queryId: string;
  // 多结果集
  allResults: ResultSet[];
  currentResultIndex: number;
  onResultChange: (index: number) => void;
  // 分页
  currentPage: number;
  onPageChange: (page: number, size: number) => void;
  // 导出
  onExport: () => void;
  // 消息
  messages: Message[];
  // SQL 智能提示
  tableList?: string[];
  project?: string;
}

const SqlWorkspace = ({
  sql,
  onSqlChange,
  onExecute,
  loading,
  exportLoading,
  results,
  columns,
  total,
  took,
  dbName,
  queryId,
  allResults,
  currentResultIndex,
  onResultChange,
  currentPage,
  onPageChange,
  onExport,
  messages,
  tableList = [],
  project = ''
}: Props) => {
  // 编辑器高度（手动调整）
  const [editorHeight, setEditorHeight] = useState(200);
  // 是否正在拖动
  const [isDragging, setIsDragging] = useState(false);
  // 拖动起始位置
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  // 编辑器容器引用
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // 转换表列表为 TableInfo 格式
  const tables: TableInfo[] = useMemo(() => 
    tableList.map(name => ({ name })), [tableList]
  );

  // 加载表结构的回调 - 与 Vue 版本对齐
  const loadTableStructure = useCallback(async (tableName: string): Promise<FieldInfo[] | null> => {
    if (!project || !dbName) return null;
    try {
      const res = await getTableStructure({ agent: project, dbName, tbName: tableName });
      if (res.code === 200 && res.data) {
        // 新的数据结构处理 - 与 Vue 版本一致
        const tableInfo = res.data;
        const columns = tableInfo.columns || [];
        
        // 转换为 FieldInfo 格式
        const fields: FieldInfo[] = columns.map((field: any) => ({
          caption: field.field,
          value: field.field,
          meta: field.type || 'field',
          comment: `${tableName} - ${field.comment || ''}`,
          score: field.key === 'PRI' ? 1000 : 900,
          tableName,
          isPrimaryKey: field.key === 'PRI'
        }));
        
        // 直接缓存到 window.sqlFieldSuggestions - 与 Vue 版本一致
        if (typeof window !== 'undefined' && fields.length > 0) {
          if (!window.sqlFieldSuggestions) {
            window.sqlFieldSuggestions = {};
          }
          window.sqlFieldSuggestions[tableName] = fields;
          window.sqlFieldSuggestions[tableName.toLowerCase()] = fields;
        }
        
        return fields;
      }
    } catch (error) {
      console.error('加载表结构失败:', error);
    }
    return null;
  }, [project, dbName]);

  // 执行 SQL
  const handleExecute = useCallback(() => {
    const selection = window.getSelection()?.toString()?.trim();
    const isSelection = !!selection;
    const sqlToExecute = selection || sql;
    onExecute(sqlToExecute, isSelection);
  }, [sql, onExecute]);

  // 处理拖动开始
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = editorHeight;
  }, [editorHeight]);

  // 处理拖动
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - dragStartY.current;
      const newHeight = Math.max(100, Math.min(600, dragStartHeight.current + delta));
      setEditorHeight(newHeight);
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

  // Ctrl+E 快捷键执行
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (!loading) {
          handleExecute();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [loading, handleExecute]);

  return (
    <div className="sql-workspace">
      {/* 工具栏 */}
      <div className="workspace-toolbar">
        <div className="toolbar-left">
          <button className="btn btn-primary" onClick={handleExecute} disabled={loading || !sql.trim()}>
            {loading ? '执行中...' : '▶ 执行'}
          </button>
          <button className="btn btn-default" onClick={() => onSqlChange('')} disabled={!sql}>
            清空
          </button>
        </div>
        <div className="toolbar-shortcuts">
          <span className="shortcut-hint">Ctrl+E 执行</span>
          <span className="shortcut-hint">Ctrl+Enter 执行</span>
          <span className="shortcut-hint">Ctrl+F 格式化</span>
        </div>
      </div>

      {/* 编辑器容器 */}
      <div
        ref={editorContainerRef}
        className="editor-container"
        style={{ height: editorHeight }}
      >
        <SqlEditor
          value={sql}
          onChange={onSqlChange}
          onExecute={handleExecute}
          loading={loading}
          tables={tables}
          currentDb={dbName}
          loadTableStructure={loadTableStructure}
        />
      </div>

      {/* 拖动条 */}
      <div
        className={`editor-resize-handle ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleDragStart}
      >
        <div className="resize-handle-bar" />
      </div>

      {/* 消息区域 */}
      {messages.length > 0 && (
        <div className="messages-panel">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message message-${msg.type}`}>
              {msg.content}
            </div>
          ))}
        </div>
      )}

      {/* 结果面板 */}
      <ResultPanel
        columns={columns}
        results={results}
        total={total}
        took={took}
        loading={loading}
        dbName={dbName}
        allResults={allResults}
        currentResultIndex={currentResultIndex}
        onResultChange={onResultChange}
        currentPage={currentPage}
        onPageChange={onPageChange}
        exportLoading={exportLoading}
        onExport={onExport}
        queryId={queryId}
      />
    </div>
  );
};

export default SqlWorkspace;
