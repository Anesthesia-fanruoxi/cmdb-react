/**
 * 独立窗口 SQL 工作区
 * 用于从主窗口分离出来的标签页（仅编辑器 + 结果面板）
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { 
  executeQuery, 
  executePageQuery, exportQueryResult
} from '../../../../services/sql/search';
import { usePageStateStore } from '../../../../stores/pageStateStore';
import { emitReattachTab, closeCurrentWindow } from '../../../../utils/window';
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
        <div className="content">
          <SqlWorkspace tabId={detachKey} sql={tab.sqlQuery} onSqlChange={(sql: string) => updateTab({ sqlQuery: sql })}
            onExecute={handleExecute} loading={tab.queryLoading} exportLoading={tab.exportLoading}
            results={tab.results} columns={tab.columns} total={tab.total} took={tab.took}
            dbName={tab.dbName} queryId={tab.queryId} allResults={tab.allResults}
            currentResultIndex={tab.currentResultIndex} onResultChange={handleResultChange}
            currentPage={tab.currentPage} onPageChange={handlePageChange} onExport={handleExport}
            messages={tab.messages} tableList={tab.tableList} project={tab.project} lastExecutedSql={tab.lastExecutedSql} />
        </div>
      </div>
    </div>
  );
};

export default SqlWorkspaceDetached;
