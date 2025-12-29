/**
 * 日志上下文抽屉组件
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Crosshair, Loader2 } from 'lucide-react';
import { getLogsContext } from '../../../../services/elfk/search';
import type { LogHit } from '../../../../services/elfk/search';
import type { ViewDetail } from '../../../../services/elfk/view';
import toast from '../../../../components/Toast';

interface ContextLog extends LogHit {
  _isBefore?: boolean;
  _isCenter?: boolean;
  _relativeIndex?: number;
}

interface Props {
  visible: boolean;
  log: LogHit | null;
  currentView: ViewDetail | null;
  searchParams: Record<string, unknown>;
  onClose: () => void;
}

const ContextDrawer = ({ visible, log, currentView, searchParams, onClose }: Props) => {
  const [loading, setLoading] = useState(false);
  const [contextLogs, setContextLogs] = useState<ContextLog[]>([]);
  const [contextLines, setContextLines] = useState(20);
  const [highlightKeyword, setHighlightKeyword] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const timeField = currentView?.time_field || '@timestamp';

  // 加载上下文
  const loadContext = useCallback(async () => {
    if (!log || !visible) return;
    
    setLoading(true);
    setContextLogs([]);

    try {
      const logType = searchParams?.log_type as string || 'elfk';
      const source = log._source || log;
      
      let params: Record<string, unknown> = { log_type: logType, project: searchParams?.project };

      if (logType === 'sls') {
        const packId = (source as Record<string, unknown>)['__tag__:__pack_id__'];
        const packMeta = (source as Record<string, unknown>)['__pack_meta__'];
        if (!packId || !packMeta) {
          toast.error('无法获取SLS日志包信息');
          setLoading(false);
          return;
        }
        params = { ...params, logstore: searchParams?.logstore, pack_id: packId, pack_meta: packMeta, back_lines: contextLines, forward_lines: contextLines, index_pattern: searchParams?.index_pattern || '' };
      } else {
        if (!log._id || !log._index) {
          toast.error('无法获取文档信息');
          setLoading(false);
          return;
        }
        params = { ...params, doc_id: log._id, index: log._index, before: contextLines, after: contextLines, sort_field: timeField, _source: true };
      }

      const res = await getLogsContext(params as any);
      
      if (res.code === 200 && res.data) {
        const { before = [], center, after = [] } = res.data;
        
        const beforeLogs: ContextLog[] = before.map((l, i) => ({
          ...l, _source: l._source || l, _isBefore: true, _isCenter: false, _relativeIndex: before.length - i
        }));
        
        const centerLog: ContextLog | null = center ? {
          ...center, _source: center._source || center, _isCenter: true, _isBefore: false, _relativeIndex: 0
        } : null;
        
        const afterLogs: ContextLog[] = after.map((l, i) => ({
          ...l, _source: l._source || l, _isBefore: false, _isCenter: false, _relativeIndex: i + 1
        }));

        setContextLogs([...beforeLogs, ...(centerLog ? [centerLog] : []), ...afterLogs]);
        
        // 滚动到目标
        setTimeout(() => scrollToTarget(), 100);
      } else {
        toast.error(res.message || '获取上下文失败');
      }
    } catch (err) {
      console.error('获取上下文失败:', err);
      toast.error('获取上下文失败');
    } finally {
      setLoading(false);
    }
  }, [log, visible, searchParams, contextLines, timeField]);

  useEffect(() => {
    if (visible && log) loadContext();
  }, [visible, log, loadContext]);

  const scrollToTarget = () => {
    if (targetRef.current && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const targetRect = targetRef.current.getBoundingClientRect();
      const scrollTop = targetRect.top - containerRect.top + containerRef.current.scrollTop - 100;
      containerRef.current.scrollTo({ top: scrollTop, behavior: 'smooth' });
    }
  };

  const formatTime = (value: unknown) => {
    if (!value) return '-';
    try {
      const date = typeof value === 'number' 
        ? (value > 9999999999 ? new Date(value) : new Date(value * 1000))
        : new Date(value as string);
      return date.toLocaleString('zh-CN', { hour12: false });
    } catch { return String(value); }
  };

  const highlight = (text: string) => {
    if (!highlightKeyword || !text) return text;
    const regex = new RegExp(`(${highlightKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="ctx-highlight">$1</mark>');
  };

  const filteredLogs = filterKeyword 
    ? contextLogs.filter(l => {
        const src = l._source || l;
        return Object.values(src as Record<string, unknown>).some(v => 
          String(v).toLowerCase().includes(filterKeyword.toLowerCase())
        );
      })
    : contextLogs;

  if (!visible) return null;

  return (
    <>
      <div className="ctx-overlay" onClick={onClose} />
      <div className="ctx-drawer">
        <div className="ctx-header">
          <h3>日志上下文</h3>
          <button className="ctx-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="ctx-toolbar">
          <div className="ctx-field">
            <label>上下文行数</label>
            <input type="number" min={1} max={200} value={contextLines} onChange={e => setContextLines(Number(e.target.value))} onBlur={loadContext} />
          </div>
          <div className="ctx-field">
            <label>高亮关键词</label>
            <input type="text" value={highlightKeyword} onChange={e => setHighlightKeyword(e.target.value)} placeholder="输入关键词" />
          </div>
          <div className="ctx-field">
            <label>过滤关键词</label>
            <input type="text" value={filterKeyword} onChange={e => setFilterKeyword(e.target.value)} placeholder="输入过滤词" />
          </div>
          <button className="ctx-btn" onClick={scrollToTarget}><Crosshair size={14} /> 定位目标</button>
        </div>

        <div className="ctx-content" ref={containerRef}>
          {loading ? (
            <div className="ctx-loading"><Loader2 size={24} className="spin" /> 加载中...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="ctx-empty">未找到上下文数据</div>
          ) : (
            filteredLogs.map((l, idx) => {
              const src = (l._source || l) as Record<string, unknown>;
              const time = formatTime(src[timeField]);
              const isCenter = l._isCenter;
              const isBefore = l._isBefore;
              
              return (
                <div 
                  key={l._id || idx} 
                  ref={isCenter ? targetRef : undefined}
                  className={`ctx-log ${isCenter ? 'center' : isBefore ? 'before' : 'after'}`}
                >
                  <span className={`ctx-tag ${isCenter ? 'tag-center' : isBefore ? 'tag-before' : 'tag-after'}`}>
                    {isCenter ? '目标' : (isBefore ? `-${l._relativeIndex}` : `+${l._relativeIndex}`)}
                  </span>
                  <div className="ctx-time">{time}</div>
                  <div className="ctx-body">
                    {Object.entries(src)
                      .filter(([k]) => k !== timeField && !k.startsWith('_'))
                      .map(([k, v]) => (
                        <span key={k} className="ctx-pair">
                          <span className="ctx-key">{k}:</span>
                          <span className="ctx-val" dangerouslySetInnerHTML={{ __html: highlight(String(v ?? '-')) }} />
                        </span>
                      ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

export default ContextDrawer;
