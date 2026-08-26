/**
 * SQL工作区组件 - 包含编辑器和结果面板
 */

import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import SqlEditor, { type SqlEditorRef } from './SqlEditor';
import ResultPanel from './ResultPanel';
import { useUserPrefsStore } from '@/stores/userPrefsStore';
import type { TableInfo } from '@/utils/sql';
import { useColumnComments } from '../hooks/useColumnComments';

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
  tabId?: string  // 标签页唯一键
  isActive?: boolean
  sql: string;
  onSqlChange: (sql: string) => void;
  onExecute: (sql: string) => void;
  onCancelQuery?: () => void;
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
  lastExecutedSql?: string;
}

const SqlWorkspace = ({
  sql,
  onSqlChange,
  onExecute,
  onCancelQuery,
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
  project = '',
  lastExecutedSql = ''
}: Props) => {
  // 用 ref 持有最新回调，避免 memo 因回调引用变化而失效
  const onSqlChangeRef = useRef(onSqlChange);
  onSqlChangeRef.current = onSqlChange;
  const stableSqlChange = useCallback((sql: string) => onSqlChangeRef.current(sql), []);

  const onExecuteRef = useRef(onExecute);
  onExecuteRef.current = onExecute;

  // 从用户偏好获取编辑器高度百分比
  const { uiPrefs, setUiPref, _hasHydrated } = useUserPrefsStore();
  const sqlEyeProtect = uiPrefs.sqlEyeProtect ?? false;
  const [editorHeightPercent, setEditorHeightPercent] = useState(50); // 默认50%
  // 是否正在拖动
  const [isDragging, setIsDragging] = useState(false);
  // 执行计时器
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isExecuting, setIsExecuting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // 容器引用，用于获取总高度
  const containerRef = useRef<HTMLDivElement>(null);

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

  // hydration 完成后同步高度百分比
  useEffect(() => {
    if (_hasHydrated) {
      // 如果有保存的值且合理（10-90之间），使用保存的值
      if (uiPrefs.sqlEditorHeightPercent && uiPrefs.sqlEditorHeightPercent >= 10 && uiPrefs.sqlEditorHeightPercent <= 90) {
        setEditorHeightPercent(uiPrefs.sqlEditorHeightPercent);
      } else {
        // 否则使用默认值并保存
        setEditorHeightPercent(50);
        setUiPref('sqlEditorHeightPercent', 50);
      }
    }
  }, [_hasHydrated, uiPrefs.sqlEditorHeightPercent, setUiPref]);
  // 拖动起始位置
  const dragStartY = useRef(0);
  const dragStartPercent = useRef(0);
  // 编辑器容器引用
  const editorContainerRef = useRef<HTMLDivElement>(null);
  // SQL 编辑器引用
  const sqlEditorRef = useRef<SqlEditorRef>(null);

  // 转换表列表为 TableInfo 格式
  const tables: TableInfo[] = useMemo(() => 
    tableList.map(name => ({ name, dbName })), [tableList, dbName]
  );

  // 获取列备注（仅根据实际执行的 SQL 中涉及的表，避免编辑器内其他语句干扰）
  const columnComments = useColumnComments(lastExecutedSql, project, dbName, queryId);

  const handleExecute = useCallback(() => {
    const selectedText = sqlEditorRef.current?.getSelectedText()?.trim()
    const sqlToExecute = selectedText || sqlEditorRef.current?.getValue() || sql
    setIsExecuting(true)
    onExecuteRef.current(sqlToExecute)
  }, [sql])

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
    dragStartPercent.current = editorHeightPercent;
  }, [editorHeightPercent]);

  // 当前百分比 ref（用于拖动结束时保存最新值）
  const currentPercentRef = useRef(editorHeightPercent);
  currentPercentRef.current = editorHeightPercent;

  // 处理拖动
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const containerHeight = containerRef.current.clientHeight;
      const delta = e.clientY - dragStartY.current;
      const deltaPercent = (delta / containerHeight) * 100;
      
      // 限制范围：10% - 90%，并四舍五入到整数
      const newPercent = Math.round(Math.max(10, Math.min(90, dragStartPercent.current + deltaPercent)));
      setEditorHeightPercent(newPercent);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // 保存百分比到用户偏好（只在拖动结束时保存）
      const percentToSave = Math.round(currentPercentRef.current);
      setUiPref('sqlEditorHeightPercent', percentToSave);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, setUiPref]);

  return (
    <div ref={containerRef} className="sql-workspace" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 工具栏 */}
      <div className="workspace-toolbar">
        <div className="toolbar-left">
          {loading ? (
            <button className="btn btn-danger" onClick={onCancelQuery}>
              ⏹ 取消
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleExecute} disabled={!sql.trim()}>
              ▶ 执行
            </button>
          )}
          <button className="btn btn-default" onClick={handleFormat} disabled={!sql.trim()}>
            格式化
          </button>
          <button className="btn btn-default" onClick={handleFind} disabled={!sql.trim()}>
            查找
          </button>
          <button className="btn btn-default" onClick={handleReplace} disabled={!sql.trim()}>
            替换
          </button>
          <button className="btn btn-default" onClick={() => stableSqlChange('')} disabled={!sql}>
            清空
          </button>
          <button
            className={`btn btn-eye-protect ${sqlEyeProtect ? 'active' : ''}`}
            onClick={() => setUiPref('sqlEyeProtect', !sqlEyeProtect)}
            title={sqlEyeProtect ? '关闭护眼模式' : '开启护眼模式'}
          >
            {sqlEyeProtect ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>
      </div>

      {/* 编辑器容器 */}
      <div
        ref={editorContainerRef}
        className="editor-container"
        style={{ height: `${editorHeightPercent}%`, flexShrink: 0 }}
      >
        <SqlEditor
          ref={sqlEditorRef}
          value={sql}
          onChange={stableSqlChange}
          onExecute={handleExecute}
          onNewTab={onNewTab}
          onShowHistory={onShowHistory}
          loading={loading}
          tables={tables}
          currentDb={dbName}
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

      {/* 结果面板 - 占用剩余空间 */}
      <div style={{ flex: 1, minHeight: '10%', display: 'flex', flexDirection: 'column' }}>
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
          columnComments={columnComments}
          lastExecutedSql={lastExecutedSql}
        />
      </div>
    </div>
  );
};

function areSqlWorkspacePropsEqual(previous: Props, next: Props): boolean {
  return (
    previous.tabId === next.tabId
    && previous.isActive === next.isActive
    && previous.sql === next.sql
    && previous.loading === next.loading
    && previous.exportLoading === next.exportLoading
    && previous.results === next.results
    && previous.columns === next.columns
    && previous.total === next.total
    && previous.took === next.took
    && previous.dbName === next.dbName
    && previous.queryId === next.queryId
    && previous.allResults === next.allResults
    && previous.currentResultIndex === next.currentResultIndex
    && previous.currentPage === next.currentPage
    && previous.messages === next.messages
    && previous.tableList === next.tableList
    && previous.project === next.project
    && previous.lastExecutedSql === next.lastExecutedSql
  )
}

export default memo(SqlWorkspace, areSqlWorkspacePropsEqual);
