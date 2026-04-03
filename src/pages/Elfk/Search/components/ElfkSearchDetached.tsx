/**
 * ELFK 搜索独立窗口组件
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import ProjectSelect from './ProjectSelect';
import SearchForm from './SearchForm';
import FieldList from './FieldList';
import LogsPanel from './LogsPanel';
import AnalysisModal from './AnalysisModal';
import { usePageStateStore } from '../../../../stores/pageStateStore';
import { emitReattachTab, closeCurrentWindow } from '../../../../utils/window';
import type { TabData } from '../index';
import type { LogHit } from '../../../../services/elfk/search';
import type { ViewDetail } from '../../../../services/elfk/view';
import { searchLogs } from '../../../../services/elfk/search';
import '../styles/index.css';

interface Props {
  initialTab?: Partial<TabData>;
}

const DETACHED_KEY = 'elfk/detached-tabs';

const createDefaultTab = (): TabData => ({
  id: 'detached', name: '日志搜索', initialized: false, projectInfo: null,
  loading: false, currentView: null, logs: [], total: 0, keyword: '', highlightKeyword: '', lastParams: {}, selectedFields: [],
  timeRange: null, sortOrder: 'desc', autoRefresh: false, scrollPosition: 0
});

const ElfkSearchDetached = ({ initialTab }: Props) => {
  const tabId = useRef(`detached-${Date.now()}`);
  const [tab, setTab] = useState<TabData>(() => ({
    ...createDefaultTab(),
    ...initialTab,
    id: tabId.current,
    logs: [], total: 0, lastParams: {}, loading: false,
  }));
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const { setPageState, getPageState } = usePageStateStore();

  // 保存独立窗口状态到 store
  const saveDetachedState = useCallback(() => {
    if (!tab.initialized) return;
    
    const existing = getPageState<{ tabs: Partial<TabData>[] }>(DETACHED_KEY) || { tabs: [] };
    const stateToSave = {
      id: tab.id, name: tab.name, initialized: tab.initialized,
      projectInfo: tab.projectInfo, currentView: tab.currentView, keyword: tab.keyword,
    };
    
    // 更新或添加
    const idx = existing.tabs.findIndex(t => t.id === tab.id);
    if (idx >= 0) {
      existing.tabs[idx] = stateToSave;
    } else {
      existing.tabs.push(stateToSave);
    }
    setPageState(DETACHED_KEY, existing);
  }, [tab, setPageState, getPageState]);

  // 定时保存 + 窗口关闭前保存
  useEffect(() => {
    // 每10秒保存一次
    const timer = setInterval(saveDetachedState, 10000);
    
    // 窗口关闭前保存
    const currentWindow = getCurrentWebviewWindow();
    const unlisten = currentWindow.onCloseRequested(() => {
      saveDetachedState();
      // 同步执行，不阻止关闭
    });

    return () => {
      clearInterval(timer);
      unlisten.then(fn => fn());
    };
  }, [saveDetachedState]);

  const updateTab = useCallback((updates: Partial<TabData>) => {
    setTab(prev => ({ ...prev, ...updates }));
  }, []);

  const handleViewChange = (view: ViewDetail) => {
    const name = tab.projectInfo ? `${tab.projectInfo.projectName} - ${view.name}` : view.name;
    updateTab({ currentView: view, name, logs: [], total: 0, lastParams: {}, selectedFields: [] });
  };

  const handleSearch = async (params: Record<string, unknown>) => {
    updateTab({ loading: true, keyword: params.keyword as string || '' });
    try {
      const res = await searchLogs(params as any);
      if (res.code === 200 && res.data) {
        updateTab({
          logs: res.data.hits || [],
          total: res.data.total_hits || 0,
          lastParams: { ...params, query_id: res.data.query_id, pages: res.data.pages, page: res.data.page || 1 }
        });
      }
    } catch (err) {
      console.error('搜索失败:', err);
    } finally {
      updateTab({ loading: false });
    }
  };

  const handleSortChange = async (sortOrder: string) => {
    if (!tab.lastParams?.project) return;
    await handleSearch({ ...tab.lastParams, sort_order: sortOrder });
  };

  const handlePageData = (data: { logs: LogHit[]; page: number; pages: number }) => {
    updateTab({
      logs: data.logs,
      lastParams: { ...tab.lastParams, page: data.page, pages: data.pages }
    });
  };

  const handleReset = () => {
    updateTab({ logs: [], total: 0, keyword: '', lastParams: {} });
  };

  // 项目选择确认
  const handleProjectConfirm = (info: TabData['projectInfo']) => {
    if (!info) return;
    updateTab({ 
      initialized: true, 
      projectInfo: info, 
      name: `${info.projectName} - ${info.categoryName}` 
    });
  };

  // 放回主窗口
  const handleReattach = async () => {
    const tabData = {
      id: tab.id, name: tab.name, initialized: tab.initialized,
      projectInfo: tab.projectInfo, currentView: tab.currentView, keyword: tab.keyword,
    };
    await emitReattachTab({ type: 'elfk', tabData });
    closeCurrentWindow();
  };

  return (
    <div className="elfk-search-page detached">
      <div className="detached-header">
        <h3>{tab.name}</h3>
        <button className="reattach-btn" onClick={handleReattach} title="放回主窗口">
          ↩ 放回
        </button>
      </div>
      <div className="tab-content">
        {!tab.initialized ? (
          <ProjectSelect onConfirm={handleProjectConfirm} />
        ) : (
          <div className="search-layout">
            <SearchForm
              projectInfo={tab.projectInfo}
              currentView={tab.currentView}
              loading={tab.loading}
              onViewChange={handleViewChange}
              onSearch={handleSearch}
              onReset={handleReset}
            />
            <div className="main-layout">
              <div className="sidebar">
                <FieldList 
                  currentView={tab.currentView} 
                  selectedFields={tab.selectedFields || []}
                  onFieldsChange={(fields) => updateTab({ selectedFields: fields })}
                />
              </div>
              <div className="content-area">
                <LogsPanel
                  loading={tab.loading}
                  logs={tab.logs}
                  total={tab.total}
                  keyword={tab.keyword}
                  currentView={tab.currentView}
                  selectedFields={tab.selectedFields || []}
                  searchParams={tab.lastParams}
                  scrollPosition={tab.scrollPosition}
                  onSortChange={handleSortChange}
                  onPageData={handlePageData}
                  onLoadingChange={(loading) => updateTab({ loading })}
                  onScrollPositionChange={(pos) => updateTab({ scrollPosition: pos })}
                  onAnalysis={() => setAnalysisVisible(true)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
      <AnalysisModal
        visible={analysisVisible}
        currentView={tab.currentView}
        searchParams={tab.lastParams}
        logs={tab.logs}
        total={tab.total}
        onClose={() => setAnalysisVisible(false)}
      />
    </div>
  );
};

export default ElfkSearchDetached;
