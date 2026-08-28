/**
 * 同步监控 — monitor SSE 状态
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  openSqlSyncMonitorSSE,
  type SyncBackfillProgress,
  type SyncHistory,
  type SyncIncrementalPoint,
  type SyncPipeline,
  type SyncRuntime,
  type SyncSseConnection,
} from '@/services/sql/sync';

export type ConnState = 'idle' | 'connecting' | 'open' | 'closed';

export interface LogItem {
  id: number;
  ts: string;
  msg: string;
  err?: boolean;
}

const MAX_INCR = 360; // 后端内存约 1 小时：10s/条 × 360
const MAX_LOG = 80;

export function useSyncMonitor(project: string) {
  const [connState, setConnState] = useState<ConnState>('idle');
  const [incremental, setIncremental] = useState<SyncIncrementalPoint[]>([]);
  const [pipeline, setPipeline] = useState<SyncPipeline | null>(null);
  const [backfillProgress, setBackfillProgress] = useState<SyncBackfillProgress | null>(null);
  const [runtime, setRuntime] = useState<SyncRuntime | null>(null);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [pipeFlash, setPipeFlash] = useState(false);

  const connRef = useRef<SyncSseConnection | null>(null);
  const logIdRef = useRef(0);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectRef = useRef(project);
  const [reconnectTick, setReconnectTick] = useState(0);

  const appendLog = useCallback((msg: string, err?: boolean) => {
    const id = ++logIdRef.current;
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [{ id, ts, msg, err }, ...prev].slice(0, MAX_LOG));
  }, []);

  const clearMonitorData = useCallback(() => {
    setIncremental([]);
    setPipeline(null);
    setBackfillProgress(null);
    setRuntime(null);
    setPipeFlash(false);
    setLogs([]);
  }, []);

  const loadHistory = useCallback((h: SyncHistory) => {
    if (h.incremental) {
      setIncremental(h.incremental.slice(-MAX_INCR));
    }
    if (h.backfill && h.backfill.length) {
      setBackfillProgress(h.backfill[h.backfill.length - 1]);
    }
  }, []);

  const addIncr = useCallback((pt: SyncIncrementalPoint) => {
    setIncremental((prev) => {
      const next = [...prev, pt];
      return next.length > MAX_INCR ? next.slice(-MAX_INCR) : next;
    });
    setPipeFlash(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setPipeFlash(false), 800);
  }, []);

  /** 手动重连：自增 tick 触发重建 SSE */
  const reconnect = useCallback(() => {
    setReconnectTick((t) => t + 1);
  }, []);

  useEffect(() => {
    projectRef.current = project;

    if (connRef.current) {
      connRef.current.close();
      connRef.current = null;
    }

    if (!project) {
      clearMonitorData();
      setConnState('idle');
      return;
    }

    clearMonitorData();
    setConnState('connecting');
    appendLog(`[SSE] 连接 monitor project=${project}`);

    const conn = openSqlSyncMonitorSSE(project, {
      onOpen: () => {
        if (projectRef.current !== project) return;
        setConnState('open');
        appendLog('[SSE] 已连接');
      },
      onConnecting: () => {
        if (projectRef.current !== project) return;
        setConnState('connecting');
      },
      onClosed: () => {
        if (projectRef.current !== project) return;
        setConnState('closed');
        appendLog('[SSE] 断开', true);
      },
      // 以下事件仅更新界面状态，不再逐条写入操作日志
      onHistory: (h) => loadHistory(h),
      onPipeline: (p) => setPipeline(p),
      onIncremental: (pt) => addIncr(pt),
      onBackfill: (b) => setBackfillProgress(b),
      onRuntime: (r) => setRuntime(r),
      onRaw: () => {
        /* 未识别事件不记录 */
      },
      onDebug: () => {
        /* 底层调试仅保留在控制台，不写入操作日志 */
      },
    });
    connRef.current = conn;

    return () => {
      conn.close();
      if (connRef.current === conn) connRef.current = null;
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, reconnectTick]);

  // 组件卸载兜底：离开/切换页面时，不管连接由哪条路径建立，都必然断开同步 SSE
  useEffect(() => {
    return () => {
      connRef.current?.close();
      connRef.current = null;
    };
  }, []);

  return {
    connState,
    incremental,
    pipeline,
    backfillProgress,
    runtime,
    logs,
    pipeFlash,
    appendLog,
    reconnect,
  };
}
