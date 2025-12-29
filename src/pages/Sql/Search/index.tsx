/**
 * SQL查询页面
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getProjectList, getDatabases, getTables, executeQuery, 
  executePageQuery, exportQueryResult, getHistoryList, 
  type Project, type HistoryItem 
} from '../../../services/sql/search';
import { openComponentWindow, onReattachTab } from '../../../utils/window';
import { usePageStateStore, useMessageStore } from '../../../stores';
import TableTree from './components/TableTree';
import SqlWorkspace from './components/SqlWorkspace';
import DraggableTabs from './components/DraggableTabs';
import { handleQueryData } from './utils/handleQueryData';
import './styles/index.css';

// 结果集类型
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

// 消息类型
export interface Message {
  type: 'error' | 'warning' | 'info';
  content: string;
}

export interface Tab {
  id: string;
  name: string;
  project: string;
  dbName: string;
  sqlQuery: string;
  dbList: string[];
  tableList: string[];
  queryLoading: boolean;
  treeLoading: boolean;
  exportLoading: boolean;
  // 查询结果
  results: unknown[][];
  columns: string[];
  total: number;
  took: number;
  queryId: string;
  currentPage: number;
  pageSize: number;
  // 多结果集支持
  allResults: ResultSet[];
  currentResultIndex: number;
  lastExecutedSql: string;
  messages: Message[];
}

const createTab = (id: string): Tab => ({
  id, name: `查询 ${id}`, project: '', dbName: '', sqlQuery: '',
  dbList: [], tableList: [], queryLoading: false, treeLoading: false, exportLoading: false,
  results: [], columns: [], total: 0, took: 0, queryId: '', currentPage: 1, pageSize: 50,
  allResults: [], currentResultIndex: 0, lastExecutedSql: '', messages: []
});

// 页面状态 key
const PAGE_KEY = 'sql/search';
const DETACHED_KEY = 'sql/detached-tabs';

// 需要保存的 Tab 字段（包含查询结果）
const serializeTab = (tab: Tab): Partial<Tab> => ({
  id: tab.id,
  name: tab.name,
  project: tab.project,
  dbName: tab.dbName,
  sqlQuery: tab.sqlQuery,
  dbList: tab.dbList,
  tableList: tab.tableList,
  // 查询结果
  results: tab.results,
  columns: tab.columns,
  total: tab.total,
  took: tab.took,
  queryId: tab.queryId,
  currentPage: tab.currentPage,
  pageSize: tab.pageSize,
  allResults: tab.allResults,
  currentResultIndex: tab.currentResultIndex,
  lastExecutedSql: tab.lastExecutedSql,
});

const SqlSearch = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([createTab('1')]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [tabCounter, setTabCounter] = useState(1);
  
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);

  // 页面状态管理
  const { setPageState, getPageState, _hasHydrated } = usePageStateStore();
  const addMessage = useMessageStore(state => state.addMessage);
  const hasRestored = useRef(false);
  const [isRestoring, setIsRestoring] = useState(true);

  const currentTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const updateTab = useCallback((tabId: string, updates: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...updates } : t));
  }, []);

  // 恢复保存的状态（等待 hydration 完成）
  useEffect(() => {
    if (!_hasHydrated || hasRestored.current) return;
    hasRestored.current = true;

    try {
      const saved = getPageState<{ tabs: Partial<Tab>[]; activeTabId: string; tabCounter: number }>(PAGE_KEY);
      const detached = getPageState<{ tabs: Partial<Tab>[] }>(DETACHED_KEY);

      console.log('恢复 SQL 页面状态:', saved, '独立窗口:', detached);

      let restoredTabs: Tab[] = [];
      
      // 恢复主窗口标签页
      if (saved?.tabs?.length) {
        restoredTabs = saved.tabs.map(t => ({ ...createTab(t.id || '1'), ...t }));
      }
      
      // 恢复独立窗口的标签页
      if (detached?.tabs?.length) {
        const detachedTabs = detached.tabs.map(t => ({
          ...createTab(t.id || 'detached'),
          ...t,
          results: [], columns: [], total: 0, took: 0, queryId: '',
          allResults: [], currentResultIndex: 0, messages: [],
        }));
        restoredTabs = [...restoredTabs, ...detachedTabs];
        setPageState(DETACHED_KEY, { tabs: [] });
        console.log('[SQL] 恢复独立窗口标签页:', detachedTabs.length);
      }

      if (restoredTabs.length > 0) {
        setTabs(restoredTabs);
        setActiveTabId(saved?.activeTabId || restoredTabs[0].id);
        setTabCounter(saved?.tabCounter || restoredTabs.length);
      }
    } catch (error) {
      console.error('恢复 SQL 页面状态失败:', error);
    } finally {
      setIsRestoring(false);
    }
  }, [_hasHydrated, getPageState, setPageState]);

  // 保存状态（防抖，仅在 hydration 完成后）
  useEffect(() => {
    if (!_hasHydrated || !hasRestored.current) return;

    const timer = setTimeout(() => {
      const stateToSave = {
        tabs: tabs.map(serializeTab),
        activeTabId,
        tabCounter,
      };
      setPageState(PAGE_KEY, stateToSave);
    }, 500);

    return () => clearTimeout(timer);
  }, [tabs, activeTabId, tabCounter, setPageState, _hasHydrated]);

  // 监听放回事件
  useEffect(() => {
    const unlisten = onReattachTab((data) => {
      if (data.type !== 'sql') return;
      
      const tabData = data.tabData as Partial<Tab>;
      const newTab: Tab = {
        ...createTab(tabData.id || `tab-${Date.now()}`),
        ...tabData,
        queryLoading: false,
        treeLoading: false,
        exportLoading: false,
        results: [],
        columns: [],
        total: 0,
        took: 0,
        queryId: '',
        allResults: [],
        currentResultIndex: 0,
        messages: [],
      };
      
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newTab.id);
      console.log('[SQL] 放回标签页:', newTab.name);
    });

    return () => { unlisten.then(fn => fn()); };
  }, []);

  // 获取项目列表
  useEffect(() => {
    if (isRestoring || !_hasHydrated) return;
    
    const fetchProjects = async () => {
      setProjectLoading(true);
      try {
        const res = await getProjectList();
        if (res.code === 200 && res.data) {
          let items: Project[] = [];
          if (Array.isArray(res.data)) {
            items = res.data;
          } else if (res.data.items) {
            items = res.data.items;
          } else if (res.data.list) {
            items = res.data.list;
          }
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
  }, [isRestoring, _hasHydrated]);

  // 显示恢复中提示
  if (isRestoring || !_hasHydrated) {
    return (
      <div className="sql-search-loading">
        <div className="loading-spinner" />
        <p>正在恢复工作区...</p>
      </div>
    );
  }

  const addTab = () => {
    const newId = String(tabCounter + 1);
    setTabCounter(tabCounter + 1);
    setTabs(prev => [...prev, createTab(newId)]);
    setActiveTabId(newId);
  };

  const removeTab = (id: string) => {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex(t => t.id === id);
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) setActiveTabId(newTabs[Math.max(0, idx - 1)].id);
  };

  // 项目变更
  const handleProjectChange = async (project: string, tabId: string) => {
    updateTab(tabId, { project, dbName: '', dbList: [], tableList: [] });
    if (project) {
      try {
        const res = await getDatabases({ agent: project });
        if (res.code === 200) {
          updateTab(tabId, { dbList: res.data?.databases || [] });
        }
      } catch (error) {
        console.error('获取数据库列表失败:', error);
      }
    }
  };

  // 数据库变更
  const handleDbChange = async (dbName: string, tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    updateTab(tabId, { dbName, tableList: [], treeLoading: true });
    if (dbName && tab.project) {
      try {
        const res = await getTables({ agent: tab.project, dbName });
        if (res.code === 200) {
          updateTab(tabId, { tableList: res.data?.tables || [] });
        }
      } catch (error) {
        console.error('获取表列表失败:', error);
      } finally {
        updateTab(tabId, { treeLoading: false });
      }
    }
  };

  // 执行查询
  const handleExecute = async (sql: string, _isSelection: boolean = false) => {
    if (!currentTab.project || !currentTab.dbName || !sql.trim()) {
      updateTab(activeTabId, { 
        messages: [{ type: 'warning', content: '请选择项目、数据库并输入SQL' }] 
      });
      return;
    }

    updateTab(activeTabId, { 
      queryLoading: true, 
      results: [], 
      columns: [], 
      total: 0, 
      took: 0,
      allResults: [],
      currentResultIndex: 0,
      messages: [],
      lastExecutedSql: sql
    });
    
    try {
      const res = await executeQuery({
        agent: currentTab.project,
        dbName: currentTab.dbName,
        query: sql
      });
      
      if (res.code === 200 && res.data) {
        // 使用 handleQueryData 处理查询结果
        const processed = handleQueryData(res.data, currentTab.dbName, sql);
        
        updateTab(activeTabId, {
          results: processed.queryResults,
          columns: processed.resultColumns,
          total: processed.total,
          took: processed.took,
          queryId: processed.queryId,
          allResults: processed.allResults,
          currentResultIndex: 0,
          currentPage: 1,
          messages: []
        });
      } else {
        updateTab(activeTabId, {
          messages: [{ type: 'error', content: res.message || '查询失败' }]
        });
      }
    } catch (error) {
      console.error('执行查询失败:', error);
      updateTab(activeTabId, {
        messages: [{ type: 'error', content: '执行查询失败，请稍后重试' }]
      });
    } finally {
      updateTab(activeTabId, { queryLoading: false });
    }
  };

  // 后端分页 API 调用
  const handlePageChange = async (page: number, size: number) => {
    const tab = currentTab;
    if (!tab.queryId || !tab.project || !tab.dbName) {
      // 没有 queryId 时无法进行后端分页
      console.warn('缺少 queryId，无法进行后端分页');
      return;
    }

    updateTab(activeTabId, { queryLoading: true });
    
    try {
      const res = await executePageQuery({
        query_id: tab.queryId,
        page,
        size,
        result_index: tab.currentResultIndex
      });
      
      if (res.code === 200 && res.data) {
        // 处理返回数据 - 兼容嵌套和非嵌套结构
        let rows: unknown[][] = [];
        let columns: string[] = tab.columns;
        let newTotal = tab.total;
        
        const data = res.data as any;
        if (data.results && data.results.length > 0) {
          // 嵌套结构
          const result = data.results[0];
          rows = result.rows || [];
          if (result.columns) columns = result.columns;
          if (result.total !== undefined) newTotal = result.total;
        } else if (data.rows) {
          // 非嵌套结构
          rows = data.rows;
          if (data.columns) columns = data.columns;
          if (data.total !== undefined) newTotal = data.total;
        }
        
        // 更新当前结果集的数据
        const newAllResults = [...tab.allResults];
        if (newAllResults[tab.currentResultIndex]) {
          newAllResults[tab.currentResultIndex] = {
            ...newAllResults[tab.currentResultIndex],
            data: rows,
            total: newTotal
          };
        }
        
        updateTab(activeTabId, {
          results: rows,
          columns,
          total: newTotal,
          currentPage: page,
          pageSize: size,
          allResults: newAllResults
        });
      }
    } catch (error) {
      console.error('分页查询失败:', error);
      updateTab(activeTabId, {
        messages: [{ type: 'error', content: '分页查询失败' }]
      });
    } finally {
      updateTab(activeTabId, { queryLoading: false });
    }
  };

  // 结果集切换
  const handleResultChange = (index: number) => {
    const tab = currentTab;
    if (index < 0 || index >= tab.allResults.length) return;
    
    const selectedResult = tab.allResults[index];
    updateTab(activeTabId, {
      currentResultIndex: index,
      results: selectedResult.data,
      columns: selectedResult.columns,
      total: selectedResult.total,
      took: selectedResult.took,
      queryId: selectedResult.queryId,
      currentPage: 1  // 切换结果集时重置页码
    });
  };

  // 后端导出（异步导出，后端发送邮件）
  const handleExport = async () => {
    const tab = currentTab;
    if (!tab.queryId) {
      updateTab(activeTabId, {
        messages: [{ type: 'warning', content: '无法导出：缺少查询ID' }]
      });
      return;
    }

    updateTab(activeTabId, { exportLoading: true });
    
    try {
      const res = await exportQueryResult({
        query_id: tab.queryId,
        db_name: tab.dbName
      });
      
      if (res.code === 200) {
        // 导出请求成功，后端会异步处理并发送邮件
        addMessage({
          type: 'success',
          title: 'SQL导出请求已提交',
          content: res.message || '导出任务已提交，请稍后查收邮件',
        });
      } else {
        updateTab(activeTabId, {
          messages: [{ type: 'error', content: res.message || '导出失败' }]
        });
      }
    } catch (error) {
      console.error('导出失败:', error);
      updateTab(activeTabId, {
        messages: [{ type: 'error', content: '导出失败，请稍后重试' }]
      });
      
      addMessage({
        type: 'error',
        title: 'SQL导出失败',
        content: '导出失败，请稍后重试',
      });
    } finally {
      updateTab(activeTabId, { exportLoading: false });
    }
  };

  // 处理 TableDetail - 直接打开独立窗口
  const handleTableDetail = (tableName: string, command: string) => {
    const tabMap: Record<string, 'fields' | 'preview' | 'indexes' | 'ddl'> = {
      'fields': 'fields',
      'preview': 'preview',
      'indexes': 'indexes',
      'ddl': 'ddl'
    };
    openComponentWindow({
      type: 'table-detail',
      label: `table-detail-${currentTab.dbName}-${tableName}`,
      title: `表详情 - ${tableName}`,
      props: {
        agent: currentTab.project,
        dbName: currentTab.dbName,
        tableName,
        initialTab: tabMap[command] || 'fields'
      },
      width: 900,
      height: 700
    });
  };

  // 插入SQL
  const handleInsertSql = (sql: string) => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) {
      updateTab(activeTabId, { sqlQuery: tab.sqlQuery + (tab.sqlQuery ? '\n' : '') + sql });
    }
  };

  // 显示历史记录
  const showHistory = async () => {
    try {
      const res = await getHistoryList();
      if (res.code === 200) {
        setHistoryList(res.data || []);
        setHistoryVisible(true);
      }
    } catch (error) {
      console.error('获取历史记录失败:', error);
    }
  };

  const applyHistory = (item: HistoryItem) => {
    updateTab(activeTabId, { sqlQuery: item.query_sql });
    setHistoryVisible(false);
  };

  // 标签页重新排序
  const handleTabsReorder = (newTabs: { id: string; name: string }[]) => {
    setTabs(prev => {
      const tabMap = new Map(prev.map(t => [t.id, t]));
      return newTabs.map(t => tabMap.get(t.id)!).filter(Boolean);
    });
  };

  // 标签页分离为独立窗口
  const handleTabDetach = (tab: { id: string; name: string }) => {
    const fullTab = tabs.find(t => t.id === tab.id);
    if (!fullTab) return;
    
    // 打开独立窗口
    openComponentWindow({
      type: 'sql-workspace',
      label: `sql-workspace-${tab.id}-${Date.now()}`,
      title: `${tab.name} - SQL查询`,
      props: {
        initialTab: fullTab
      },
      width: 1200,
      height: 800
    });
    
    // 如果只有一个标签页，先创建新标签再移除
    if (tabs.length <= 1) {
      const newId = String(tabCounter + 1);
      setTabCounter(tabCounter + 1);
      const newTab = createTab(newId);
      setTabs([newTab]);
      setActiveTabId(newId);
    } else {
      // 从当前标签列表中移除，并切换到其他标签
      const remainingTabs = tabs.filter(t => t.id !== tab.id);
      setTabs(remainingTabs);
      // 如果移除的是当前激活的标签，切换到第一个
      if (activeTabId === tab.id && remainingTabs.length > 0) {
        setActiveTabId(remainingTabs[0].id);
      }
    }
  };

  return (
    <div className="sql-search">
      <DraggableTabs
        tabs={tabs.map(t => ({ id: t.id, name: t.name }))}
        activeTabId={activeTabId}
        onTabClick={setActiveTabId}
        onTabClose={removeTab}
        onTabsReorder={handleTabsReorder}
        onTabDetach={handleTabDetach}
        onAddTab={addTab}
        onShowHistory={showHistory}
      />

      <div className="main-content">
        <div className="sidebar">
          <TableTree
            projects={projects}
            projectLoading={projectLoading}
            currentProject={currentTab.project}
            currentDb={currentTab.dbName}
            dbList={currentTab.dbList}
            tableList={currentTab.tableList}
            treeLoading={currentTab.treeLoading}
            onProjectChange={(p) => handleProjectChange(p, activeTabId)}
            onDbChange={(db) => handleDbChange(db, activeTabId)}
            onInsertSql={handleInsertSql}
            onTableDetail={handleTableDetail}
          />
        </div>
        <div className="content">
          <SqlWorkspace
            sql={currentTab.sqlQuery}
            onSqlChange={(sql: string) => updateTab(activeTabId, { sqlQuery: sql })}
            onExecute={handleExecute}
            loading={currentTab.queryLoading}
            exportLoading={currentTab.exportLoading}
            results={currentTab.results}
            columns={currentTab.columns}
            total={currentTab.total}
            took={currentTab.took}
            dbName={currentTab.dbName}
            queryId={currentTab.queryId}
            allResults={currentTab.allResults}
            currentResultIndex={currentTab.currentResultIndex}
            onResultChange={handleResultChange}
            currentPage={currentTab.currentPage}
            onPageChange={handlePageChange}
            onExport={handleExport}
            messages={currentTab.messages}
            tableList={currentTab.tableList}
            project={currentTab.project}
          />
        </div>
      </div>

      {historyVisible && (
        <div className="drawer-overlay" onClick={() => setHistoryVisible(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h4>历史SQL记录</h4>
              <button className="close-btn" onClick={() => setHistoryVisible(false)}>×</button>
            </div>
            <div className="drawer-body">
              {historyList.length === 0 ? <div className="empty-tip">暂无历史记录</div> : (
                <table className="history-table">
                  <thead><tr><th>执行时间</th><th>SQL语句</th><th>操作</th></tr></thead>
                  <tbody>
                    {historyList.map(item => (
                      <tr key={item.id}>
                        <td>{item.created_at}</td>
                        <td className="sql-cell">{item.query_sql}</td>
                        <td><button className="btn btn-link" onClick={() => applyHistory(item)}>复制</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SqlSearch;
