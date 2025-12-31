/**
 * 搜索表单 - 顶部栏：视图选择 + 搜索框 + 时间范围
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getViewList, getViewDetail } from '../../../../services/elfk/view';
import { useUserPrefsStore } from '../../../../stores';
import TimeRangePicker from './TimeRangePicker';
import HistoryDropdown, { saveLocalHistory } from './HistoryDropdown';
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
  onViewChange: (view: ViewDetail) => void;
  onSearch: (params: Record<string, unknown>) => void;
  onReset: () => void;
  onAddTab?: () => void;
}

// 格式化本地时间
const formatLocalDateTime = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

const SearchForm = ({ projectInfo, currentView, loading, initialKeyword, onViewChange, onSearch, onReset, onAddTab }: Props) => {
  const [allViews, setAllViews] = useState<ViewListItem[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [timeRange, setTimeRange] = useState(getTodayRange);
  const [localKeyword, setLocalKeyword] = useState(initialKeyword || '');
  
  // 弹框状态
  const [historyVisible, setHistoryVisible] = useState(false);
  const [saveSharedVisible, setSaveSharedVisible] = useState(false);
  const [shortcutVisible, setShortcutVisible] = useState(false);

  const { elfkShortcuts } = useUserPrefsStore();
  const inputRef = useRef<HTMLInputElement>(null);

  // 同步外部传入的 keyword
  useEffect(() => {
    if (initialKeyword !== undefined) {
      setLocalKeyword(initialKeyword);
    }
  }, [initialKeyword]);

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
    onSearch({
      project: projectInfo.project,
      view_id: currentView.id,
      view_name: currentView.name,
      index_pattern: currentView.index_pattern,
      start_time: formatSearchTime(timeRange.start),
      end_time: formatSearchTime(timeRange.end),
      time_field: currentView.time_field || '@timestamp',
      time_format: currentView.time_format || 'epoch_millis',
      keyword: localKeyword.trim(),
      log_type: currentView.log_type || 'elfk'
    });
  }, [currentView, projectInfo, localKeyword, timeRange, onSearch]);

  const handleReset = () => {
    setLocalKeyword('');
    setTimeRange(getTodayRange());
    onReset();
  };

  // 选择历史记录（填入并搜索）
  const handleSelectHistory = (keyword: string) => {
    setLocalKeyword(keyword);
    setHistoryVisible(false);
    // 直接触发搜索
    if (!currentView || !projectInfo) return;
    if (keyword.trim()) saveLocalHistory(keyword.trim());
    onSearch({
      project: projectInfo.project,
      view_id: currentView.id,
      view_name: currentView.name,
      index_pattern: currentView.index_pattern,
      start_time: formatSearchTime(timeRange.start),
      end_time: formatSearchTime(timeRange.end),
      time_field: currentView.time_field || '@timestamp',
      time_format: currentView.time_format || 'epoch_millis',
      keyword: keyword.trim(),
      log_type: currentView.log_type || 'elfk'
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
        <div className="search-input-wrapper">
          <div className="search-input">
            <span className="search-icon" onClick={() => setHistoryVisible(!historyVisible)} title="历史记录">🔍</span>
            <input
              ref={inputRef}
              type="text"
              placeholder="输入搜索关键词，支持 Lucene 语法"
              value={localKeyword}
              onChange={e => setLocalKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              onFocus={() => setHistoryVisible(true)}
            />
          </div>
          <HistoryDropdown
            visible={historyVisible}
            projectInfo={projectInfo}
            viewId={Number(currentView?.id) || 0}
            onClose={() => setHistoryVisible(false)}
            onSelect={handleSelectHistory}
            onAppend={handleAppendHistory}
          />
        </div>

        {/* 时间范围选择器 */}
        <TimeRangePicker value={timeRange} onChange={(range) => setTimeRange({ ...range, label: range.label || '自定义' })} />

        {/* 按钮 */}
        <div className="form-btns">
          <button className="btn-search" onClick={handleSearch} disabled={loading || !currentView}>
            {loading ? '搜索中...' : '搜索'}
          </button>
          <button className="btn-reset" onClick={handleReset}>重置</button>
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
        onSuccess={() => console.log('保存成功')}
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
