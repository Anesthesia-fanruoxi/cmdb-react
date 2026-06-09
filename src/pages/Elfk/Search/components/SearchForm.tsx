/**
 * 搜索表单 - 顶部栏：视图选择 + 搜索框 + 时间范围
 * 更新时间：2025-01-23
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getViewList, getViewDetail } from '../../../../services/elfk/view';
import { useUserPrefsStore } from '../../../../stores';
import KibanaTimeRangePicker from './KibanaTimeRangePicker';
import ElfkHistoryDrawer, { saveLocalHistory } from './ElfkHistoryDrawer';
import SaveSharedDialog from './SaveSharedDialog';
import ShortcutSettings from './ShortcutSettings';
import type { ViewListItem, ViewDetail } from '../../../../services/elfk/view';

interface ProjectInfo {
  project: string;
  projectName: string;
  category: string;
  categoryName: string;
}

interface Props {
  projectInfo: ProjectInfo | null;
  currentView: ViewDetail | null;
  loading: boolean;
  initialKeyword?: string;
  initialTimeRange?: { start: string; end: string; label: string };
  autoRefresh?: boolean; // 新增：自动刷新状态
  onViewChange: (view: ViewDetail) => void;
  onSearch: (params: Record<string, unknown>) => void;
  onReset: () => void;
  onAddTab?: () => void;
  onKeywordChange?: (keyword: string) => void;
  onTimeRangeChange?: (range: { start: string; end: string; label: string }) => void;
  onAutoRefreshToggle?: (enabled: boolean) => void; // 新增：自动刷新切换回调
}

// 格式化本地时间（包含秒）
const formatLocalDateTime = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

// 格式化为搜索接口需要的格式
const formatSearchTime = (dateStr: string) => {
  const d = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// 获取今日时间范围
const getTodayRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { start: formatLocalDateTime(start), end: formatLocalDateTime(now), label: '今日' };
};

// 解析快捷键
const parseShortcut = (shortcut: string) => {
  const parts = shortcut.split('-');
  return {
    ctrl: parts.includes('Ctrl'),
    shift: parts.includes('Shift'),
    alt: parts.includes('Alt'),
    key: parts[parts.length - 1].toLowerCase(),
  };
};

// 检查快捷键是否匹配
const matchShortcut = (e: KeyboardEvent, shortcut: string) => {
  const parsed = parseShortcut(shortcut);
  const key = e.key.toLowerCase() === 'enter' ? 'enter' : e.key.toLowerCase();
  return (
    (e.ctrlKey || e.metaKey) === parsed.ctrl &&
    e.shiftKey === parsed.shift &&
    e.altKey === parsed.alt &&
    key === parsed.key
  );
};

// 相对时间配置（与 TimeRangePicker 保持一致）
const relativeTimeConfig: Record<string, { ms?: number; getRange?: () => { start: Date; end: Date } }> = {
  '过去15分钟': { ms: 15 * 60 * 1000 },
  '过去30分钟': { ms: 30 * 60 * 1000 },
  '过去45分钟': { ms: 45 * 60 * 1000 },
  '近1小时': { ms: 1 * 3600 * 1000 },
  '近3小时': { ms: 3 * 3600 * 1000 },
  '近6小时': { ms: 6 * 3600 * 1000 },
  '近12小时': { ms: 12 * 3600 * 1000 },
  '今日': { getRange: () => {
    const now = new Date();
    return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: now };
  }},
  '近3天': { ms: 3 * 24 * 3600 * 1000 },
  '近7天': { ms: 7 * 24 * 3600 * 1000 },
  '本月': { getRange: () => {
    const now = new Date();
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  }},
  '近1个月': { ms: 30 * 24 * 3600 * 1000 },
  '近3个月': { ms: 90 * 24 * 3600 * 1000 },
};

// 根据 label 动态计算时间范围
const getActualTimeRange = (timeRange: { start: string; end: string; label: string }) => {
  const config = relativeTimeConfig[timeRange.label];
  if (!config) {
    // 自定义时间或固定时间（如"昨日"、"上月"），直接使用保存的值
    return { start: timeRange.start, end: timeRange.end };
  }
  
  const now = new Date();
  let start: Date, end: Date;
  
  if (config.getRange) {
    const range = config.getRange();
    start = range.start;
    end = range.end;
  } else if (config.ms) {
    end = now;
    start = new Date(now.getTime() - config.ms);
  } else {
    return { start: timeRange.start, end: timeRange.end };
  }
  
  return { start: formatLocalDateTime(start), end: formatLocalDateTime(end) };
};

const SearchForm = ({ projectInfo, currentView, loading, initialKeyword, initialTimeRange, autoRefresh = false, onViewChange, onSearch, onReset, onAddTab, onKeywordChange, onTimeRangeChange, onAutoRefreshToggle }: Props) => {
  const [allViews, setAllViews] = useState<ViewListItem[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [timeRange, setTimeRange] = useState(initialTimeRange || getTodayRange);
  const [localKeyword, setLocalKeyword] = useState(initialKeyword || '');
  
  // 弹框状态
  const [historyVisible, setHistoryVisible] = useState(false);
  const [saveSharedVisible, setSaveSharedVisible] = useState(false);
  const [shortcutVisible, setShortcutVisible] = useState(false);

  const { elfkShortcuts } = useUserPrefsStore();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const keywordChangeTimer = useRef<number | null>(null);
  const onKeywordChangeRef = useRef(onKeywordChange);
  onKeywordChangeRef.current = onKeywordChange;

  // textarea 自适应高度
  const adjustHeight = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxH = window.innerHeight * 0.8 - 20;
    const scrollH = el.scrollHeight;
    if (scrollH > maxH) {
      el.style.height = `${maxH}px`;
      el.classList.add('has-scroll');
    } else {
      el.style.height = `${scrollH}px`;
      el.classList.remove('has-scroll');
    }
  };

  // 同步外部传入的 keyword
  useEffect(() => {
    if (initialKeyword !== undefined && initialKeyword !== localKeyword) {
      setLocalKeyword(initialKeyword);
    }
  }, [initialKeyword]);

  // keyword 变化后同步高度
  useEffect(() => {
    adjustHeight();
  }, [localKeyword]);

  // 输入变化时同步到父组件（防抖，避免频繁重渲染导致卡顿）
  const handleKeywordChange = (value: string) => {
    setLocalKeyword(value);
    if (keywordChangeTimer.current) {
      window.clearTimeout(keywordChangeTimer.current);
    }
    keywordChangeTimer.current = window.setTimeout(() => {
      onKeywordChangeRef.current?.(value);
    }, 200);
  };

  // 卸载时清理定时器
  useEffect(() => {
    return () => {
      if (keywordChangeTimer.current) window.clearTimeout(keywordChangeTimer.current);
    };
  }, []);

  // 根据分类过滤视图
  const views = projectInfo?.category
    ? allViews.filter(v => v.category === projectInfo.category || v.view_category === projectInfo.category)
    : allViews;

  useEffect(() => {
    if (projectInfo) fetchViews();
  }, [projectInfo?.project]);

  const fetchViews = async () => {
    if (!projectInfo) return;
    setViewLoading(true);
    try {
      const res = await getViewList({ project: projectInfo.project });
      if (res.code === 200) setAllViews(res.data || []);
    } catch (err) { console.error('获取视图列表失败:', err); }
    finally { setViewLoading(false); }
  };

  const handleViewSelect = async (viewId: string) => {
    if (!viewId) return;
    try {
      const res = await getViewDetail(viewId);
      if (res.code === 200 && res.data) onViewChange(res.data);
    } catch (err) { console.error('获取视图详情失败:', err); }
  };

  const handleSearch = useCallback(() => {
    if (!currentView || !projectInfo) return;
    if (localKeyword.trim()) saveLocalHistory(localKeyword.trim());
    // 冲刷防抖，立即同步最新 keyword 到父组件
    if (keywordChangeTimer.current) {
      window.clearTimeout(keywordChangeTimer.current);
      keywordChangeTimer.current = null;
      onKeywordChangeRef.current?.(localKeyword);
    }
    
    // 动态计算实际时间范围
    const actualRange = getActualTimeRange(timeRange);
    
    const formattedStart = formatSearchTime(actualRange.start);
    const formattedEnd = formatSearchTime(actualRange.end);
    
    onSearch({
      project: projectInfo.project,
      view_id: currentView.id,
      view_name: currentView.name,
      index_pattern: currentView.index_pattern,
      start_time: formattedStart,
      end_time: formattedEnd,
      time_field: currentView.time_field || '@timestamp',
      time_format: currentView.time_format || 'epoch_millis',
      keyword: localKeyword.trim(),
      log_type: currentView.log_type || 'elfk',
      time_label: timeRange.label || '自定义' // 传递时间标签，用于后续重新计算
    });
  }, [currentView, projectInfo, localKeyword, timeRange, onSearch]);

  // 时间范围变化时同步到父组件，并根据需要自动搜索
  const handleTimeRangeChange = (range: { start: string; end: string; label?: string }, autoSearch = false) => {
    const newRange = { ...range, label: range.label || '自定义' };
    setTimeRange(newRange);
    onTimeRangeChange?.(newRange);
    
    // 如果需要自动搜索（快捷选择触发）
    if (autoSearch && currentView && projectInfo) {
      // 使用新的时间范围立即搜索
      const actualRange = getActualTimeRange(newRange);
      
      onSearch({
        project: projectInfo.project,
        view_id: currentView.id,
        view_name: currentView.name,
        index_pattern: currentView.index_pattern,
        start_time: formatSearchTime(actualRange.start),
        end_time: formatSearchTime(actualRange.end),
        time_field: currentView.time_field || '@timestamp',
        time_format: currentView.time_format || 'epoch_millis',
        keyword: localKeyword.trim(),
        log_type: currentView.log_type || 'elfk'
      });
    }
  };

  const handleReset = () => {
    setLocalKeyword('');
    const defaultRange = getTodayRange();
    setTimeRange(defaultRange);
    onTimeRangeChange?.(defaultRange);
    onReset();
  };

  // 选择历史记录（填入并搜索）
  const handleSelectHistory = (keyword: string) => {
    setLocalKeyword(keyword);
    setHistoryVisible(false);
    // 直接触发搜索
    if (!currentView || !projectInfo) return;
    if (keyword.trim()) saveLocalHistory(keyword.trim());
    
    // 动态计算实际时间范围
    const actualRange = getActualTimeRange(timeRange);
    
    onSearch({
      project: projectInfo.project,
      view_id: currentView.id,
      view_name: currentView.name,
      index_pattern: currentView.index_pattern,
      start_time: formatSearchTime(actualRange.start),
      end_time: formatSearchTime(actualRange.end),
      time_field: currentView.time_field || '@timestamp',
      time_format: currentView.time_format || 'epoch_millis',
      keyword: keyword.trim(),
      log_type: currentView.log_type || 'elfk',
      time_label: timeRange.label || '自定义' // 传递时间标签
    });
  };

  // 追加历史记录
  const handleAppendHistory = (keyword: string) => {
    setLocalKeyword(prev => prev ? `${prev} ${keyword}` : keyword);
    setHistoryVisible(false);
  };

  // 快捷键处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 搜索
      if (matchShortcut(e, elfkShortcuts.search)) {
        e.preventDefault();
        handleSearch();
        return;
      }
      // 历史记录
      if (matchShortcut(e, elfkShortcuts.history)) {
        e.preventDefault();
        setHistoryVisible(true);
        return;
      }
      // 保存共享
      if (matchShortcut(e, elfkShortcuts.saveShared)) {
        e.preventDefault();
        if (localKeyword.trim() && currentView) {
          setSaveSharedVisible(true);
        }
        return;
      }
      // 新建标签页
      if (matchShortcut(e, elfkShortcuts.newTab)) {
        e.preventDefault();
        onAddTab?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [elfkShortcuts, handleSearch, localKeyword, currentView, onAddTab]);

  return (
    <>
      <div className="search-form-bar">
        {/* 视图选择 */}
        <div className="view-select">
          <select value={currentView?.id || ''} onChange={e => handleViewSelect(e.target.value)} disabled={viewLoading}>
            <option value="">{viewLoading ? '加载中...' : '请选择视图'}</option>
            {views.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>

        {/* 搜索框 */}
        <div className={`search-input-wrapper${inputFocused ? ' search-input-expanded' : ''}`}>
          <div className="search-input">
            <span className="search-icon" onClick={() => setHistoryVisible(!historyVisible)} title="历史记录">🔍</span>
            <textarea
              ref={inputRef}
              rows={1}
              placeholder="输入搜索关键词，支持 Lucene 语法"
              value={localKeyword}
              onChange={e => { handleKeywordChange(e.target.value); adjustHeight(); }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSearch(); } }}
              onFocus={() => { setInputFocused(true); adjustHeight(); }}
              onBlur={() => setInputFocused(false)}
            />
          </div>
        </div>

        {/* 时间范围选择器 - Kibana 风格 */}
        <KibanaTimeRangePicker 
          value={timeRange} 
          onChange={handleTimeRangeChange}
        />

        {/* 按钮 */}
        <div className="form-btns">
          <button className="btn-search" onClick={handleSearch} disabled={loading || !currentView}>
            {loading ? '搜索中...' : '搜索'}
          </button>
          <button className="btn-reset" onClick={handleReset}>重置</button>
          <button 
            className={`btn-auto-refresh ${autoRefresh ? 'active' : ''}`}
            onClick={() => onAutoRefreshToggle?.(!autoRefresh)}
            title={autoRefresh ? '关闭自动刷新' : '开启自动刷新（每5秒）'}
          >
            🔄 {autoRefresh ? '自动刷新中' : '自动刷新'}
          </button>
          <button className="btn-settings" onClick={() => setShortcutVisible(true)} title="快捷键设置">
            ⚙️
          </button>
        </div>
      </div>

      {/* 保存共享记录弹框 */}
      <SaveSharedDialog
        visible={saveSharedVisible}
        projectInfo={projectInfo}
        viewId={Number(currentView?.id) || 0}
        viewName={currentView?.name || ''}
        keyword={localKeyword}
        onClose={() => setSaveSharedVisible(false)}
        onSuccess={() => {}}
      />

      {/* 历史记录抽屉（侧边栏） */}
      <ElfkHistoryDrawer
        visible={historyVisible}
        projectInfo={projectInfo}
        viewId={Number(currentView?.id) || 0}
        onClose={() => setHistoryVisible(false)}
        onSelect={handleSelectHistory}
        onAppend={handleAppendHistory}
      />

      {/* 快捷键设置 */}
      <ShortcutSettings
        visible={shortcutVisible}
        onClose={() => setShortcutVisible(false)}
      />
    </>
  );
};

export default SearchForm;
