/**
 * 日志列表面板 - JSON 格式展示
 * 支持滚动自动加载和分页
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUp, ArrowDown, BarChart3, Download, Loader2, FileText } from 'lucide-react';
import { useAuthStore } from '../../../../stores/authStore';
import { useMessageStore } from '../../../../stores/messageStore';
import { searchLogsPage } from '../../../../services/elfk/search';
import ExportDialog from './ExportDialog';
import ContextDrawer from './ContextDrawer';
import toast from '../../../../components/Toast';
import type { LogHit } from '../../../../services/elfk/search';
import type { ViewDetail } from '../../../../services/elfk/view';

interface LogsPanelProps {
  loading: boolean;
  logs: LogHit[];
  total: number;
  keyword: string;
  currentView: ViewDetail | null;
  selectedFields: string[];
  searchParams?: Record<string, unknown>;
  onSortChange?: (sortOrder: string) => void;
  onPageData?: (data: { logs: LogHit[]; page: number; pages: number; append?: boolean }) => void;
  onLoadingChange?: (loading: boolean) => void;
  onAnalysis?: () => void;
}

const typeColors: Record<string, string> = {
  string: '#3a8ee6', number: '#529b2e', boolean: '#b88230',
  date: '#c45656', array: '#737579', object: '#8b5da7',
};

const LogsPanel = ({ loading, logs, total, keyword, currentView, selectedFields, searchParams, onSortChange, onPageData, onLoadingChange, onAnalysis }: LogsPanelProps) => {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLoading, setPageLoading] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [jumpPage, setJumpPage] = useState('');
  const [contextLog, setContextLog] = useState<LogHit | null>(null);
  
  // 滚动加载相关状态
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasReachedBottom, setHasReachedBottom] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<number | null>(null);

  const hasPermission = useAuthStore(s => s.hasPermission);
  const addMessage = useMessageStore(s => s.addMessage);
  const hasExportPermission = hasPermission('elfk:search:w');
  // SLS 类型固定使用 __time__ 字段，ELFK 使用视图配置的时间字段
  const logType = currentView?.log_type;
  const timeField = logType === 'sls' ? '__time__' : (currentView?.time_field || '@timestamp');
  const totalPages = searchParams?.pages as number || 1;
  const queryId = searchParams?.query_id as string || '';
  const hasMore = currentPage < totalPages;

  // 监听 searchParams 变化，重置分页状态
  useEffect(() => {
    if (searchParams?.page) {
      setCurrentPage(searchParams.page as number);
      if (searchParams.page === 1) {
        setHasReachedBottom(false);
      }
    }
  }, [searchParams?.query_id, searchParams?.page]);

  const formatTime = (value: unknown) => {
    if (!value) return '-';
    try {
      let date: Date;
      const strValue = String(value);
      
      // SLS 时间戳是秒级（10位数字），需要 * 1000
      if (logType === 'sls' || (strValue.length === 10 && !isNaN(Number(strValue)))) {
        date = new Date(Number(strValue) * 1000);
      } else if (typeof value === 'number') {
        // 毫秒级时间戳
        date = new Date(value);
      } else {
        // ISO8601 或其他字符串格式
        date = new Date(value as string);
      }
      
      if (isNaN(date.getTime())) return String(value);
      return date.toLocaleString('zh-CN', { hour12: false });
    } catch { return String(value); }
  };

  const highlightText = (text: string) => {
    if (!keyword || !text) return text;
    const keywords = keyword.split(/\s+(?:and|or|not)\s+/i).filter(Boolean);
    let result = text;
    keywords.forEach(kw => {
      const cleanKw = kw.replace(/^["']|["']$/g, '').replace(/^\w+:/, '');
      if (cleanKw) {
        const regex = new RegExp(`(${cleanKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        result = result.replace(regex, '<mark class="highlight">$1</mark>');
      }
    });
    return result;
  };

  const getFieldType = (value: unknown): string => {
    if (value === null || value === undefined) return 'string';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const processLog = (log: LogHit): Record<string, unknown> => {
    return log._source ? { ...log._source, _id: log._id, _index: log._index } : { ...log } as Record<string, unknown>;
  };

  const handleSortToggle = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    onSortChange?.(newOrder);
  };

  // 获取分页数据
  const fetchPageData = useCallback(async (page: number, append: boolean) => {
    if (!queryId || pageLoading || isLoadingMore) return;
    
    if (append) {
      setIsLoadingMore(true);
    } else {
      setPageLoading(true);
    }
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
        onPageData?.({ 
          logs: res.data.hits || [], 
          page, 
          pages: res.data.pages || 1,
          append 
        });
        
        if (append) {
          setHasReachedBottom(false);
        } else if (contentRef.current) {
          contentRef.current.scrollTop = 0;
        }
      }
    } catch (err) {
      console.error('分页查询失败:', err);
    } finally {
      setPageLoading(false);
      setIsLoadingMore(false);
      onLoadingChange?.(false);
    }
  }, [queryId, searchParams, pageLoading, isLoadingMore, onPageData, onLoadingChange]);

  // 点击分页按钮（清空替换）
  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    fetchPageData(page, false);
  };

  // 滚动加载更多（追加）
  const loadMoreData = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    const nextPage = currentPage + 1;
    if (nextPage <= totalPages) {
      fetchPageData(nextPage, true);
    }
  }, [currentPage, totalPages, hasMore, isLoadingMore, fetchPageData]);

  // 处理滚动事件
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    
    if (scrollTimerRef.current) {
      cancelAnimationFrame(scrollTimerRef.current);
    }

    scrollTimerRef.current = requestAnimationFrame(() => {
      const { scrollTop, scrollHeight, clientHeight } = target;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      const threshold = 100;

      if (distanceToBottom < threshold && !isLoadingMore && hasMore && queryId) {
        if (!hasReachedBottom) {
          // 第一次到达底部，标记
          setHasReachedBottom(true);
        } else {
          // 第二次滚动，触发加载
          setHasReachedBottom(false);
          loadMoreData();
        }
      } else if (distanceToBottom > threshold + 50) {
        // 离开底部区域，重置标记
        if (hasReachedBottom) {
          setHasReachedBottom(false);
        }
      }
    });
  }, [isLoadingMore, hasMore, queryId, hasReachedBottom, loadMoreData]);

  // 跳页
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
      extra: { filePath }
    });
  };

  const isLoading = loading || pageLoading;

  return (
    <div className="logs-panel">
      <div className="logs-header">
        <div className="header-left">
          <span className="title">查询结果</span>
          <span className="count">({total})</span>
        </div>
        <div className="header-actions">
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

      <div className="logs-content" ref={contentRef} onScroll={handleScroll}>
        {isLoading && logs.length === 0 ? (
          <div className="logs-loading">加载中...</div>
        ) : logs.length === 0 ? (
          <div className="logs-empty">暂无数据</div>
        ) : (
          <div className="logs-list">
            {logs.map((log, idx) => {
              const data = processLog(log);
              const time = formatTime(data[timeField]);
              return (
                <div key={log._id || idx} className="log-entry">
                  <div className="log-time">{time}</div>
                  <div className="log-body">
                    {currentView?.log_type === 'sls' && data['__tag__:__path__'] ? (
                      <div className="field-pair tag-path">
                        <span className="field-name">__tag__:__path__:</span>
                        <span className="field-value">{String(data['__tag__:__path__'])}</span>
                      </div>
                    ) : log._index ? (
                      <div className="field-pair tag-path">
                        <span className="field-name">_index:</span>
                        <span className="field-value">{log._index}</span>
                      </div>
                    ) : null}
                    {Object.entries(data)
                      .filter(([key]) => {
                        if (key === timeField || key.startsWith('_') || key === '__tag__:__path__') return false;
                        if (selectedFields.length > 0) return selectedFields.includes(key);
                        return true;
                      })
                      .map(([key, value]) => {
                        const type = getFieldType(value);
                        const color = typeColors[type] || typeColors.string;
                        return (
                          <div key={key} className="field-pair">
                            <span className="field-name" style={{ color }}>{key}:</span>
                            <span className="field-value" dangerouslySetInnerHTML={{ __html: highlightText(formatValue(value)) }} />
                          </div>
                        );
                      })}
                  </div>
                  <div className="log-actions">
                    <button className="btn-context" onClick={() => setContextLog(log)}>
                      <FileText size={12} /> 上下文
                    </button>
                  </div>
                </div>
              );
            })}
            
            {/* 加载更多提示 */}
            {isLoadingMore && (
              <div className="loading-more">
                <Loader2 size={16} className="spin" />
                <span>加载中...</span>
              </div>
            )}
            
            {/* 没有更多数据 */}
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
