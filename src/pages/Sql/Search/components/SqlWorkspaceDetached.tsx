/**
 * 独立窗口 SQL 工作区
 * 用于从主窗口分离出来的标签页（仅编辑器 + 结果面板）
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import {
  executeQuery,
  executePageQuery,
  exportQueryResult,
} from '../../../../services/sql/search';
import { useAuthStore } from '../../../../stores/authStore';
import {
  createSqlTabId,
  getSqlSearchIndex,
  saveSqlTabState,
  updateSqlSearchUser,
} from '../../../../services/storage/sqlSearchStorage';
import { emitReattachTab, closeCurrentWindow } from '../../../../utils/window';
import SqlWorkspace from './SqlWorkspace';
import { handleQueryData, parsePageResponse } from '../utils/handleQueryData';
import type { Tab } from '../index';
import '../styles/index.css';

interface Props {
  detachKey?: string;
  project?: string;
  dbName?: string;
  initialTab?: Tab;
}

const RESULT_PAGE_SIZE = 20;

// 创建默认 Tab
const createDefaultTab = (id: string): Tab => ({
  id,
  name: `查询 ${id}`,
  project: '',
  dbName: '',
  sqlQuery: '',
  dbList: [],
  tableList: [],
  queryLoading: false,
  treeLoading: false,
  exportLoading: false,
  results: [],
  columns: [],
  total: 0,
  took: 0,
  queryId: '',
  currentPage: 1,
  pageSize: 50,
  allResults: [],
  currentResultIndex: 0,
  lastExecutedSql: '',
  messages: [],
  metadataRefreshing: false,
  metadataCacheAge: null,
});

const SqlWorkspaceDetached = ({ detachKey, project, dbName, initialTab }: Props) => {
  const getInitialTab = (): Partial<Tab> => {
    if (detachKey) {
      try {
        const saved = localStorage.getItem(detachKey);
        if (saved) {
          localStorage.removeItem(detachKey);
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
  const tabId = useRef(initData.id || createSqlTabId());
  const [tab, setTab] = useState<Tab>(() => ({
    ...createDefaultTab(tabId.current),
    ...initData,
    id: tabId.current,
  }));
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const pageReqSeqRef = useRef(0);
  const userName = useAuthStore((state) => state.userName);

  const updateTab = useCallback((updates: Partial<Tab>) => {
    setTab((prev) => ({ ...prev, ...updates }));
  }, []);

  const saveDetachedState = useCallback(() => {
    if (!tab.project || !userName) return;

    saveSqlTabState(tab.id, {
      name: tab.name,
      project: tab.project,
      dbName: tab.dbName,
      sqlQuery: tab.sqlQuery,
      dbList: tab.dbList,
      tableList: tab.tableList,
      detached: true,
    });

    const userIndex = getSqlSearchIndex().users[userName];
    updateSqlSearchUser(userName, {
      tabIds: Array.from(new Set([...(userIndex?.tabIds || []), tab.id])),
      detachedTabIds: Array.from(new Set([...(userIndex?.detachedTabIds || []), tab.id])),
      activeTabId: userIndex?.activeTabId || tab.id,
    });
  }, [tab, userName]);

  useEffect(() => {
    const timer = setInterval(saveDetachedState, 10000);

    const currentWindow = getCurrentWebviewWindow();
    const unlisten = currentWindow.onCloseRequested(() => {
      saveDetachedState();
    });

    return () => {
      clearInterval(timer);
      unlisten.then((fn) => fn());
    };
  }, [saveDetachedState]);

  const handleExecute = async (sql: string) => {
    const current = tabRef.current;
    if (!current.project || !current.dbName || !sql.trim()) {
      updateTab({ messages: [{ type: 'warning', content: '请选择项目、数据库并输入SQL' }] });
      return;
    }

    const queryId = `qid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    pageReqSeqRef.current += 1;

    updateTab({
      queryLoading: true,
      results: [],
      columns: [],
      total: 0,
      took: 0,
      allResults: [],
      currentResultIndex: 0,
      messages: [],
      lastExecutedSql: sql,
      queryId,
    });

    try {
      const res = await executeQuery({
        agent: current.project,
        dbName: current.dbName,
        query: sql,
        query_id: queryId,
      });
      if (res.code === 200 && res.data) {
        const p = handleQueryData(res.data, current.dbName, sql, queryId);
        updateTab({
          results: p.queryResults,
          columns: p.resultColumns,
          total: p.total,
          took: p.took,
          queryId,
          allResults: p.allResults,
          currentResultIndex: 0,
          currentPage: 1,
          messages: [],
        });
      } else {
        updateTab({ messages: [{ type: 'error', content: res.message || '查询失败' }] });
      }
    } catch (e) {
      console.error('执行查询失败:', e);
      updateTab({ messages: [{ type: 'error', content: '执行查询失败' }] });
    } finally {
      updateTab({ queryLoading: false });
    }
  };

  const handlePageChange = async (
    page: number,
    size: number,
    opts?: { resultIndex?: number },
  ) => {
    const current = tabRef.current;
    const resultIndex = opts?.resultIndex ?? current.currentResultIndex;
    const resultQueryId =
      current.allResults[resultIndex]?.queryId || current.queryId;
    if (!resultQueryId) return;

    const sessionQueryId = current.queryId;
    const reqId = ++pageReqSeqRef.current;

    updateTab({
      queryLoading: true,
      currentPage: page,
      pageSize: size,
      ...(opts?.resultIndex != null ? { currentResultIndex: resultIndex } : {}),
    });

    try {
      const res = await executePageQuery({
        query_id: resultQueryId,
        page,
        size,
        result_index: resultIndex,
      });

      if (reqId !== pageReqSeqRef.current) return;
      const latest = tabRef.current;
      if (latest.queryId !== sessionQueryId || latest.currentResultIndex !== resultIndex) return;
      const latestResultQid = latest.allResults[resultIndex]?.queryId || latest.queryId;
      if (latestResultQid !== resultQueryId) return;

      if (res.code === 200 && res.data) {
        const parsed = parsePageResponse(res.data, resultIndex);
        const rows = parsed.rows;
        const cols = parsed.columns || latest.columns;
        const total = parsed.total !== undefined ? parsed.total : latest.total;
        const newAll = [...latest.allResults];
        if (newAll[resultIndex]) {
          newAll[resultIndex] = {
            ...newAll[resultIndex],
            data: rows,
            total,
            columns: cols,
            page,
          };
        }
        updateTab({
          results: rows,
          columns: cols,
          total,
          currentPage: page,
          pageSize: size,
          allResults: newAll,
        });
      }
    } catch (e) {
      if (reqId !== pageReqSeqRef.current) return;
      console.error('分页失败:', e);
    } finally {
      if (reqId === pageReqSeqRef.current) {
        updateTab({ queryLoading: false });
      }
    }
  };

  const handleResultChange = (index: number) => {
    const current = tabRef.current;
    if (index < 0 || index >= current.allResults.length) return;
    const r = current.allResults[index];
    const pageSize = current.pageSize || RESULT_PAGE_SIZE;
    const cachedPage = r.page ?? 1;
    updateTab({
      currentResultIndex: index,
      results: r.data,
      columns: r.columns,
      total: r.total,
      took: r.took,
      currentPage: cachedPage,
      pageSize,
    });
    if ((!r.data || r.data.length === 0) && current.queryId) {
      void handlePageChange(1, pageSize, { resultIndex: index });
    }
  };

  const handleExport = async () => {
    const exportQueryId =
      tab.allResults[tab.currentResultIndex]?.queryId || tab.queryId;
    if (!exportQueryId) {
      updateTab({ messages: [{ type: 'warning', content: '无法导出：缺少查询ID' }] });
      return;
    }
    updateTab({ exportLoading: true });
    try {
      const res = await exportQueryResult({ query_id: exportQueryId, db_name: tab.dbName });
      if (res instanceof Blob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(res);
        a.download = `query_result_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
      }
    } catch (e) {
      console.error('导出失败:', e);
    } finally {
      updateTab({ exportLoading: false });
    }
  };

  const handleReattach = async () => {
    const tabData = {
      id: tab.id,
      name: tab.name,
      project: tab.project,
      dbName: tab.dbName,
      sqlQuery: tab.sqlQuery,
      dbList: tab.dbList,
      tableList: tab.tableList,
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
          <SqlWorkspace
            tabId={detachKey}
            sql={tab.sqlQuery}
            onSqlChange={(sql: string) => updateTab({ sqlQuery: sql })}
            onExecute={handleExecute}
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
            lastExecutedSql={tab.lastExecutedSql}
          />
        </div>
      </div>
    </div>
  );
};

export default SqlWorkspaceDetached;
