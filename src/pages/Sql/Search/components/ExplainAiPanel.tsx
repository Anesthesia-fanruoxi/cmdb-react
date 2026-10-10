/**
 * EXPLAIN AI 分析面板（内嵌结果栏）
 * 对 EXPLAIN 语句发起 SSE 流式分析，阶段提示 + Markdown 报告增量渲染
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import MarkdownView from '@/components/Markdown';
import {
  analyzeExplainAi,
  type ExplainAiConnection,
  type ExplainAiDoneEvent,
} from '@/services/sql/explainAi';

interface Props {
  agent: string;
  dbName: string;
  sql: string;
  onClose: () => void;
}

type AiStatus = 'running' | 'done' | 'error' | 'stopped';

const STATUS_BADGE: Record<AiStatus, { cls: string; text: string }> = {
  running: { cls: 'running', text: '分析中' },
  done: { cls: 'done', text: '已完成' },
  error: { cls: 'error', text: '失败' },
  stopped: { cls: 'error', text: '已停止' },
};

/** 报告增量刷新的节流间隔（ms） */
const FLUSH_INTERVAL = 80;

const ExplainAiPanel = ({ agent, dbName, sql, onClose }: Props) => {
  const [status, setStatus] = useState<AiStatus>('running');
  const [stageMessage, setStageMessage] = useState('正在连接...');
  const [report, setReport] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [doneInfo, setDoneInfo] = useState<ExplainAiDoneEvent | null>(null);
  const [runSeq, setRunSeq] = useState(0);

  const connRef = useRef<ExplainAiConnection | null>(null);
  const reportBufferRef = useRef('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // 立即把缓冲区内容刷到界面
  const flushReport = useCallback(() => {
    if (flushTimerRef.current != null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    setReport(reportBufferRef.current);
  }, []);

  // 增量片段写入缓冲区，按间隔节流刷新，避免高频全量重渲染 Markdown
  const pushDelta = useCallback((content: string) => {
    reportBufferRef.current += content;
    if (flushTimerRef.current != null) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      setReport(reportBufferRef.current);
    }, FLUSH_INTERVAL);
  }, []);

  const stopConnection = useCallback(() => {
    connRef.current?.close();
    connRef.current = null;
    if (flushTimerRef.current != null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  // 挂载即开始分析（重试时递增 runSeq 触发）
  useEffect(() => {
    stopConnection();
    reportBufferRef.current = '';
    setStatus('running');
    setStageMessage('正在连接...');
    setReport('');
    setErrorMsg('');
    setDoneInfo(null);

    connRef.current = analyzeExplainAi(
      { agent, dbName, query: sql },
      {
        onConnected: (message) => setStageMessage(message),
        onStage: ({ message }) => {
          setStageMessage(message);
        },
        onDelta: pushDelta,
        onDone: (event) => {
          connRef.current = null;
          setStageMessage('');
          setDoneInfo(event);
          setStatus('done');
          flushReport();
        },
        onError: (message) => {
          connRef.current = null;
          setErrorMsg(message);
          setStatus('error');
          flushReport();
        },
        onHttpError: (_status, message) => {
          connRef.current = null;
          setErrorMsg(message);
          setStatus('error');
        },
        onTransportError: (message) => {
          connRef.current = null;
          setErrorMsg(`网络异常：${message}`);
          setStatus('error');
        },
        onClosed: () => {
          connRef.current = null;
          setErrorMsg('连接中断，分析未完成，请重试');
          setStatus('error');
          flushReport();
        },
      },
    );

    return stopConnection;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runSeq]);

  // 运行中自动滚动到报告底部
  useEffect(() => {
    if (status !== 'running') return;
    const el = reportRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [report, status]);

  // 手动停止：保留已生成的部分报告
  const handleStop = () => {
    stopConnection();
    setStatus('stopped');
    setStageMessage('');
    flushReport();
  };

  const handleRetry = () => setRunSeq((s) => s + 1);

  const badge = STATUS_BADGE[status];
  const showStageHint = status === 'running' && Boolean(stageMessage);
  const showError = status === 'error' || status === 'stopped';

  return (
    <div className="sql-search-ai-panel">
      {/* 面板操作行 */}
      <div className="sql-search-ai-panel-bar">
        <div className="sql-search-ai-panel-status">
          <span className={`sql-search-ai-badge ${badge.cls}`}>{badge.text}</span>
          {status === 'done' && doneInfo && (
            <span className="sql-search-ai-meta">
              {doneInfo.took != null && <span>耗时：{(doneInfo.took / 1000).toFixed(1)}s</span>}
              {doneInfo.model && <span>模型：{doneInfo.model}</span>}
              {doneInfo.tables && doneInfo.tables.length > 0 && <span>关联表：{doneInfo.tables.join(', ')}</span>}
            </span>
          )}
          {showStageHint && (
            <span className="sql-search-ai-stage-hint">
              <Loader2 size={14} className="spin" />
              <span>{stageMessage}</span>
            </span>
          )}
        </div>
        <div className="sql-search-ai-panel-actions">
          {status === 'running' && (
            <button type="button" className="btn btn-link" onClick={handleStop}>⏹ 停止</button>
          )}
          {status === 'error' && (
            <button type="button" className="btn btn-link" onClick={handleRetry}>↻ 重试</button>
          )}
          <button type="button" className="btn btn-link" onClick={onClose}>← 返回结果</button>
        </div>
      </div>

      {/* 分析的 SQL */}
      <div className="sql-search-ai-sql" title={sql}>{sql}</div>

      {/* 错误 / 提示条 */}
      {showError && <div className="sql-search-ai-error">{errorMsg}</div>}

      {/* 报告区 */}
      <div className="sql-search-ai-report" ref={reportRef}>
        {report ? (
          <MarkdownView content={report} />
        ) : (
          <div className="sql-search-ai-empty">
            {status === 'running' ? stageMessage || '正在连接...' : '暂无内容'}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExplainAiPanel;
