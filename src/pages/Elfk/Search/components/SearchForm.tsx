/**
 * 搜索表单 - 顶部栏：视图选择 + 搜索框 + 时间范围
 */

import { useState, useEffect, useRef } from 'react';
import { getViewList, getViewDetail } from '../../../../services/elfk/view';
import TimeRangePicker from './TimeRangePicker';
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
  onViewChange: (view: ViewDetail) => void;
  onSearch: (params: Record<string, unknown>) => void;
  onReset: () => void;
}

const HISTORY_KEY = 'elfk_search_history';
const MAX_HISTORY = 20;

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

// 读取历史记录
const loadHistory = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
};

// 保存历史记录
const saveHistory = (keyword: string) => {
  if (!keyword.trim()) return;
  const history = loadHistory().filter(h => h !== keyword);
  history.unshift(keyword);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
};

const SearchForm = ({ projectInfo, currentView, loading, onViewChange, onSearch, onReset }: Props) => {
  const [allViews, setAllViews] = useState<ViewListItem[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [timeRange, setTimeRange] = useState(getTodayRange);
  const [localKeyword, setLocalKeyword] = useState('');
  const [historyVisible, setHistoryVisible] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const historyRef = useRef<HTMLDivElement>(null);

  // 根据分类过滤视图
  const views = projectInfo?.category
    ? allViews.filter(v => v.category === projectInfo.category || v.view_category === projectInfo.category)
    : allViews;

  useEffect(() => {
    if (projectInfo) fetchViews();
  }, [projectInfo?.project]);

  // 点击外部关闭历史记录
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setHistoryVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleSearch = () => {
    if (!currentView || !projectInfo) return;
    if (localKeyword.trim()) saveHistory(localKeyword.trim());
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
    setHistoryVisible(false);
  };

  const handleReset = () => {
    setLocalKeyword('');
    setTimeRange(getTodayRange());
    onReset();
  };

  const handleShowHistory = () => {
    setHistory(loadHistory());
    setHistoryVisible(!historyVisible);
  };

  const handleSelectHistory = (keyword: string) => {
    setLocalKeyword(keyword);
    setHistoryVisible(false);
  };

  const handleClearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  };

  return (
    <div className="search-form-bar">
      {/* 视图选择 */}
      <div className="view-select">
        <select value={currentView?.id || ''} onChange={e => handleViewSelect(e.target.value)} disabled={viewLoading}>
          <option value="">{viewLoading ? '加载中...' : '请选择视图'}</option>
          {views.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      {/* 搜索框 */}
      <div className="search-input" ref={historyRef}>
        <span className="search-icon" onClick={handleShowHistory} title="搜索历史">🔍</span>
        <input
          type="text"
          placeholder="输入搜索关键词，支持 Lucene 语法"
          value={localKeyword}
          onChange={e => setLocalKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        {/* 搜索历史下拉 */}
        {historyVisible && (
          <div className="search-history-dropdown">
            <div className="history-header">
              <span>搜索历史</span>
              {history.length > 0 && <button onClick={handleClearHistory}>清空</button>}
            </div>
            {history.length === 0 ? (
              <div className="history-empty">暂无搜索历史</div>
            ) : (
              <ul className="history-list">
                {history.map((h, i) => (
                  <li key={i} onClick={() => handleSelectHistory(h)}>{h}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* 时间范围选择器 */}
      <TimeRangePicker value={timeRange} onChange={(range) => setTimeRange({ ...range, label: range.label || '自定义' })} />

      {/* 按钮 */}
      <div className="form-btns">
        <button className="btn-search" onClick={handleSearch} disabled={loading || !currentView}>
          {loading ? '搜索中...' : '搜索'}
        </button>
        <button className="btn-reset" onClick={handleReset}>重置</button>
      </div>
    </div>
  );
};

export default SearchForm;
