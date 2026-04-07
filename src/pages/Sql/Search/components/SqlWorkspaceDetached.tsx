/**
 * 独立窗口 SQL 工作区
 * 用于从主窗口分离出来的标签页
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { 
  getProjectList, getDatabases, getTables, executeQuery, 
  executePageQuery, exportQueryResult,
  type Project
} from '../../../../services/sql/search';
import { usePageStateStore } from '../../../../stores/pageStateStore';
import { openComponentWindow, emitReattachTab, closeCurrentWindow } from '../../../../utils/window';
import TableTree from './TableTree';
import SqlWorkspace from './SqlWorkspace';
import { handleQueryData } from '../utils/handleQueryData';
import type { Tab } from '../index';
import '../styles/index.css';

interface Props {
  detachKey?: string;
  project?: string;
  dbName?: string;
  initialTab?: Tab;
}

const DETACHED_KEY = 'sql/detached-tabs';

// 创建默认 Tab
const createDefaultTab = (id: string): Tab => ({
  id, name: `查询 ${id}`, project: '', dbName: '', sqlQuery: '',
  dbList: [], tableList: [], queryLoading: false, treeLoading: false, exportLoading: false,
  results: [], columns: [], total: 0, took: 0, queryId: '', currentPage: 1, pageSize: 50,
  allResults: [], currentResultIndex: 0, lastExecutedSql: '', messages: [],
  metadataRefreshing: false, metadataCacheAge: null
});

const SqlWorkspaceDetached = ({ detachKey, project, dbName, initialTab }: Props) => {
  // 从 localStorage 读取完整数据
  const getInitialTab = (): Partial<Tab> => {
    if (detachKey) {
      try {
        const saved = localStorage.getItem(detachKey);
        if (saved) {
          localStorage.removeItem(detachKey); // 读取后删除
          return JSON.parse(saved);
        }
      } catch (e) {
        console.error('读取分离数据失败:', e);
      }
    }
    if (initialTab) return initialTab;
    return { project: project || '', dbName: dbName || '' };
  };
  
  const initData = getInitialTab();
  const tabId = useRef(initData.id || `detached-${Date.now()}`);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  // 合并默认值和传入的初始数据
  const [tab, setTab] = useState<Tab>(() => ({
    ...createDefaultTab(tabId.current),
    ...initData,
    id: tabId.current,
  }));
  const { setPageState, getPageState } = usePageStateStore();

  const updateTab = useCallback((updates: Partial<Tab>) => {
    setTab(prev => ({ ...prev, ...updates }));
  }, []);

  // 保存独立窗口状态
  const saveDetachedState = useCallback(() => {
    if (!tab.project) return; // 没选项目不保存
    
    const existing = getPageState<{ tabs: Partial<Tab>[] }>(DETACHED_KEY) || { tabs: [] };
    const stateToSave = {
      id: tab.id, name: tab.name, project: tab.project, dbName: tab.dbName,
      sqlQuery: tab.sqlQuery, dbList: tab.dbList, tableList: tab.tableList,
    };
    
    const idx = existing.tabs.findIndex(t => t.id === tab.id);
    if (idx >= 0) existing.tabs[idx] = stateToSave;
    else existing.tabs.push(stateToSave);
    
    setPageState(DETACHED_KEY, existing);
  }, [tab, setPageState, getPageState]);

  // 定时保存 + 窗口关闭前保存
  useEffect(() => {
    const timer = setInterval(saveDetachedState, 10000);
    
    const currentWindow = getCurrentWebviewWindow();
    const unlisten = currentWindow.onCloseRequested(() => {
      saveDetachedState();
    });

    return () => {
      clearInterval(timer);
      unlisten.then(fn => fn());
    };
  }, [saveDetachedState]);

  // 获取项目列表
  useEffect(() => {
    const fetchProjects = async () => {
      setProjectLoading(true);
      try {
        const res = await getProjectList();
        if (res.code === 200 && res.data) {
          let items: Project[] = [];
          if (Array.isArray(res.data)) items = res.data;
          else if (res.data.items) items = res.data.items;
          else if (res.data.list) items = res.data.list;
          
          const projectList = items.map(item => ({
            label: item.project_name || item.label || item.value || '',
            value: item.project || item.key || item.value || ''
          }));
          setProjects(projectList);
        }
      } catch (error) {
        console.error('获取项目列表失败:', error);
      } finally {
        setProjectLoading(false);
      }
    };
    fetchProjects();
  }, []);

  // 项目变更
  const handleProjectChange = async (project: string) => {
    updateTab({ project, dbName: '', dbList: [], tableList: [] });
    if (!project) return;
    try {
      const res = await getDatabases({ agent: project });
      if (res.code === 200) updateTab({ dbList: res.data?.databases || [] });
    } catch (e) { console.error('获取数据库列表失败:', e); }
  };

  // 数据库变更
  const handleDbChange = async (dbName: string) => {
    updateTab({ dbName, tableList: [], treeLoading: true });
    if (!dbName || !tab.project) return;
    try {
      const res = await getTables({ agent: tab.project, dbName });
      if (res.code === 200) updateTab({ tableList: res.data?.tables || [] });
    } catch (e) { console.error('获取表列表失败:', e); }
    finally { updateTab({ treeLoading: false }); }
  };

  // 执行查询
  const handleExecute = async (sql: string) => {
    if (!tab.project || !tab.dbName || !sql.trim()) {
      updateTab({ messages: [{ type: 'warning', content: '请选择项目、数据库并输入SQL' }] });
      return;
    }
    updateTab({ queryLoading: true, results: [], columns: [], total: 0, took: 0, allResults: [], currentResultIndex: 0, messages: [], lastExecutedSql: sql });
    try {
      const res = await executeQuery({ agent: tab.project, dbName: tab.dbName, query: sql });
      if (res.code === 200 && res.data) {
        const p = handleQueryData(res.data, tab.dbName, sql);
        updateTab({ results: p.queryResults, columns: p.resultColumns, total: p.total, took: p.took, queryId: p.queryId, allResults: p.allResults, currentResultIndex: 0, currentPage: 1, messages: [] });
      } else {
        updateTab({ messages: [{ type: 'error', content: res.message || '查询失败' }] });
      }
    } catch (e) { console.error('执行查询失败:', e); updateTab({ messages: [{ type: 'error', content: '执行查询失败' }] }); }
    finally { updateTab({ queryLoading: false }); }
  };

  // 分页
  const handlePageChange = async (page: number, size: number) => {
    if (!tab.queryId) return;
    updateTab({ queryLoading: true });
    try {
      const res = await executePageQuery({ query_id: tab.queryId, page, size, result_index: tab.currentResultIndex });
      if (res.code === 200 && res.data) {
        const data = res.data as any;
        let rows = data.results?.[0]?.rows || data.rows || [];
        let cols = data.results?.[0]?.columns || data.columns || tab.columns;
        let total = data.results?.[0]?.total ?? data.total ?? tab.total;
        const newAll = [...tab.allResults];
        if (newAll[tab.currentResultIndex]) newAll[tab.currentResultIndex] = { ...newAll[tab.currentResultIndex], data: rows, total };
        updateTab({ results: rows, columns: cols, total, currentPage: page, allResults: newAll });
      }
    } catch (e) { console.error('分页失败:', e); }
    finally { updateTab({ queryLoading: false }); }
  };

  // 结果集切换
  const handleResultChange = (index: number) => {
    if (index < 0 || index >= tab.allResults.length) return;
    const r = tab.allResults[index];
    updateTab({ currentResultIndex: index, results: r.data, columns: r.columns, total: r.total, took: r.took, queryId: r.queryId, currentPage: 1 });
  };

  // 导出
  const handleExport = async () => {
    if (!tab.queryId) { updateTab({ messages: [{ type: 'warning', content: '无法导出：缺少查询ID' }] }); return; }
    updateTab({ exportLoading: true });
    try {
      const res = await exportQueryResult({ query_id: tab.queryId, db_name: tab.dbName });
      if (res instanceof Blob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(res);
        a.download = `query_result_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
      }
    } catch (e) { console.error('导出失败:', e); }
    finally { updateTab({ exportLoading: false }); }
  };

  const handleTableDetail = (tableName: string, cmd: string) => {
    openComponentWindow({
      type: 'table-detail', label: `table-detail-${tab.dbName}-${tableName}`,
      title: `表详情 - ${tableName}`,
      props: { agent: tab.project, dbName: tab.dbName, tableName, initialTab: cmd || 'fields' },
      width: 900, height: 700
    });
  };

  // 放回主窗口
  const handleReattach = async () => {
    const tabData = {
      id: tab.id, name: tab.name, project: tab.project, dbName: tab.dbName,
      sqlQuery: tab.sqlQuery, dbList: tab.dbList, tableList: tab.tableList,
    };
    await emitReattachTab({ type: 'sql', tabData });
    closeCurrentWindow();
  };

  return (
    <div className="sql-search detached-workspace">
      <div className="detached-header">
        <span className="detached-title">{tab.name}</span>
        <button className="reattach-btn" onClick={handleReattach} title="放回主窗口">
          ↩ 放回
        </button>
      </div>
      <div className="main-content">
        <div className="sidebar">
          <TableTree projects={projects} projectLoading={projectLoading} currentProject={tab.project}
            currentDb={tab.dbName} dbList={tab.dbList} tableList={tab.tableList} treeLoading={tab.treeLoading}
            onProjectChange={handleProjectChange} onDbChange={handleDbChange}
            onInsertSql={(sql) => updateTab({ sqlQuery: tab.sqlQuery + (tab.sqlQuery ? '\n' : '') + sql })}
            onTableDetail={handleTableDetail} />
        </div>
        <div className="content">
          <SqlWorkspace tabId={detachKey} sql={tab.sqlQuery} onSqlChange={(sql: string) => updateTab({ sqlQuery: sql })}
            onExecute={handleExecute} loading={tab.queryLoading} exportLoading={tab.exportLoading}
            results={tab.results} columns={tab.columns} total={tab.total} took={tab.took}
            dbName={tab.dbName} queryId={tab.queryId} allResults={tab.allResults}
            currentResultIndex={tab.currentResultIndex} onResultChange={handleResultChange}
            currentPage={tab.currentPage} onPageChange={handlePageChange} onExport={handleExport}
            messages={tab.messages} tableList={tab.tableList} project={tab.project} />
        </div>
      </div>
    </div>
  );
};

export default SqlWorkspaceDetached;
