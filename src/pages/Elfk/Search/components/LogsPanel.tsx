/**
 * 日志列表面板 - JSON 格式展示
 */

import { useState } from 'react';
import { ArrowUp, ArrowDown, BarChart3, Download } from 'lucide-react';
import { useAuthStore } from '../../../../stores/authStore';
import { useMessageStore } from '../../../../stores/messageStore';
import { searchLogsPage } from '../../../../services/elfk/search';
import ExportDialog from './ExportDialog';
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
  onPageData?: (data: { logs: LogHit[]; page: number; pages: number }) => void;
  onLoadingChange?: (loading: boolean) => void;
  onAnalysis?: () => void;
}

// 字段类型颜色
const typeColors: Record<string, string> = {
  string: '#3a8ee6', number: '#529b2e', boolean: '#b88230',
  date: '#c45656', array: '#737579', object: '#8b5da7',
};

const LogsPanel = ({ loading, logs, total, keyword, currentView, selectedFields, searchParams, onSortChange, onPageData, onLoadingChange, onAnalysis }: LogsPanelProps) => {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLoading, setPageLoading] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const hasPermission = useAuthStore(s => s.hasPermission);
  const addMessage = useMessageStore(s => s.addMessage);
  const hasExportPermission = hasPermission('elfk:search:w');
  const timeField = currentView?.time_field || '@timestamp';
  const totalPages = searchParams?.pages as number || 1;
  const queryId = searchParams?.query_id as string || '';

  // 格式化时间
  const formatTime = (value: unknown) => {
    if (!value) return '-';
    try {
      let date: Date;
      if (typeof value === 'number') {
        date = value > 9999999999 ? new Date(value) : new Date(value * 1000);
      } else {
        date = new Date(value as string);
      }
      return date.toLocaleString('zh-CN', { hour12: false });
    } catch { return String(value); }
  };

  // 高亮关键词
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

  // 切换排序
  const handleSortToggle = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    onSortChange?.(newOrder);
  };

  // 分页
  const handlePageChange = async (page: number) => {
    if (!queryId || page < 1 || page > totalPages || pageLoading) return;
    setPageLoading(true);
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
        onPageData?.({ logs: res.data.hits || [], page, pages: res.data.pages || 1 });
      }
    } catch (err) {
      console.error('分页查询失败:', err);
    } finally {
      setPageLoading(false);
      onLoadingChange?.(false);
    }
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
      {/* 头部 */}
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

      {/* 日志内容 */}
      <div className="logs-content">
        {isLoading ? (
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
                        // 如果有选中字段，只显示选中的
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 分页 */}
      <div className="logs-pagination">
        <span className="page-info">共 {total} 条，第 {currentPage}/{totalPages} 页</span>
        <div className="page-btns">
          <button disabled={currentPage <= 1 || isLoading} onClick={() => handlePageChange(currentPage - 1)}>上一页</button>
          <button disabled={currentPage >= totalPages || isLoading} onClick={() => handlePageChange(currentPage + 1)}>下一页</button>
        </div>
      </div>

      {/* 导出弹框 */}
      <ExportDialog
        visible={showExportDialog}
        currentView={currentView}
        searchParams={searchParams}
        onClose={() => setShowExportDialog(false)}
        onSuccess={handleExportSuccess}
      />
    </div>
  );
};

export default LogsPanel;
