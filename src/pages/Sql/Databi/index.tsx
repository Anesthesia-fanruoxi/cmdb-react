/**
 * BI 查询页面 - 重构版本
 */

import { useState, useEffect, useRef } from 'react';
import { Upload } from 'lucide-react';
import { 
  getDatabiColumnList,
  updateDatabiColumnComment
} from '@/services/sql/databi';
import { toast } from '@/components/AppNotification';
import SqlEditor, { type SqlEditorRef } from '../Search/components/SqlEditor';
import { usePageStateStore } from '@/stores';
import { useDatabiProjects } from './hooks/useDatabiProjects';
import { useDatabiTables } from './hooks/useDatabiTables';
import { useDatabiQuery } from './hooks/useDatabiQuery';
import { TableTree } from './components/TableTree';
import { QueryResult } from './components/QueryResult';
import { ColumnDetailDialog } from './components/ColumnDetailDialog';
import { CsvImportDialog } from './components/CsvImportDialog';
import type { ContextMenuState, ColumnDialogState, CsvDialogState, TreeNode, CsvRow } from './types';
import './index.css';

const SqlDatabi = () => {
  // 页面状态管理
  const { setPageState, getPageState, _hasHydrated } = usePageStateStore();
  const PAGE_KEY = 'sql/databi';
  const hasRestored = useRef(false);

  // 使用自定义 Hooks
  const {
    projectList,
    projectLoading,
    currentProject,
    setCurrentProject,
    fetchProjects
  } = useDatabiProjects();

  const {
    tableLoading,
    refreshLoading,
    treeData,
    refreshProgress,
    refreshMessage,
    expandedKeys,
    closeSseConnection,
    handleProjectChange: handleTablesProjectChange,
    handleRefresh,
    toggleExpand
  } = useDatabiTables();

  const {
    queryLoading,
    resultData,
    resultColumns,
    took,
    executeQuery,
    handleCopyColumn,
    handleCopyRow,
    clearResults
  } = useDatabiQuery();

  // SQL 编辑器
  const sqlEditorRef = useRef<SqlEditorRef>(null);
  const [sqlQuery, setSqlQuery] = useState('');

  // 编辑器高度拖拽
  const [editorHeightPercent, setEditorHeightPercent] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartPercent = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 右键菜单
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    node: null
  });

  // CSV 上传
  const csvInputRef = useRef<HTMLInputElement>(null);

  // 字段详情弹框
  const [columnDialog, setColumnDialog] = useState<ColumnDialogState>({
    visible: false,
    loading: false,
    saving: false,
    tableName: '',
    columns: [],
    originalColumns: [],
    editingField: null
  });

  // CSV 导入弹框
  const [csvDialog, setCsvDialog] = useState<CsvDialogState>({
    visible: false,
    loading: false,
    saving: false,
    dbName: '',
    tableName: '',
    matched: [],
    unmatched: [],
    total: 0,
    fileName: ''
  });

  // 项目切换
  const handleProjectChangeWrapper = async (project: string) => {
    setCurrentProject(project);
    await handleTablesProjectChange(project);
  };

  // 树节点点击
  const handleNodeClick = (node: TreeNode) => {
    if (node.type === 'table' && sqlEditorRef.current && node.database && node.table) {
      const tableName = `${node.database}.${node.table}`;
      const editor = sqlEditorRef.current.getEditor();
      if (editor) {
        const cursorPosition = editor.getCursorPosition();
        const session = editor.session;
        
        // 获取光标前后的字符
        const line = session.getLine(cursorPosition.row);
        const charBefore = cursorPosition.column > 0 ? line[cursorPosition.column - 1] : '';
        const charAfter = cursorPosition.column < line.length ? line[cursorPosition.column] : '';
        
        // 智能添加空格
        // 前面：如果有字符且不是空格/制表符，则需要加空格
        const needSpaceBefore = charBefore && charBefore !== ' ' && charBefore !== '\t';
        // 后面：如果有字符且不是空格/制表符，或者后面是空的（行尾），都需要加空格
        const needSpaceAfter = !charAfter || (charAfter && charAfter !== ' ' && charAfter !== '\t');
        
        const insertText = `${needSpaceBefore ? ' ' : ''}${tableName}${needSpaceAfter ? ' ' : ''}`;
        
        session.insert(cursorPosition, insertText);
        editor.focus();
      }
    }
  };

  // 树节点右键
  const handleNodeContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (node.type === 'table') {
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        node
      });
    }
  };

  // 关闭右键菜单
  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
  };

  // 查看字段
  const handleViewColumns = async () => {
    if (!contextMenu.node || !currentProject) return;
    
    const { database, table } = contextMenu.node;
    const fullTableName = database && table ? `${database}.${table}` : table || '';
    
    setColumnDialog({
      visible: true,
      loading: true,
      saving: false,
      tableName: fullTableName,
      columns: [],
      originalColumns: [],
      editingField: null
    });
    
    closeContextMenu();
    
    try {
      const res = await getDatabiColumnList(currentProject, fullTableName);
      
      if (res.code === 200 && res.data) {
        const columnData = res.data.map(col => ({
          ...col,
          comment: col.comment || '',
          originalComment: col.comment || ''
        }));
        
        setColumnDialog(prev => ({
          ...prev,
          columns: columnData,
          originalColumns: JSON.parse(JSON.stringify(columnData)),
          loading: false
        }));
      } else {
        toast.error(res.message || '获取字段列表失败');
        setColumnDialog(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('获取字段列表失败:', error);
      toast.error('获取字段列表失败');
      setColumnDialog(prev => ({ ...prev, loading: false }));
    }
  };

  // 字段注释修改
  const handleCommentChange = (colName: string, comment: string) => {
    setColumnDialog(prev => ({
      ...prev,
      columns: prev.columns.map(col =>
        col.col_name === colName ? { ...col, comment } : col
      )
    }));
  };

  // 插入字段名到编辑器
  const handleInsertField = (colName: string) => {
    if (sqlEditorRef.current) {
      const editor = sqlEditorRef.current.getEditor();
      if (editor) {
        const cursorPosition = editor.getCursorPosition();
        const session = editor.session;
        
        // 获取光标前后的字符
        const line = session.getLine(cursorPosition.row);
        const charBefore = cursorPosition.column > 0 ? line[cursorPosition.column - 1] : '';
        const charAfter = cursorPosition.column < line.length ? line[cursorPosition.column] : '';
        
        // 智能添加空格
        const needSpaceBefore = charBefore && charBefore !== ' ' && charBefore !== '\t';
        const needSpaceAfter = !charAfter || (charAfter && charAfter !== ' ' && charAfter !== '\t');
        
        const insertText = `${needSpaceBefore ? ' ' : ''}${colName}${needSpaceAfter ? ' ' : ''}`;
        
        session.insert(cursorPosition, insertText);
        editor.focus();
      }
    }
  };

  // 编辑字段
  const handleEditField = (colName: string) => {
    setColumnDialog(prev => ({ ...prev, editingField: colName }));
  };

  // 取消编辑字段
  const handleCancelEditField = (colName: string) => {
    const original = columnDialog.originalColumns.find(c => c.col_name === colName);
    if (original) {
      setColumnDialog(prev => ({
        ...prev,
        columns: prev.columns.map(col =>
          col.col_name === colName ? { ...col, comment: original.comment } : col
        ),
        editingField: null
      }));
    }
  };

  // 保存单个字段
  const handleSaveField = async (colName: string) => {
    const col = columnDialog.columns.find(c => c.col_name === colName);
    const original = columnDialog.originalColumns.find(c => c.col_name === colName);
    
    if (!col || !original || original.comment === col.comment) {
      setColumnDialog(prev => ({ ...prev, editingField: null }));
      return;
    }

    setColumnDialog(prev => ({ ...prev, saving: true }));
    
    try {
      const res = await updateDatabiColumnComment({
        project: currentProject,
        table: columnDialog.tableName,
        colName: [colName],
        comment: [col.comment || '']
      });

      if (res.code === 200) {
        toast.success('更新成功');
        setColumnDialog(prev => ({
          ...prev,
          originalColumns: prev.originalColumns.map(c =>
            c.col_name === colName ? { ...c, comment: col.comment, originalComment: col.comment } : c
          ),
          editingField: null,
          saving: false
        }));
      } else {
        toast.error(res.message || '更新失败');
        setColumnDialog(prev => ({ ...prev, saving: false }));
      }
    } catch (error) {
      console.error('更新字段注释错误:', error);
      toast.error('更新失败');
      setColumnDialog(prev => ({ ...prev, saving: false }));
    }
  };

  // 批量保存所有修改
  // 解析CSV内容
  const parseCsvContent = (content: string): CsvRow[] => {
    const lines = content.split('\n').filter(line => line.trim());
    const result: CsvRow[] = [];

    lines.forEach(line => {
      const commaIndex = line.indexOf(',');
      if (commaIndex === -1) return;

      const col_name = line.substring(0, commaIndex).trim();
      const comment = line.substring(commaIndex + 1).trim();

      if (col_name) {
        result.push({ col_name, comment });
      }
    });

    return result;
  };

  // 读取文件内容
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        try {
          const decoder = new TextDecoder('gbk');
          const text = decoder.decode(buffer);
          resolve(text);
        } catch {
          const decoder = new TextDecoder('utf-8');
          const text = decoder.decode(buffer);
          resolve(text);
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsArrayBuffer(file);
    });
  };

  // CSV 文件选择
  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('请选择CSV文件');
      return;
    }

    const nameWithoutExt = file.name.replace('.csv', '');
    const parts = nameWithoutExt.split('.');
    
    let dbName = '';
    let tableName = '';
    
    if (parts.length === 2) {
      dbName = parts[0];
      tableName = parts[1];
    }

    if (!tableName) {
      toast.error('文件名格式应为：库名.表名.csv');
      return;
    }

    setCsvDialog({
      visible: true,
      loading: true,
      saving: false,
      dbName,
      tableName,
      matched: [],
      unmatched: [],
      total: 0,
      fileName: file.name
    });

    try {
      const csvContent = await readFileAsText(file);
      const csvData = parseCsvContent(csvContent);

      if (csvData.length === 0) {
        toast.error('CSV文件为空或格式错误');
        setCsvDialog(prev => ({ ...prev, loading: false }));
        return;
      }

      const fullName = dbName ? `${dbName}.${tableName}` : tableName;
      const res = await getDatabiColumnList(currentProject, fullName);

      if (res.code !== 200 || !res.data) {
        toast.error('获取字段列表失败');
        setCsvDialog(prev => ({ ...prev, loading: false }));
        return;
      }

      const tableColumns = res.data;
      const tableColumnMap = new Map(tableColumns.map(col => [col.col_name, col]));

      const matched: Array<{ col_name: string; oldComment: string; newComment: string }> = [];
      const unmatched: string[] = [];

      csvData.forEach(({ col_name, comment }) => {
        if (tableColumnMap.has(col_name)) {
          matched.push({
            col_name,
            oldComment: tableColumnMap.get(col_name)?.comment || '',
            newComment: comment
          });
        } else {
          unmatched.push(col_name);
        }
      });

      setCsvDialog(prev => ({
        ...prev,
        matched,
        unmatched,
        total: csvData.length,
        loading: false
      }));
    } catch (error) {
      console.error('CSV解析错误:', error);
      toast.error('CSV解析失败');
      setCsvDialog(prev => ({ ...prev, loading: false }));
    } finally {
      if (csvInputRef.current) {
        csvInputRef.current.value = '';
      }
    }
  };

  // 确认导入CSV（异步处理，避免超时卡住）
  const handleConfirmCsvImport = () => {
    if (csvDialog.matched.length === 0) {
      toast.warning('没有可导入的字段');
      return;
    }

    // 保存导入数据（关闭对话框后state会被清空）
    const importData = {
      project: currentProject,
      dbName: csvDialog.dbName,
      tableName: csvDialog.tableName,
      matched: [...csvDialog.matched],
    };

    // 立即关闭对话框，不阻塞用户
    setCsvDialog({
      visible: false,
      loading: false,
      saving: false,
      dbName: '',
      tableName: '',
      matched: [],
      unmatched: [],
      total: 0,
      fileName: ''
    });

    // 显示导入中提示
    toast.info(`正在导入 ${importData.matched.length} 个字段的注释...`);

    // 异步执行导入（后台线程）
    const executeImport = async () => {
      try {
        const fullTableName = importData.dbName && importData.tableName 
          ? `${importData.dbName}.${importData.tableName}` 
          : importData.tableName;
        
        const colName = importData.matched.map(item => item.col_name);
        const comment = importData.matched.map(item => item.newComment);

        const res = await updateDatabiColumnComment({
          project: importData.project,
          table: fullTableName,
          colName,
          comment
        });

        if (res.code === 200) {
          toast.success(`成功导入 ${importData.matched.length} 个字段的注释`);
        } else {
          toast.error(res.message || '导入失败');
        }
      } catch (error) {
        console.error('导入错误:', error);
        toast.error('导入失败，请重试');
      }
    };

    // 启动后台任务，不等待返回
    executeImport();
  };

  // 执行查询
  const handleExecuteQuery = () => {
    executeQuery(currentProject, sqlQuery);
  };

  // 清空编辑器
  const handleClearEditor = () => {
    setSqlQuery('');
    clearResults();
  };

  // 处理拖动开始
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartPercent.current = editorHeightPercent;
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
      setEditorHeightPercent(newPercent);
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

  // 组件挂载时初始化
  useEffect(() => {
    const init = async () => {
      const defaultProject = await fetchProjects();
      if (defaultProject) {
        await handleTablesProjectChange(defaultProject);
      }
    };
    init();
    
    return () => {
      closeSseConnection();
    };
  }, []);

  // 点击其他地方关闭右键菜单
  useEffect(() => {
    if (contextMenu.visible) {
      const handleClick = () => closeContextMenu();
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu.visible]);

  // 恢复保存的状态
  useEffect(() => {
    if (!_hasHydrated || hasRestored.current) return;
    hasRestored.current = true;

    try {
      const saved = getPageState<{
        currentProject: string;
        sqlQuery: string;
        editorHeightPercent: number;
      }>(PAGE_KEY);

      if (saved) {
        if (saved.currentProject) {
          setCurrentProject(saved.currentProject);
        }
        if (saved.sqlQuery) {
          setSqlQuery(saved.sqlQuery);
        }
        if (saved.editorHeightPercent) {
          setEditorHeightPercent(saved.editorHeightPercent);
        }
      }
    } catch (error) {
      console.error('恢复 BI 查询页面状态失败:', error);
    }
  }, [_hasHydrated, getPageState]);

  // 保存状态（防抖）
  useEffect(() => {
    if (!_hasHydrated || !hasRestored.current) return;

    const timer = setTimeout(() => {
      setPageState(PAGE_KEY, {
        currentProject,
        sqlQuery,
        editorHeightPercent,
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [currentProject, sqlQuery, editorHeightPercent, setPageState, _hasHydrated]);

  return (
    <div className="sql-databi-container" onClick={closeContextMenu}>
      {/* 右键菜单 */}
      {contextMenu.visible && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-item" onClick={handleViewColumns}>
            查看字段
          </div>
        </div>
      )}

      <div className="main-content">
        {/* 左侧表树 */}
        <div className="sidebar">
          <div className="project-selector">
            <select
              value={currentProject}
              onChange={(e) => handleProjectChangeWrapper(e.target.value)}
              disabled={projectLoading}
            >
              {projectList.map(project => (
                <option key={project.value} value={project.value}>
                  {project.label}
                </option>
              ))}
            </select>
            <button
              className="btn-refresh"
              onClick={() => handleRefresh(currentProject)}
              disabled={!currentProject || refreshLoading}
              title="刷新表列表"
            >
              {refreshLoading ? '⟳' : '↻'}
            </button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              onChange={handleCsvFileChange}
              style={{ display: 'none' }}
            />
            <button
              className="btn-csv-upload"
              onClick={() => csvInputRef.current?.click()}
              disabled={!currentProject}
              title="CSV 导入注释"
            >
              <Upload size={16} />
            </button>
          </div>

          <TableTree
            treeData={treeData}
            expandedKeys={expandedKeys}
            loading={tableLoading}
            refreshLoading={refreshLoading}
            refreshProgress={refreshProgress}
            refreshMessage={refreshMessage}
            onNodeClick={handleNodeClick}
            onNodeContextMenu={handleNodeContextMenu}
            onToggleExpand={toggleExpand}
          />
        </div>

        {/* 右侧SQL工作区 */}
        <div ref={containerRef} className="content">
          {/* 工具栏 */}
          <div className="workspace-toolbar">
            <div className="toolbar-left">
              <button
                className="btn btn-primary"
                onClick={handleExecuteQuery}
                disabled={queryLoading || !currentProject}
              >
                {queryLoading ? '执行中...' : '▶ 执行'}
              </button>
              <button className="btn" onClick={handleClearEditor} disabled={!sqlQuery}>
                清空
              </button>
            </div>
          </div>

          {/* 编辑器容器 */}
          <div
            className="editor-container"
            style={{ height: `${editorHeightPercent}%`, flexShrink: 0 }}
          >
            <SqlEditor
              ref={sqlEditorRef}
              value={sqlQuery}
              onChange={setSqlQuery}
              onExecute={handleExecuteQuery}
              loading={queryLoading}
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
              loading={queryLoading}
              resultData={resultData}
              resultColumns={resultColumns}
              took={took}
              onCopyColumn={handleCopyColumn}
              onCopyRow={handleCopyRow}
            />
          </div>
        </div>
      </div>

      {/* 字段详情弹框 */}
      <ColumnDetailDialog
        state={columnDialog}
        onClose={() => setColumnDialog(prev => ({ ...prev, visible: false }))}
        onInsertField={handleInsertField}
        onEditField={handleEditField}
        onCancelEdit={handleCancelEditField}
        onSaveField={handleSaveField}
        onCommentChange={handleCommentChange}
      />

      {/* CSV 导入弹框 */}
      <CsvImportDialog
        state={csvDialog}
        onClose={() => setCsvDialog(prev => ({ ...prev, visible: false }))}
        onConfirm={handleConfirmCsvImport}
      />
    </div>
  );
};

export default SqlDatabi;
