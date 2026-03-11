/**
 * SQL工作区组件 - 包含编辑器和结果面板
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import SqlEditor, { type SqlEditorRef } from './SqlEditor';
import ResultPanel from './ResultPanel';
import { getTableStructure } from '@/services/sql/search';
import { useUserPrefsStore } from '@/stores/userPrefsStore';
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
  onNewTab?: () => void;
  onShowHistory?: () => void;
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
  onNewTab,
  onShowHistory,
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
  // 从用户偏好获取编辑器高度
  const { uiPrefs, setUiPref, _hasHydrated } = useUserPrefsStore();
  const [editorHeight, setEditorHeight] = useState(200);
  // 是否正在拖动
  const [isDragging, setIsDragging] = useState(false);
  // 执行计时器
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isExecuting, setIsExecuting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 执行计时（0.1秒更新一次），只在执行查询时计时，翻页不计时
  useEffect(() => {
    if (isExecuting) {
      setElapsedTime(0);
      timerRef.current = setInterval(() => {
        setElapsedTime(t => t + 0.1);
      }, 100);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isExecuting]);

  // 当 loading 结束且正在执行时，停止计时
  useEffect(() => {
    if (!loading && isExecuting) {
      setIsExecuting(false);
    }
  }, [loading, isExecuting]);

  // hydration 完成后同步高度
  useEffect(() => {
    if (_hasHydrated && uiPrefs.sqlEditorHeight) {
      setEditorHeight(uiPrefs.sqlEditorHeight);
    }
  }, [_hasHydrated, uiPrefs.sqlEditorHeight]);
  // 拖动起始位置
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  // 编辑器容器引用
  const editorContainerRef = useRef<HTMLDivElement>(null);
  // SQL 编辑器引用
  const sqlEditorRef = useRef<SqlEditorRef>(null);

  // 转换表列表为 TableInfo 格式
  const tables: TableInfo[] = useMemo(() => 
    tableList.map(name => ({ name, dbName })), [tableList, dbName]
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
        // 修改：缓存字段时记录数据库名称
        if (typeof window !== 'undefined' && fields.length > 0) {
          if (!window.sqlFieldSuggestions) {
            window.sqlFieldSuggestions = {};
          }
          // 为每个字段添加 dbName 属性
          const fieldsWithDb = fields.map(f => ({
            ...f,
            dbName: dbName
          }));
          window.sqlFieldSuggestions[tableName] = fieldsWithDb;
          window.sqlFieldSuggestions[tableName.toLowerCase()] = fieldsWithDb;
        }
        
        return fields;
      }
    } catch (error) {
      console.error('加载表结构失败:', error);
    }
    return null;
  }, [project, dbName]);

  // 执行 SQL - 使用编辑器的选中文本
  const handleExecute = useCallback(() => {
    const selectedText = sqlEditorRef.current?.getSelectedText()?.trim();
    const isSelection = !!selectedText;
    const sqlToExecute = selectedText || sql;
    setIsExecuting(true);  // 开始执行，启动计时器
    onExecute(sqlToExecute, isSelection);
  }, [sql, onExecute]);

  // 格式化 SQL
  const handleFormat = useCallback(() => {
    sqlEditorRef.current?.format();
  }, []);

  // 查找
  const handleFind = useCallback(() => {
    sqlEditorRef.current?.showFind();
  }, []);

  // 替换
  const handleReplace = useCallback(() => {
    sqlEditorRef.current?.showReplace();
  }, []);

  // 处理拖动开始
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = editorHeight;
  }, [editorHeight]);

  // 当前高度 ref（用于拖动结束时保存最新值）
  const currentHeightRef = useRef(editorHeight);
  currentHeightRef.current = editorHeight;

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
      // 保存高度到用户偏好（使用 ref 获取最新值）
      setUiPref('sqlEditorHeight', currentHeightRef.current);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, editorHeight, setUiPref]);

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
          <button className="btn btn-default" onClick={handleFormat} disabled={!sql.trim()}>
            格式化
          </button>
          <button className="btn btn-default" onClick={handleFind} disabled={!sql.trim()}>
            查找
          </button>
          <button className="btn btn-default" onClick={handleReplace} disabled={!sql.trim()}>
            替换
          </button>
          <button className="btn btn-default" onClick={() => onSqlChange('')} disabled={!sql}>
            清空
          </button>
        </div>
      </div>

      {/* 编辑器容器 */}
      <div
        ref={editorContainerRef}
        className="editor-container"
        style={{ height: editorHeight }}
      >
        <SqlEditor
          ref={sqlEditorRef}
          value={sql}
          onChange={onSqlChange}
          onExecute={handleExecute}
          onNewTab={onNewTab}
          onShowHistory={onShowHistory}
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
        isExecuting={isExecuting}
        elapsedTime={elapsedTime}
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
