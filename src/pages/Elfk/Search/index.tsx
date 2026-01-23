/**
 * ELFK 日志搜索页面 - 三方布局
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import SearchTabs from './components/SearchTabs';
import ProjectSelect from './components/ProjectSelect';
import SearchForm from './components/SearchForm';
import FieldList from './components/FieldList';
import LogsPanel from './components/LogsPanel';
import AnalysisModal from './components/AnalysisModal';
import { usePageStateStore } from '../../../stores/pageStateStore';
import { openComponentWindow, onReattachTab } from '../../../utils/window';
import type { LogHit } from '../../../services/elfk/search';
import type { ViewDetail } from '../../../services/elfk/view';
import { searchLogs } from '../../../services/elfk/search';
import './styles/index.css';

const PAGE_KEY = 'elfk/search';
const DETACHED_KEY = 'elfk/detached-tabs';

/** 标签页数据 */
export interface TabData {
  id: string;
  name: string;
  initialized: boolean;
  projectInfo: { project: string; projectName: string; category: string; categoryName: string } | null;
  loading: boolean;
  currentView: ViewDetail | null;
  logs: LogHit[];
  total: number;
  keyword: string;
  lastParams: Record<string, unknown>;
  selectedFields: string[];
  timeRange: { start: string; end: string; label: string } | null;
  sortOrder: 'asc' | 'desc';
  autoRefresh: boolean; // 新增：自动刷新开关
}

// 获取今日时间范围
const getTodayRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatLocalDateTime = (date: Date) => 
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return { start: formatLocalDateTime(start), end: formatLocalDateTime(now), label: '今日' };
};

const createDefaultTab = (id: string, name: string): TabData => ({
  id, name, initialized: false, projectInfo: null, loading: false,
  currentView: null, logs: [], total: 0, keyword: '', lastParams: {}, selectedFields: [],
  timeRange: null, sortOrder: 'desc', autoRefresh: false // 默认关闭自动刷新
});

// 序列化标签页（保存完整状态，包括搜索结果）
const serializeTab = (tab: TabData) => ({
  id: tab.id,
  name: tab.name,
  initialized: tab.initialized,
  projectInfo: tab.projectInfo,
  currentView: tab.currentView,
  keyword: tab.keyword,
  logs: tab.logs,
  total: tab.total,
  lastParams: tab.lastParams,
  selectedFields: tab.selectedFields,
  timeRange: tab.timeRange,
  sortOrder: tab.sortOrder,
  autoRefresh: tab.autoRefresh, // 保存自动刷新状态
});

// 格式化为搜索接口需要的格式
const formatSearchTime = (dateStr: string) => {
  const d = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// 格式化本地时间
const formatLocalDateTime = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// 判断是否为相对时间标签
const isRelativeTimeLabel = (label: string) => {
  const relativeLabels = ['过去15分钟', '过去30分钟', '过去45分钟', '近1小时', '近3小时', '近6小时', '近12小时', '今日', '近3天', '近7天', '本月', '近1个月', '近3个月'];
  return relativeLabels.includes(label) || /^过去\d+(分钟|小时|天|周|月)$/.test(label);
};

// 计算相对时间范围
const calculateRelativeTime = (label: string): { start: string; end: string } | null => {
  const now = new Date();
  let start: Date, end: Date = now;
  
  // 匹配"过去X单位"格式
  const match = label.match(/^过去(\d+)(分钟|小时|天|周|月)$/);
  if (match) {
    const value = parseInt(match[1]);
    const unit = match[2];
    const msMap: Record<string, number> = {
      '分钟': 60 * 1000,
      '小时': 3600 * 1000,
      '天': 24 * 3600 * 1000,
      '周': 7 * 24 * 3600 * 1000,
      '月': 30 * 24 * 3600 * 1000,
    };
    start = new Date(now.getTime() - value * msMap[unit]);
    return { start: formatLocalDateTime(start), end: formatLocalDateTime(end) };
  }
  
  // 预设的相对时间
  const timeMap: Record<string, number> = {
    '过去15分钟': 15 * 60 * 1000,
    '过去30分钟': 30 * 60 * 1000,
    '过去45分钟': 45 * 60 * 1000,
    '近1小时': 1 * 3600 * 1000,
    '近3小时': 3 * 3600 * 1000,
    '近6小时': 6 * 3600 * 1000,
    '近12小时': 12 * 3600 * 1000,
    '近3天': 3 * 24 * 3600 * 1000,
    '近7天': 7 * 24 * 3600 * 1000,
    '近1个月': 30 * 24 * 3600 * 1000,
    '近3个月': 90 * 24 * 3600 * 1000,
  };
  
  if (timeMap[label]) {
    start = new Date(now.getTime() - timeMap[label]);
    return { start: formatLocalDateTime(start), end: formatLocalDateTime(end) };
  }
  
  // 特殊处理
  if (label === '今日') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { start: formatLocalDateTime(start), end: formatLocalDateTime(end) };
  }
  
  if (label === '本月') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: formatLocalDateTime(start), end: formatLocalDateTime(end) };
  }
  
  return null;
};

