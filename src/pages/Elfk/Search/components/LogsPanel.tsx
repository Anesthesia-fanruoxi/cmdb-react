/**
 * 日志列表面板
 * 支持行展示 / JSON 展示两种模式，滚动自动加载和分页
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUp, ArrowDown, BarChart3, Download, Loader2, AlignLeft, Braces } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useMessageStore } from '@/stores/messageStore';
import { searchLogsPage } from '@/services/elfk/search';
import ExportDialog from './ExportDialog';
import ContextDrawer from './ContextDrawer';
import LogEntryJson from './LogEntryJson';
import LogEntryLine from './LogEntryLine';
import toast from '@/components/Toast';
import type { LogHit } from '@/services/elfk/search';
import type { ViewDetail } from '@/services/elfk/view';

/** 展示模式：行模式 | JSON 模式 */
type DisplayMode = 'line' | 'json';
const DISPLAY_MODE_KEY = 'elfk:log-display-mode';

interface LogsPanelProps {
  loading: boolean;
  logs: LogHit[];
  total: number;
  keyword: string;
  currentView: ViewDetail | null;
  selectedFields: string[];
  searchParams?: Record<string, unknown>;
  sortOrder?: 'asc' | 'desc';
  scrollPosition?: number;
  onSortChange?: (sortOrder: string) => void;
  onPageData?: (data: { logs: LogHit[]; page: number; pages: number; append?: boolean }) => void;
  onLoadingChange?: (loading: boolean) => void;
  onScrollPositionChange?: (position: number) => void;
  onAddFilter?: (field: string, value: string, operator?: 'AND' | 'OR' | 'NOT') => void;
  onAnalysis?: () => void;
}

