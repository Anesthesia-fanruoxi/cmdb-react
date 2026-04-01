/**
 * SQL查询页面
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getProjectList, getDatabases, executeQuery, 
  executePageQuery, exportQueryResult,
  type Project
} from '../../../services/sql/search';
import { openComponentWindow, onReattachTab } from '../../../utils/window';
import { usePageStateStore, useMessageStore, useUserPrefsStore, useAuthStore } from '../../../stores';
import { toast } from '../../../components/Toast';
import { appNotification } from '../../../components/AppNotification';
import TableTree from './components/TableTree';
import SqlWorkspace from './components/SqlWorkspace';
import DraggableTabs from './components/DraggableTabs';
import ShortcutSettings from './components/ShortcutSettings';
import SqlHistoryPanel from './components/SqlHistoryPanel';
import SaveSqlSharedDialog from './components/SaveSqlSharedDialog';
import TableDetailContent from './components/TableDetailContent';
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
  metadataRefreshing: boolean;
  metadataCacheAge: number | null;
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
  metadataRefreshing: false, metadataCacheAge: null,
  results: [], columns: [], total: 0, took: 0, queryId: '', currentPage: 1, pageSize: 50,
  allResults: [], currentResultIndex: 0, lastExecutedSql: '', messages: []
});

// 页面状态 key
const PAGE_KEY = 'sql/search';
const DETACHED_KEY = 'sql/detached-tabs';

// 需要保存的 Tab 字段（不包含查询结果，避免大数据问题）
const serializeTab = (tab: Tab): Partial<Tab> => ({
  id: tab.id,
  name: tab.name,
  project: tab.project,
  dbName: tab.dbName,
  sqlQuery: tab.sqlQuery,
  dbList: tab.dbList,
  tableList: tab.tableList,
  currentPage: tab.currentPage,
  pageSize: tab.pageSize,
  lastExecutedSql: tab.lastExecutedSql,
});

const SqlSearch = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([createTab('1')]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [tabCounter, setTabCounter] = useState(1);
  
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [sqlHistoryPanelVisible, setSqlHistoryPanelVisible] = useState(false);
  const [saveSharedVisible, setSaveSharedVisible] = useState(false);
  
  // 表详情抽屉状态
  const [tableDetailDrawerVisible, setTableDetailDrawerVisible] = useState(false);
  const [drawerTableName, setDrawerTableName] = useState('');
  const [drawerActiveTab, setDrawerActiveTab] = useState<'fields' | 'preview' | 'indexes' | 'ddl'>('fields');

  // 页面状态管理
  const { setPageState, getPageState, _hasHydrated } = usePageStateStore();
  const addMessage = useMessageStore(state => state.addMessage);
  const { sqlShortcuts } = useUserPrefsStore();
  const userName = useAuthStore(state => state.userName);
  const hasRestored = useRef(false);
  const [isRestoring, setIsRestoring] = useState(true);

  // 保存最新的 tabs 引用，用于在异步操作中获取最新状态
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const currentTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const updateTab = useCallback((tabId: string, updates: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...updates } : t));
  }, []);

  // ESC 关闭弹框
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (sqlHistoryPanelVisible) setSqlHistoryPanelVisible(false);
        else if (saveSharedVisible) setSaveSharedVisible(false);
        else if (settingsVisible) setSettingsVisible(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [sqlHistoryPanelVisible, saveSharedVisible, settingsVisible]);

  // 快捷键：历史记录和保存共享
  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      const matchShortcut = (shortcut: string) => {
        const parts = shortcut.split('-');
        const ctrl = parts.includes('Ctrl');
        const shift = parts.includes('Shift');
        const alt = parts.includes('Alt');
        const key = parts[parts.length - 1].toLowerCase();
        const pressedKey = e.key.toLowerCase() === 'enter' ? 'enter' : e.key.toLowerCase();
        return (e.ctrlKey || e.metaKey) === ctrl && e.shiftKey === shift && e.altKey === alt && pressedKey === key;
      };

      // 历史记录快捷键
      if (matchShortcut(sqlShortcuts.history)) {
        e.preventDefault();
        setSqlHistoryPanelVisible(true);
        return;
      }

      // 保存共享快捷键
      if (matchShortcut(sqlShortcuts.saveShared)) {
        e.preventDefault();
        const tab = tabsRef.current.find(t => t.id === activeTabId);
        if (tab?.sqlQuery?.trim() && tab.project && tab.dbName) {
          setSaveSharedVisible(true);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [sqlShortcuts, activeTabId]);

  // 恢复保存的状态（等待 hydration 完成）
  useEffect(() => {
    if (!_hasHydrated || hasRestored.current) return;
    hasRestored.current = true;

    try {
      const saved = getPageState<{ tabs: Partial<Tab>[]; activeTabId: string; tabCounter: number }>(PAGE_KEY);
      const detached = getPageState<{ tabs: Partial<Tab>[] }>(DETACHED_KEY);

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
    console.log(`[项目切换] 标签页 ${tabId}: 项目=${project}`);
    
    updateTab(tabId, { project, dbName: '', dbList: [], tableList: [], metadataCacheAge: null });
    if (project) {
      try {
        // 先尝试从文件存储恢复缓存
        const { restoreMetadataFromStorage, getMetadataCacheAge } = await import('../../../utils/sql/cache');
        const restored = await restoreMetadataFromStorage(project, userName || '');
        
        if (restored) {
          // 缓存恢复成功,直接使用缓存数据
          const { getAllCachedDatabases } = await import('../../../utils/sql/cache');
          const cachedDbList = getAllCachedDatabases();
          const cacheAge = await getMetadataCacheAge(project, userName || '');
          
          console.log(`[项目切换] ✅ 使用缓存数据: ${cachedDbList.length} 个数据库`);
          updateTab(tabId, { dbList: cachedDbList, metadataCacheAge: cacheAge });
        } else {
          // 缓存不存在或已过期,调用 API 获取
          console.log(`[项目切换] 📡 缓存不可用,调用 API 获取元数据`);
          await fetchAndCacheMetadata(project, tabId);
        }
      } catch (error) {
        console.error('[项目切换] 获取元数据失败:', error);
        toast.error('获取数据库列表失败');
      }
    }
  };

  // 获取并缓存元数据(提取为独立方法,供刷新功能复用)
  const fetchAndCacheMetadata = async (project: string, tabId: string) => {
    const res = await getDatabases({ agent: project });
    if (res.code !== 200) {
      throw new Error(res.message || '获取数据库列表失败');
    }
    
    const dbList = res.data?.databases || [];
    console.log(`[元数据获取] 获取到 ${dbList.length} 个数据库:`, dbList);
    
    // 缓存数据库列表,用于跨库智能提示
    const { cacheDatabases, cacheDbTables, cacheTableFields, cacheTableStats, initCache, persistMetadataToStorage, getMetadataCacheAge } = await import('../../../utils/sql/cache');
    initCache();
    cacheDatabases(dbList);
    console.log(`[智能提示] 已缓存 ${dbList.length} 个数据库名称`);
    
    // 处理元数据:缓存所有数据库的表和字段信息
    if (res.data?.metadata?.databases && Array.isArray(res.data.metadata.databases)) {
      const dbMetadataList = res.data.metadata.databases;
      
      console.log('[元数据] 📊 后端返回的元数据结构:', dbMetadataList);
      console.log('[元数据] 🔍 第一个数据库的表结构:', dbMetadataList[0]?.tables?.[0]);
      
      let totalTables = 0;
      let totalFields = 0;
      let totalStats = 0;
      
      dbMetadataList.forEach(dbMeta => {
        const dbName = dbMeta.db_name;
        const tables = dbMeta.tables || [];
        
        // 缓存数据库->表的映射
        const tableNames = tables.map(t => t.name).filter(Boolean);
        if (dbName && tableNames.length > 0) {
          cacheDbTables(dbName, tableNames);
          totalTables += tableNames.length;
        }
        
        // 缓存每个表的字段信息和统计信息
        tables.forEach(table => {
          const tableName = table.name;
          const columns = table.columns || [];
          
          // 缓存表统计信息
          if (tableName && (table.row_count !== undefined || table.data_length !== undefined)) {
            const statsToCache = {
              rowCount: table.row_count || 0,
              dataLength: table.data_length || 0,
              indexLength: table.index_length
            };
            console.log(`[元数据缓存] 📊 缓存表 ${tableName} 的统计信息:`, statsToCache);
            cacheTableStats(tableName, statsToCache);
            totalStats++;
          } else {
            console.log(`[元数据缓存] ⚠️ 表 ${tableName} 没有统计信息`);
          }
          
          if (tableName && columns.length > 0) {
            // 转换为补全建议格式
            const fieldSuggestions = columns.map((col, index) => ({
              caption: col.name,
              value: col.name,
              meta: col.data_type || col.column_type || 'field',
              comment: `[${tableName}] ${col.comment || ''}`,
              tableName: tableName,
              dbName: dbName,
              isPrimaryKey: col.column_key === 'PRI' || col.is_primary_key,
              score: 900 - index
            }));
            
            // 缓存到全局(表名作为 key)
            cacheTableFields(tableName, fieldSuggestions);
            totalFields += fieldSuggestions.length;
          }
        });
      });
      
      console.log(`[智能提示] ✅ 元数据缓存完成: ${dbMetadataList.length} 个数据库, ${totalTables} 个表, ${totalFields} 个字段, ${totalStats} 个表统计`);
      
      // 持久化到文件存储
      await persistMetadataToStorage(project, userName || '');
    } else {
      console.log(`[智能提示] ⚠️ 响应中没有元数据`);
    }
    
    // 更新标签页状态
    const cacheAge = await getMetadataCacheAge(project, userName || '');
    updateTab(tabId, { dbList, metadataCacheAge: cacheAge });
  };

  // 刷新元数据
  const handleRefreshMetadata = async () => {
    const tab = tabsRef.current.find(t => t.id === activeTabId);
    const project = tab?.project;
    
    if (!project) {
      console.warn('[刷新元数据] 未选择项目');
      return;
    }
    
    console.log(`[刷新元数据] 🔄 开始刷新项目 ${project} 的元数据`);
    updateTab(activeTabId, { metadataRefreshing: true });
    
    try {
      await fetchAndCacheMetadata(project, activeTabId);
      toast.success('元数据刷新成功');
      console.log(`[刷新元数据] ✅ 刷新完成`);
    } catch (error) {
      console.error('[刷新元数据] ❌ 刷新失败:', error);
      toast.error('刷新失败，请稍后重试');
    } finally {
      updateTab(activeTabId, { metadataRefreshing: false });
    }
  };

  // 数据库变更
  const handleDbChange = async (dbName: string, tabId: string) => {
    const tab = tabsRef.current.find(t => t.id === tabId);
    const project = tab?.project || '';
    
    console.log(`[数据库切换] 标签页 ${tabId}: 项目=${project}, 数据库=${dbName}`);
    
    updateTab(tabId, { dbName, tableList: [] });
    
    if (dbName && project) {
      // 直接从缓存中读取表列表,无需调用 API
      const { getDbTables } = await import('../../../utils/sql/cache');
      const tableList = getDbTables(dbName);
      
      console.log(`[数据库切换] 从缓存读取 ${tableList.length} 个表`);
      updateTab(tabId, { tableList });
    }
  };

  // 执行查询
  const handleExecute = async (sql: string, _isSelection: boolean = false, targetTabId?: string) => {
    // 使用传入的 tabId 或当前激活的 tabId
    const executeTabId = targetTabId || activeTabId;
    
    // 从 ref 获取最新的 tab 状态
    const tab = tabsRef.current.find(t => t.id === executeTabId);
    const tabProject = tab?.project || '';
    const tabDbName = tab?.dbName || '';

    console.log('='.repeat(60));
    console.log('[SQL查询] 🎯 开始执行查询');
    console.log('[SQL查询] 📋 标签页ID:', executeTabId);
    console.log('[SQL查询] 🏢 项目名称:', tabProject);
    console.log('[SQL查询] 💾 数据库名:', tabDbName);
    console.log('[SQL查询] 📝 SQL语句:', sql.substring(0, 100) + (sql.length > 100 ? '...' : ''));
    console.log('[SQL查询] ✂️ 是否选中执行:', _isSelection);

    if (!tabProject || !tabDbName || !sql.trim()) {
      console.log('[SQL查询] ❌ 参数验证失败');
      console.log('[SQL查询] 项目:', tabProject || '(空)');
      console.log('[SQL查询] 数据库:', tabDbName || '(空)');
      console.log('[SQL查询] SQL:', sql.trim() ? '有内容' : '(空)');
      console.log('='.repeat(60));
      
      updateTab(executeTabId, { 
        messages: [{ type: 'warning', content: '请选择项目、数据库并输入SQL' }] 
      });
      return;
    }

    // 生成唯一的 query_id (前端生成,传给后端)
    const queryId = `qid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('[SQL查询] 🆔 生成 queryId:', queryId);

    updateTab(executeTabId, { 
      queryLoading: true, 
      results: [], 
      columns: [], 
      total: 0, 
      took: 0,
      allResults: [],
      currentResultIndex: 0,
      messages: [],
      lastExecutedSql: sql,
      queryId: queryId // 立即设置 queryId
    });
    
    try {
      const queryParams = {
        agent: tabProject,
        dbName: tabDbName,
        query: sql,
        query_id: queryId // 传递给后端
      };
      
      console.log('[SQL查询] 📤 发送请求参数:', queryParams);
      
      const res = await executeQuery(queryParams);
      
      console.log('[SQL查询] 📥 收到响应:', {
        code: res.code,
        message: res.message,
        hasData: !!res.data,
        queryId: res.data?.query_id
      });
      
      if (res.code === 200 && res.data) {
        console.log('[SQL查询] ✅ 查询成功');
        
        // 使用 handleQueryData 处理查询结果
        const processed = handleQueryData(res.data, tabDbName, sql);
        
        console.log('[SQL查询] 📊 处理后的结果:', {
          结果行数: processed.queryResults.length,
          列数: processed.resultColumns.length,
          总数: processed.total,
          耗时: processed.took + 'ms',
          查询ID: processed.queryId,
          结果集数量: processed.allResults.length
        });
        
        updateTab(executeTabId, {
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
        
        console.log('[SQL查询] ✅ 状态已更新');
      } else {
        console.log('[SQL查询] ❌ 查询失败:', res.message);
        updateTab(executeTabId, {
          messages: [{ type: 'error', content: res.message || '查询失败' }]
        });
      }
    } catch (error) {
      console.error('[SQL查询] ❌ 请求异常:', error);
      updateTab(executeTabId, {
        messages: [{ type: 'error', content: '执行查询失败，请稍后重试' }]
      });
    } finally {
      updateTab(executeTabId, { queryLoading: false });
      console.log('[SQL查询] 🏁 查询流程结束');
      console.log('='.repeat(60));
    }
  };

  // 取消查询
  const handleCancelQuery = async () => {
    const tab = tabsRef.current.find(t => t.id === activeTabId);
    const queryId = tab?.queryId;
    const project = tab?.project;
    
    console.log('[取消查询] 🛑 尝试取消查询');
    console.log('[取消查询] queryId:', queryId);
    console.log('[取消查询] project:', project);
    
    if (!queryId) {
      console.warn('[取消查询] ⚠️ 没有 queryId,无法取消');
      toast.warning('查询尚未开始,无法取消');
      return;
    }
    
    if (!project) {
      console.warn('[取消查询] ⚠️ 没有 project,无法取消');
      toast.warning('无法确定项目,取消失败');
      return;
    }
    
    console.log('[取消查询] 📤 发送取消请求,等待后端确认:', { agent: project, query_id: queryId });
    toast.info('正在取消查询,请稍候...');
    
    try {
      const { cancelQuery } = await import('../../../services/sql/search');
      // 同步等待后端响应
      const res = await cancelQuery({ agent: project, query_id: queryId });
      
      console.log('[取消查询] 📥 收到后端响应:', res);
      
      if (res.code === 200) {
        console.log('[取消查询] ✅ 后端确认取消成功');
        toast.success('查询已取消');
        // 只有后端确认成功后才重置状态
        updateTab(activeTabId, {
          queryLoading: false,
          messages: [{ type: 'warning', content: '查询已被取消' }]
        });
      } else {
        console.log('[取消查询] ❌ 后端取消失败:', res.message);
        toast.error(res.message || '取消失败');
        // 取消失败,保持 loading 状态
      }
    } catch (error) {
      console.error('[取消查询] ❌ 请求异常:', error);
      toast.error('取消查询失败');
      // 请求失败,保持 loading 状态
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

  // 后端导出（异步导出，创建任务并监听完成状态）
  const handleExport = async () => {
    console.log('='.repeat(60));
    console.log('[导出] 🎯 开始处理导出请求');
    console.log('[导出] ⏰ 请求时间:', new Date().toLocaleString());
    
    const tab = currentTab;
    console.log('[导出] 📋 当前标签页:', {
      queryId: tab.queryId,
      dbName: tab.dbName,
      project: tab.project
    });
    
    if (!tab.queryId) {
      console.log('[导出] ❌ 缺少查询ID');
      updateTab(activeTabId, {
        messages: [{ type: 'warning', content: '无法导出：缺少查询ID' }]
      });
      return;
    }

    updateTab(activeTabId, { exportLoading: true });
    console.log('[导出] ⏳ 设置加载状态为 true');
    
    try {
      console.log('[导出] 📤 发送导出请求');
      const res = await exportQueryResult({
        query_id: tab.queryId,
        db_name: tab.dbName
      });
      
      console.log('[导出] 📥 收到响应:', res);
      
      if (res.code === 200) {
        console.log('[导出] ✅ 导出请求成功');
        
        // 检查是否返回了任务ID
        const taskId = (res as any).data?.task_id;
        console.log('[导出] 📋 任务ID:', taskId);
        
        if (taskId) {
          // 有任务ID，开始监听任务状态
          console.log('[导出] 🔄 开始监听任务状态');
          
          // 使用 toast 提示请求已提交
          toast.success('导出请求已提交，正在处理中...');
          
          // 导入任务监听API
          const { getTaskDetail } = await import('../../../services/task');
          
          let messageCount = 0;
          const eventSource = getTaskDetail(
            taskId,
            (data) => {
              messageCount++;
              console.log('─'.repeat(60));
              console.log(`[导出] 📨 收到第 ${messageCount} 条任务状态消息`);
              console.log('[导出] 📊 任务数据:', data);
              console.log('[导出] 🔍 任务状态:', data.status);
              
              if (data.status === 'success') {
                console.log('[导出] ✅ 任务完成！');
                eventSource.close();
                
                // 1. 发送带按钮的系统通知（5秒后自动关闭）
                appNotification.withButtons(
                  'success',
                  'SQL导出完成',
                  'SQL导出',
                  [
                    {
                      text: '点击查看',
                      primary: true,
                      onClick: () => {
                        console.log('[导出] 🖱️ 用户点击"点击查看"');
                        import('../../../stores/taskCenterStore').then(({ useTaskCenterStore }) => {
                          const { open, setActiveType } = useTaskCenterStore.getState();
                          setActiveType('sql_export');
                          open();
                          console.log('[导出] ✅ 任务中心已打开');
                        });
                      }
                    }
                  ],
                  5000
                );
                console.log('[导出] 📢 带按钮的通知已发送（5秒后自动关闭）');
                
                // 2. 同时添加到消息中心（铃铛显示未读）
                addMessage({
                  type: 'success',
                  title: 'SQL导出完成',
                  content: 'SQL导出',
                  action: {
                    type: 'task-center'
                  }
                });
                console.log('[导出] 📢 消息中心通知已添加');
              } else if (data.status === 'failed') {
                console.log('[导出] ❌ 任务失败');
                eventSource.close();
                
                addMessage({
                  type: 'error',
                  title: '导出失败',
                  content: data.error_message || '导出任务执行失败',
                });
                console.log('[导出] 📢 失败通知已发送');
              } else if (data.status === 'running') {
                console.log('[导出] ⚙️ 任务运行中...');
                if (data.progress) {
                  console.log('[导出] 📈 进度:', data.progress);
                }
              } else if (data.status === 'pending') {
                console.log('[导出] ⏳ 任务等待中...');
              }
              console.log('─'.repeat(60));
            },
            () => {
              console.error('[导出] ❌ SSE连接错误');
            },
            () => {
              console.log('[导出] 🔒 SSE连接已关闭');
              console.log('[导出] 📊 总共收到消息数:', messageCount);
            }
          );
          
          console.log('[导出] ✅ 任务监听已启动');
        } else {
          // 没有任务ID，使用旧的通知方式
          console.log('[导出] ⚠️ 响应中没有任务ID，使用旧的通知方式');
          toast.success(res.message || '导出任务已提交，请稍后查收邮件');
        }
      } else {
        console.log('[导出] ❌ 导出请求失败:', res.message);
        toast.error(res.message || '导出失败');
      }
    } catch (error) {
      console.error('[导出] ❌ 请求异常:', error);
      toast.error('导出失败，请稍后重试');
    } finally {
      updateTab(activeTabId, { exportLoading: false });
      console.log('[导出] ⏳ 设置加载状态为 false');
      console.log('='.repeat(60));
    }
  };

  // 处理 TableDetail - 默认打开抽屉，提供在新窗口打开的选项
  const handleTableDetail = (tableName: string, command: string) => {
    const tabMap: Record<string, 'fields' | 'preview' | 'indexes' | 'ddl'> = {
      'fields': 'fields',
      'preview': 'preview',
      'indexes': 'indexes',
      'ddl': 'ddl'
    };
    
    // 打开抽屉
    setDrawerTableName(tableName);
    setDrawerActiveTab(tabMap[command] || 'fields');
    setTableDetailDrawerVisible(true);
  };
  
  // 在新窗口打开表详情
  const handleOpenInNewWindow = () => {
    openComponentWindow({
      type: 'table-detail',
      label: `table-detail-${currentTab.dbName}-${drawerTableName}`,
      title: `表详情 - ${drawerTableName}`,
      props: {
        agent: currentTab.project,
        dbName: currentTab.dbName,
        tableName: drawerTableName,
        initialTab: drawerActiveTab
      },
      width: 900,
      height: 700
    });
    // 关闭抽屉
    setTableDetailDrawerVisible(false);
  };

  // 在查询中打开表
  const handleOpenInQuery = async (tableName: string, dbName: string, agent: string) => {
    // 计算新标签页的编号:找到现有标签页中最大的编号
    const maxNum = tabs.reduce((max, tab) => {
      const match = tab.name.match(/查询\s+(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        return num > max ? num : max;
      }
      return max;
    }, 0);
    
    const newNum = maxNum + 1;
    const newId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 从当前标签页复制数据库列表和表列表
    const currentTabData = tabs.find(t => t.id === activeTabId);
    
    const newTab: Tab = {
      ...createTab(newId),
      name: `查询 ${newNum}`,
      project: agent,
      dbName: dbName,
      sqlQuery: `SELECT * FROM ${tableName}`,
      dbList: currentTabData?.dbList || [],
      tableList: currentTabData?.tableList || [],
    };
    
    console.log('[在查询中打开] 创建新标签页:', {
      id: newId,
      name: newTab.name,
      project: agent,
      dbName: dbName,
      sql: `SELECT * FROM ${tableName}`,
      dbListLength: newTab.dbList.length,
      tableListLength: newTab.tableList.length
    });
    
    // 添加新标签页
    setTabs(prev => [...prev, newTab]);
    
    // 关闭抽屉
    setTableDetailDrawerVisible(false);
    
    // 切换到新标签页并执行查询
    setActiveTabId(newId);
    
    // 使用 useEffect 或者更长的延迟确保状态更新完成
    setTimeout(() => {
      console.log('[在查询中打开] 准备执行查询');
      // 直接使用 tabsRef 获取最新状态
      const latestTab = tabsRef.current.find(t => t.id === newId);
      console.log('[在查询中打开] 最新标签页状态:', {
        id: latestTab?.id,
        project: latestTab?.project,
        dbName: latestTab?.dbName,
        sql: latestTab?.sqlQuery
      });
      
      // 传递新标签页的ID给 handleExecute
      handleExecute(`SELECT * FROM ${tableName}`, false, newId);
    }, 200);
  };

  // 插入SQL
  const handleInsertSql = (sql: string) => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) {
      updateTab(activeTabId, { sqlQuery: tab.sqlQuery + (tab.sqlQuery ? '\n' : '') + sql });
    }
  };

  // 显示历史记录（新面板）
  const showHistory = () => {
    setSqlHistoryPanelVisible(true);
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
    setTabs(prevTabs => {
      const fullTab = prevTabs.find(t => t.id === tab.id);
      if (!fullTab) return prevTabs;
      
      // 保存完整数据到 localStorage（避免 URL 过长）
      const detachKey = `sql-detach-${tab.id}`;
      const fullData = {
        id: fullTab.id,
        name: fullTab.name,
        project: fullTab.project,
        dbName: fullTab.dbName,
        sqlQuery: fullTab.sqlQuery,
        dbList: fullTab.dbList,
        tableList: fullTab.tableList,
      };
      localStorage.setItem(detachKey, JSON.stringify(fullData));
      
      // URL 只传递必要的标识参数
      openComponentWindow({
        type: 'sql-workspace',
        label: `sql-workspace-${tab.id}-${Date.now()}`,
        title: `${tab.name} - SQL查询`,
        props: {
          detachKey,
          project: fullTab.project,
          dbName: fullTab.dbName,
        },
        width: 1200,
        height: 800
      });
      
      // 如果只有一个标签页，创建新空白标签
      if (prevTabs.length <= 1) {
        const newId = String(tabCounter + 1);
        setTabCounter(c => c + 1);
        setTimeout(() => setActiveTabId(newId), 0);
        return [createTab(newId)];
      } else {
        // 从当前标签列表中移除
        const remainingTabs = prevTabs.filter(t => t.id !== tab.id);
        if (activeTabId === tab.id && remainingTabs.length > 0) {
          setTimeout(() => setActiveTabId(remainingTabs[0].id), 0);
        }
        return remainingTabs;
      }
    });
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
        onShowSettings={() => setSettingsVisible(true)}
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
            onRefreshMetadata={handleRefreshMetadata}
            metadataRefreshing={currentTab.metadataRefreshing}
            metadataCacheAge={currentTab.metadataCacheAge}
          />
        </div>
        <div className="content">
          {/* 渲染所有标签页的工作区，用 display 控制显示隐藏，避免重新挂载 */}
          {tabs.map(tab => (
            <div key={tab.id} style={{ display: tab.id === activeTabId ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
              <SqlWorkspace
                sql={tab.sqlQuery}
                onSqlChange={(sql: string) => updateTab(tab.id, { sqlQuery: sql })}
                onExecute={handleExecute}
                onCancelQuery={handleCancelQuery}
                onNewTab={addTab}
                onShowHistory={showHistory}
                loading={tab.queryLoading}
                exportLoading={tab.exportLoading}
                results={tab.results}
                columns={tab.columns}
                total={tab.total}
                took={tab.took}
                dbName={tab.dbName}
                queryId={tab.queryId}
                allResults={tab.allResults}
                currentResultIndex={tab.currentResultIndex}
                onResultChange={handleResultChange}
                currentPage={tab.currentPage}
                onPageChange={handlePageChange}
                onExport={handleExport}
                messages={tab.messages}
                tableList={tab.tableList}
                project={tab.project}
              />
            </div>
          ))}
        </div>
      </div>

      <ShortcutSettings visible={settingsVisible} onClose={() => setSettingsVisible(false)} />

      {/* SQL 历史记录面板（个人+共享） */}
      <SqlHistoryPanel
        visible={sqlHistoryPanelVisible}
        project={currentTab.project}
        projectName={projects.find(p => p.value === currentTab.project)?.label || currentTab.project}
        onClose={() => setSqlHistoryPanelVisible(false)}
        onSelect={(sql) => { updateTab(activeTabId, { sqlQuery: sql }); setSqlHistoryPanelVisible(false); }}
        onAppend={(sql) => { updateTab(activeTabId, { sqlQuery: currentTab.sqlQuery ? `${currentTab.sqlQuery}\n\n${sql}` : sql }); setSqlHistoryPanelVisible(false); }}
      />

      {/* 保存共享记录弹框 */}
      <SaveSqlSharedDialog
        visible={saveSharedVisible}
        project={currentTab.project}
        projectName={projects.find(p => p.value === currentTab.project)?.label || currentTab.project}
        dbName={currentTab.dbName}
        sql={currentTab.sqlQuery}
        onClose={() => setSaveSharedVisible(false)}
        onSuccess={() => addMessage({ type: 'success', title: '保存成功', content: 'SQL已保存到共享记录' })}
      />

      {/* 表详情抽屉 */}
      {tableDetailDrawerVisible && (
        <>
          <div className="drawer-overlay" onClick={() => setTableDetailDrawerVisible(false)} />
          <div className="drawer table-detail-drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h4>📋 表详情 - {drawerTableName}</h4>
              <div className="drawer-header-actions">
                <button 
                  className="open-window-btn" 
                  onClick={handleOpenInNewWindow}
                  title="在新窗口打开"
                >
                  🗗
                </button>
                <button className="close-btn" onClick={() => setTableDetailDrawerVisible(false)}>×</button>
              </div>
            </div>
            <div className="drawer-body">
              <TableDetailContent
                agent={currentTab.project}
                dbName={currentTab.dbName}
                tableName={drawerTableName}
                initialTab={drawerActiveTab}
                onOpenInQuery={handleOpenInQuery}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SqlSearch;