const ElfkSearch = () => {
  const [tabs, setTabs] = useState<TabData[]>([createDefaultTab('tab-1', '搜索 1')]);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const tabCounter = useRef(1);

  // 状态持久化
  const { setPageState, getPageState, _hasHydrated } = usePageStateStore();
  const hasRestored = useRef(false);

  const activeTab = tabs.find(t => t.id === activeTabId);

  // 恢复保存的状态
  useEffect(() => {
    if (!_hasHydrated || hasRestored.current) return;
    hasRestored.current = true;

    try {
      const saved = getPageState<{ tabs: Partial<TabData>[]; activeTabId: string; tabCounter: number }>(PAGE_KEY);
      const detached = getPageState<{ tabs: Partial<TabData>[] }>(DETACHED_KEY);

      console.log('[ELFK] 尝试恢复状态:', saved, '独立窗口:', detached);

      let restoredTabs: TabData[] = [];
      
      // 恢复主窗口标签页
      if (saved?.tabs?.length) {
        restoredTabs = saved.tabs.map(t => ({ ...createDefaultTab(t.id || 'tab-1', t.name || '搜索'), ...t, loading: false }));
      }
      
      // 恢复独立窗口的标签页
      if (detached?.tabs?.length) {
        const detachedTabs = detached.tabs.map(t => ({ ...createDefaultTab(t.id || 'detached', t.name || '日志搜索'), ...t, loading: false, logs: [], total: 0, lastParams: {} }));
        restoredTabs = [...restoredTabs, ...detachedTabs];
        // 清空独立窗口状态
        setPageState(DETACHED_KEY, { tabs: [] });
        console.log('[ELFK] 恢复独立窗口标签页:', detachedTabs.length);
      }

      if (restoredTabs.length > 0) {
        setTabs(restoredTabs);
        setActiveTabId(saved?.activeTabId || restoredTabs[0].id);
        tabCounter.current = saved?.tabCounter || restoredTabs.length;
        console.log('[ELFK] 恢复成功, 标签页数:', restoredTabs.length);
      } else {
        console.log('[ELFK] 没有保存的状态');
      }
    } catch (error) {
      console.error('恢复 ELFK 页面状态失败:', error);
    }
  }, [_hasHydrated, getPageState, setPageState]);

  // 保存状态（防抖）
  useEffect(() => {
    if (!_hasHydrated || !hasRestored.current) return;

    const timer = setTimeout(() => {
      setPageState(PAGE_KEY, { tabs: tabs.map(serializeTab), activeTabId, tabCounter: tabCounter.current });
    }, 500);

    return () => clearTimeout(timer);
  }, [tabs, activeTabId, setPageState, _hasHydrated]);

  // 监听放回事件
  useEffect(() => {
    const unlisten = onReattachTab((data) => {
      if (data.type !== 'elfk') return;
      
      const tabData = data.tabData as Partial<TabData>;
      const newTab: TabData = {
        ...createDefaultTab(tabData.id || `tab-${Date.now()}`, tabData.name || '日志搜索'),
        ...tabData,
        loading: false,
        logs: [],
        total: 0,
        lastParams: {},
      };
      
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newTab.id);
      console.log('[ELFK] 放回标签页:', newTab.name);
    });

    return () => { unlisten.then(fn => fn()); };
  }, []);

  const updateTab = useCallback((tabId: string, updates: Partial<TabData>) => {
    setTabs(prev => prev.map(tab => tab.id === tabId ? { ...tab, ...updates } : tab));
  }, []);

  const handleAddTab = () => {
    tabCounter.current += 1;
    const newTab = createDefaultTab(`tab-${Date.now()}`, `搜索 ${tabCounter.current}`);
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleCloseTab = useCallback((tabId: string) => {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) setActiveTabId(newTabs[Math.max(0, idx - 1)].id);
  }, [tabs, activeTabId]);

  const handleDuplicateTab = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    tabCounter.current += 1;
    setTabs(prev => [...prev, { ...tab, id: `tab-${Date.now()}`, name: `${tab.name} 副本`, logs: [], total: 0, lastParams: {} }]);
  };

  const handleTabsReorder = (newTabs: { id: string; name: string }[]) => {
    setTabs(prev => newTabs.map(t => prev.find(p => p.id === t.id)!).filter(Boolean));
  };

  const handleTabDetach = (tab: { id: string; name: string }) => {
    const fullTab = tabs.find(t => t.id === tab.id);
    if (!fullTab) return;
    
    openComponentWindow({
      type: 'elfk-search',
      label: `elfk-search-${tab.id}-${Date.now()}`,
      title: `${tab.name} - 日志搜索`,
      props: { initialTab: { id: fullTab.id, name: fullTab.name, initialized: fullTab.initialized, projectInfo: fullTab.projectInfo, currentView: fullTab.currentView, keyword: fullTab.keyword } },
      width: 1200, height: 800
    });
    
    if (tabs.length <= 1) {
      tabCounter.current += 1;
      const newTab = createDefaultTab(`tab-${Date.now()}`, `搜索 ${tabCounter.current}`);
      setTabs([newTab]);
      setActiveTabId(newTab.id);
    } else {
      // 从当前标签列表中移除，并切换到其他标签
      const remainingTabs = tabs.filter(t => t.id !== tab.id);
      setTabs(remainingTabs);
      if (activeTabId === tab.id && remainingTabs.length > 0) {
        setActiveTabId(remainingTabs[0].id);
      }
    }
  };

  const handleProjectConfirm = (info: TabData['projectInfo']) => {
    if (!activeTab || !info) return;
    updateTab(activeTab.id, { initialized: true, projectInfo: info, name: `${info.projectName} - ${info.categoryName}` });
  };

  const handleViewChange = (view: ViewDetail) => {
    if (!activeTab) return;
    updateTab(activeTab.id, { currentView: view, name: activeTab.projectInfo ? `${activeTab.projectInfo.projectName} - ${view.name}` : view.name, logs: [], total: 0, lastParams: {}, selectedFields: [], timeRange: getTodayRange() });
  };

  const handleSearch = async (params: Record<string, unknown>) => {
    if (!activeTab) return;
    updateTab(activeTab.id, { loading: true, keyword: params.keyword as string || '' });
    try {
      // 如果有相对时间标签，需要重新计算时间范围
      let searchParams: Record<string, unknown> = { ...params, sort_order: activeTab.sortOrder };
      
      if (activeTab.timeRange?.label && isRelativeTimeLabel(activeTab.timeRange.label)) {
        const actualRange = calculateRelativeTime(activeTab.timeRange.label);
        if (actualRange) {
          searchParams = {
            ...searchParams,
            start_time: formatSearchTime(actualRange.start),
            end_time: formatSearchTime(actualRange.end),
          };
        }
      }
      
      const res = await searchLogs(searchParams as any);
      if (res.code === 200 && res.data) {
        updateTab(activeTab.id, { logs: res.data.hits || [], total: res.data.total_hits || 0, lastParams: { ...searchParams, query_id: res.data.query_id, pages: res.data.pages, page: res.data.page || 1 } });
      }
    } catch (err) { console.error('搜索失败:', err); }
    finally { updateTab(activeTab.id, { loading: false }); }
  };

  const handleTimeRangeChange = (range: { start: string; end: string; label: string }) => {
    if (!activeTab) return;
    updateTab(activeTab.id, { timeRange: range });
  };

  const handleSortChange = async (sortOrder: string) => {
    if (!activeTab?.lastParams?.project) return;
    // 更新标签页的排序状态
    updateTab(activeTab.id, { sortOrder: sortOrder as 'asc' | 'desc' });
    // 使用新的排序重新搜索
    await handleSearch({ ...activeTab.lastParams, sort_order: sortOrder });
  };

  const handleAutoRefreshToggle = (enabled: boolean) => {
    if (!activeTab) return;
    updateTab(activeTab.id, { autoRefresh: enabled });
  };

  // 自动刷新定时器
  useEffect(() => {
    if (!activeTab?.autoRefresh || !activeTab?.lastParams?.project) return;

    const timer = setInterval(() => {
      console.log('[ELFK] 自动刷新触发, lastParams:', activeTab.lastParams);
      handleSearch(activeTab.lastParams);
    }, 5000);

    return () => clearInterval(timer);
  }, [activeTab?.autoRefresh, activeTab?.lastParams, activeTab?.id]);

  const handlePageData = (data: { logs: LogHit[]; page: number; pages: number; append?: boolean }) => {
    if (!activeTab) return;
    if (data.append) {
      // 滚动加载：追加数据
      updateTab(activeTab.id, { 
        logs: [...activeTab.logs, ...data.logs], 
        lastParams: { ...activeTab.lastParams, page: data.page, pages: data.pages } 
      });
    } else {
      // 翻页：替换数据
      updateTab(activeTab.id, { 
        logs: data.logs, 
        lastParams: { ...activeTab.lastParams, page: data.page, pages: data.pages } 
      });
    }
  };

  return (
    <div className="elfk-search-page">
      <SearchTabs 
        tabs={tabs} 
        activeTabId={activeTabId} 
        onTabChange={setActiveTabId}
        onAddTab={handleAddTab} 
        onCloseTab={handleCloseTab} 
        onDuplicateTab={handleDuplicateTab}
        onTabsReorder={handleTabsReorder}
        onTabDetach={handleTabDetach}
      />

      <div className="tab-content">
        {activeTab && !activeTab.initialized ? (
          <ProjectSelect onConfirm={handleProjectConfirm} />
        ) : activeTab ? (
          <div className="search-layout">
            {/* 顶部：视图选择 + 搜索框 */}
            <SearchForm
              key={activeTab.id}
              projectInfo={activeTab.projectInfo}
              currentView={activeTab.currentView}
              loading={activeTab.loading}
              initialKeyword={activeTab.keyword}
              initialTimeRange={activeTab.timeRange || getTodayRange()}
              autoRefresh={activeTab.autoRefresh}
              onViewChange={handleViewChange}
              onSearch={handleSearch}
              onReset={() => activeTab && updateTab(activeTab.id, { logs: [], total: 0, keyword: '', lastParams: {}, timeRange: getTodayRange() })}
              onAddTab={handleAddTab}
              onKeywordChange={(keyword) => updateTab(activeTab.id, { keyword })}
              onTimeRangeChange={handleTimeRangeChange}
              onAutoRefreshToggle={handleAutoRefreshToggle}
            />
            {/* 下方：左侧字段 + 右侧结果 */}
            <div className="main-layout">
              <div className="sidebar">
                <FieldList 
                  currentView={activeTab.currentView} 
                  selectedFields={activeTab.selectedFields}
                  onFieldsChange={(fields) => updateTab(activeTab.id, { selectedFields: fields })}
                />
              </div>
              <div className="content-area">
                <LogsPanel
                  loading={activeTab.loading}
                  logs={activeTab.logs}
                  total={activeTab.total}
                  keyword={activeTab.keyword}
                  currentView={activeTab.currentView}
                  selectedFields={activeTab.selectedFields}
                  searchParams={activeTab.lastParams}
                  sortOrder={activeTab.sortOrder}
                  onSortChange={handleSortChange}
                  onPageData={handlePageData}
                  onLoadingChange={(l: boolean) => updateTab(activeTab.id, { loading: l })}
                  onAnalysis={() => setAnalysisVisible(true)}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* 字段分析弹框 */}
      <AnalysisModal
        visible={analysisVisible}
        currentView={activeTab?.currentView || null}
        searchParams={activeTab?.lastParams || {}}
        logs={activeTab?.logs || []}
        total={activeTab?.total || 0}
        onClose={() => setAnalysisVisible(false)}
      />
    </div>
  );
};

export default ElfkSearch;