const LogsPanel = ({
  loading, logs, total, keyword, currentView, selectedFields, searchParams,
  sortOrder: externalSortOrder = 'desc', scrollPosition = 0,
  onSortChange, onPageData, onLoadingChange, onScrollPositionChange, onAddFilter, onAnalysis,
}: LogsPanelProps) => {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(externalSortOrder);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLoading, setPageLoading] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [jumpPage, setJumpPage] = useState('');
  const [contextLog, setContextLog] = useState<LogHit | null>(null);

  // 展示模式，读取用户上次偏好
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    try {
      return (localStorage.getItem(DISPLAY_MODE_KEY) as DisplayMode) || 'json';
    } catch {
      return 'json';
    }
  });

  // 滚动加载相关状态
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasReachedBottom, setHasReachedBottom] = useState(false);
  const [shouldResetScroll, setShouldResetScroll] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const scrollSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryIdRef = useRef<string>('');
  const isKeyScrolling = useRef(false);
  const keyScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 选中文本浮动按钮
  const [selectionPopup, setSelectionPopup] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.selection-add-btn')) return;
      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        if (!text || !contentRef.current?.contains(selection?.anchorNode ?? null)) {
          setSelectionPopup(null);
          return;
        }
        const range = selection!.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectionPopup({ x: rect.left + rect.width / 2, y: rect.top - 8, text });
      }, 10);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.selection-add-btn')) {
        setSelectionPopup(null);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // 键盘上下键滚动
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const startScroll = (dir: 1 | -1) => {
      isKeyScrolling.current = true;
      el.scrollBy({ top: dir * 80 });
      if (keyScrollTimer.current) return;
      keyScrollTimer.current = setTimeout(() => {
        keyScrollTimer.current = setInterval(() => {
          el.scrollBy({ top: dir * 80 });
        }, 50);
      }, 500) as unknown as ReturnType<typeof setInterval>;
    };

    const stopScroll = () => {
      if (keyScrollTimer.current) {
        clearTimeout(keyScrollTimer.current);
        clearInterval(keyScrollTimer.current);
        keyScrollTimer.current = null;
      }
      setTimeout(() => { isKeyScrolling.current = false; }, 50);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); startScroll(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); startScroll(-1); }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') stopScroll();
    };

    el.addEventListener('keydown', handleKeyDown);
    el.addEventListener('keyup', handleKeyUp);
    return () => {
      el.removeEventListener('keydown', handleKeyDown);
      el.removeEventListener('keyup', handleKeyUp);
      if (keyScrollTimer.current) clearInterval(keyScrollTimer.current);
    };
  }, []);

  const hasPermission = useAuthStore(s => s.hasPermission);
  const addMessage = useMessageStore(s => s.addMessage);
  const hasExportPermission = hasPermission('elfk:search:w');

  const logType = currentView?.log_type;
  const timeField = logType === 'sls' ? '__time__' : (currentView?.time_field || '@timestamp');
  const totalPages = searchParams?.pages as number || 1;
  const queryId = searchParams?.query_id as string || '';
  const hasMore = currentPage < totalPages;

  // 恢复滚动位置
  const scrollPositionRef = useRef(scrollPosition);
  scrollPositionRef.current = scrollPosition;

  useEffect(() => {
    if (!contentRef.current) return;
    if (shouldResetScroll) {
      contentRef.current.scrollTop = 0;
      setShouldResetScroll(false);
      return;
    }
    if (scrollPositionRef.current > 0) {
      contentRef.current.scrollTop = scrollPositionRef.current;
    }
  }, [logs, shouldResetScroll]);

  useEffect(() => {
    if (externalSortOrder) setSortOrder(externalSortOrder);
  }, [externalSortOrder]);

  useEffect(() => {
    if (searchParams?.page) {
      setCurrentPage(searchParams.page as number);
      if (searchParams.page === 1) setHasReachedBottom(false);
    }
    const currentQueryId = searchParams?.query_id as string || '';
    if (currentQueryId && currentQueryId !== lastQueryIdRef.current) {
      lastQueryIdRef.current = currentQueryId;
      setShouldResetScroll(true);
      autoFillInFlight.current = false; // 新搜索时重置自动填充守卫
    }
  }, [searchParams?.query_id, searchParams?.page]);

  // 切换展示模式并持久化
  const handleDisplayModeChange = (mode: DisplayMode) => {
    setDisplayMode(mode);
    try { localStorage.setItem(DISPLAY_MODE_KEY, mode); } catch { /* ignore */ }
  };

  // 时间格式化（供子组件使用）
  const formatTime = useCallback((value: unknown): string => {
    if (!value) return '-';
    try {
      let date: Date;
      const strValue = String(value);
      if (logType === 'sls' || (strValue.length === 10 && !isNaN(Number(strValue)))) {
        date = new Date(Number(strValue) * 1000);
      } else if (typeof value === 'number') {
        date = new Date(value);
      } else {
        date = new Date(value as string);
      }
      if (isNaN(date.getTime())) return String(value);
      return date.toLocaleString('zh-CN', { hour12: false });
    } catch { return String(value); }
  }, [logType]);

  // 关键字高亮（供子组件使用）
  const highlightText = useCallback((text: string): string => {
    if (!keyword || !text) return text;

    // 按 AND/OR/NOT 拆分，得到各个搜索词片段
    const parts = keyword.split(/\s+(?:and|or|not)\s+/i).filter(Boolean);
    // 处理开头的 NOT xxx（split 会丢掉它）
    const notMatch = keyword.match(/^NOT\s+(.+)/i);
    const allParts = notMatch ? [notMatch[1], ...parts] : parts;

    let result = text;
    allParts.forEach(kw => {
      // 只去掉首尾引号，不剥离 field: 前缀（md5:xxx 整体是搜索词）
      const cleanKw = kw.replace(/^['"]|['"]$/g, '').trim();
      if (!cleanKw || cleanKw === '*') return;
      // 转义正则特殊字符
      const escaped = cleanKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      result = result.replace(regex, '<mark class="highlight">$1</mark>');
    });
    return result;
  }, [keyword]);

  const handleSortToggle = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    onSortChange?.(newOrder);
  };

  const fetchPageData = useCallback(async (page: number, append: boolean) => {
    if (!queryId || pageLoading || isLoadingMore) return;
    if (append) setIsLoadingMore(true);
    else setPageLoading(true);
    onLoadingChange?.(true);

    try {
      const res = await searchLogsPage({
        query_id: queryId,
        page,
        project: searchParams?.project as string || '',
        index_pattern: searchParams?.index_pattern as string || '',
        time_field: searchParams?.time_field as string || '',
        start_time: searchParams?.start_time as string || '',
        end_time: searchParams?.end_time as string || '',
      } as any);

      if (res.code === 200 && res.data) {
        setCurrentPage(page);
        onPageData?.({ logs: res.data.hits || [], page, pages: res.data.pages || 1, append });
        if (append) setHasReachedBottom(false);
        else setShouldResetScroll(true);
      }
    } catch (err) {
      console.error('分页查询失败:', err);
    } finally {
      setPageLoading(false);
      setIsLoadingMore(false);
      onLoadingChange?.(false);
    }
  }, [queryId, searchParams, pageLoading, isLoadingMore, onPageData, onLoadingChange]);

  const fetchPageDataRef = useRef(fetchPageData);
  fetchPageDataRef.current = fetchPageData;

  // 自动填充防重入标志：避免 effect 因 isLoadingMore 等状态反复变化而多次发起请求
  const autoFillInFlight = useRef(false);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    fetchPageDataRef.current(page, false);
  };

  const loadMoreData = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    const nextPage = currentPage + 1;
    if (nextPage <= totalPages) fetchPageDataRef.current(nextPage, true);
  }, [currentPage, totalPages, hasMore, isLoadingMore]);

  // 数据加载完成后，检测内容是否未撑满容器，未撑满则自动加载下一页
  // 使用 ref 调用 + inFlight 守卫，避免因 isLoadingMore 等状态抖动导致重复请求
  useEffect(() => {
    if (!contentRef.current || !hasMore || isLoadingMore || loading || !queryId) return;
    if (autoFillInFlight.current) return;
    const el = contentRef.current;
    const raf = requestAnimationFrame(() => {
      if (el.scrollHeight <= el.clientHeight) {
        const nextPage = currentPage + 1;
        if (nextPage <= totalPages) {
          autoFillInFlight.current = true;
          fetchPageDataRef.current(nextPage, true);
          // 延迟释放守卫，确保 DOM 渲染完成后才允许下次自动填充
          setTimeout(() => { autoFillInFlight.current = false; }, 300);
        }
      }
    });
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, hasMore, isLoadingMore, loading, queryId, currentPage, totalPages]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    if (scrollTimerRef.current) cancelAnimationFrame(scrollTimerRef.current);
    scrollTimerRef.current = requestAnimationFrame(() => {
      const { scrollTop, scrollHeight, clientHeight } = target;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      const threshold = 100;

      if (distanceToBottom < threshold && !isLoadingMore && hasMore && queryId) {
        if (!hasReachedBottom) setHasReachedBottom(true);
        else { setHasReachedBottom(false); loadMoreData(); }
      } else if (distanceToBottom > threshold + 50 && hasReachedBottom) {
        setHasReachedBottom(false);
      }

      if (!isKeyScrolling.current) {
        if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current);
        scrollSaveTimer.current = setTimeout(() => {
          onScrollPositionChange?.(target.scrollTop);
        }, 300);
      }
    });
  }, [isLoadingMore, hasMore, queryId, hasReachedBottom, loadMoreData, onScrollPositionChange]);

  const handleJumpPage = () => {
    const page = parseInt(jumpPage);
    if (isNaN(page) || page < 1 || page > totalPages) {
      toast.warning(`请输入 1-${totalPages} 之间的页码`);
      return;
    }
    setJumpPage('');
    handlePageChange(page);
  };

  const handleExportSuccess = (filePath: string) => {
    toast.success('导出成功！', 3000);
    addMessage({
      type: 'success',
      title: '日志导出成功',
      content: `文件已保存到: ${filePath}`,
      extra: { filePath },
    });
  };

  const isLoading = loading || pageLoading;

  // 两种模式各自的公共 props
  const lineProps = { timeField, currentView, selectedFields, formatTime, highlightText };
  const jsonProps = { timeField, currentView, selectedFields, keyword, formatTime, highlightText, onContextClick: setContextLog };

  return (
    <div className="logs-panel">
      {/* 选中文本浮动按钮 */}
      {selectionPopup && (
        <div
          className="selection-add-btn"
          style={{ position: 'fixed', left: selectionPopup.x, top: selectionPopup.y, transform: 'translate(-50%, -100%)', zIndex: 9999, display: 'flex', gap: '4px' }}
          onMouseDown={e => e.preventDefault()}
        >
          {(['AND', 'OR', 'NOT'] as const).map(op => (
            <button key={op} className={`selection-op-btn selection-op-${op.toLowerCase()}`} onClick={() => {
              onAddFilter?.('', selectionPopup.text, op);
              setSelectionPopup(null);
              window.getSelection()?.removeAllRanges();
            }}>{op}</button>
          ))}
        </div>
      )}

      <div className="logs-header">
        <div className="header-left">
          <span className="title">查询结果</span>
          <span className="count">({total})</span>
        </div>
        <div className="header-actions">
          {/* 展示模式切换 */}
          <div className="display-mode-toggle">
            <button
              className={`btn-mode ${displayMode === 'line' ? 'active' : ''}`}
              onClick={() => handleDisplayModeChange('line')}
              title="行展示"
            >
              <AlignLeft size={14} /> 行
            </button>
            <button
              className={`btn-mode ${displayMode === 'json' ? 'active' : ''}`}
              onClick={() => handleDisplayModeChange('json')}
              title="JSON 展示"
            >
              <Braces size={14} /> JSON
            </button>
          </div>

          <button className="btn-sort" onClick={handleSortToggle}>
            {sortOrder === 'asc' ? <><ArrowUp size={14} /> 时间升序</> : <><ArrowDown size={14} /> 时间降序</>}
          </button>
          <button className="btn-analysis" onClick={onAnalysis} disabled={logs.length === 0}>
            <BarChart3 size={14} /> 数据分析
          </button>
          {hasExportPermission && (
            <button className="btn-export" onClick={() => setShowExportDialog(true)} disabled={logs.length === 0}>
              <Download size={14} /> 导出Excel
            </button>
          )}
        </div>
      </div>

      <div className="logs-content" ref={contentRef} tabIndex={0} onScroll={handleScroll}>
        {isLoading && logs.length === 0 ? (
          <div className="logs-loading">加载中...</div>
        ) : logs.length === 0 ? (
          <div className="logs-empty">暂无数据</div>
        ) : (
          <div className="logs-list">
            {logs.map((log, idx) =>
              displayMode === 'line' ? (
                <LogEntryLine key={log._id || idx} log={log} {...lineProps} />
              ) : (
                <LogEntryJson key={log._id || idx} log={log} {...jsonProps} />
              )
            )}

            {isLoadingMore && (
              <div className="loading-more">
                <Loader2 size={16} className="spin" />
                <span>加载中...</span>
              </div>
            )}

            {!hasMore && logs.length > 0 && (
              <div className="no-more-data">没有更多数据了</div>
            )}
          </div>
        )}
      </div>

      <div className="logs-pagination">
        <span className="page-info">共 {total} 条</span>
        <div className="page-btns">
          <button disabled={currentPage <= 1 || isLoading} onClick={() => handlePageChange(currentPage - 1)}>«</button>
          {(() => {
            const pages: (number | string)[] = [];
            const maxShow = 7;
            if (totalPages <= maxShow) {
              for (let i = 1; i <= totalPages; i++) pages.push(i);
            } else {
              pages.push(1);
              if (currentPage > 4) pages.push('...');
              const start = Math.max(2, currentPage - 2);
              const end = Math.min(totalPages - 1, currentPage + 2);
              for (let i = start; i <= end; i++) pages.push(i);
              if (currentPage < totalPages - 3) pages.push('...');
              pages.push(totalPages);
            }
            return pages.map((p, i) =>
              typeof p === 'number' ? (
                <button key={i} className={p === currentPage ? 'active' : ''} onClick={() => handlePageChange(p)} disabled={isLoading}>{p}</button>
              ) : (
                <span key={i} className="page-ellipsis">...</span>
              )
            );
          })()}
          <button disabled={currentPage >= totalPages || isLoading} onClick={() => handlePageChange(currentPage + 1)}>»</button>
          <div className="page-jump">
            <input
              type="text"
              value={jumpPage}
              onChange={e => setJumpPage(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handleJumpPage()}
              placeholder={String(currentPage)}
            />
            <span>/ {totalPages}</span>
          </div>
        </div>
      </div>

      <ExportDialog
        visible={showExportDialog}
        currentView={currentView}
        searchParams={searchParams}
        onClose={() => setShowExportDialog(false)}
        onSuccess={handleExportSuccess}
      />

      <ContextDrawer
        visible={!!contextLog}
        log={contextLog}
        currentView={currentView}
        searchParams={searchParams || {}}
        onClose={() => setContextLog(null)}
      />
    </div>
  );
};

export default LogsPanel;
