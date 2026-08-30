/**
 * 同步监控 — monitor SSE 状态
 * 网关 Redis 扇出后允许多客户端；StrictMode 双 mount 做防抖，开新连接前 abort 旧流。
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

const MAX_INCR = 360;
const MAX_LOG = 80;
const CONNECT_DEBOUNCE_MS = 150;

export function useSyncMonitor(project: string) {
  const [connState, setConnState] = useState<ConnState>('idle');
  const [incremental, setIncremental] = useState<SyncIncrementalPoint[]>([]);
  const [pipeline, setPipeline] = useState<SyncPipeline | null>(null);
  const [backfillProgress, setBackfillProgress] = useState<SyncBackfillProgress | null>(null);
  const [runtime, setRuntime] = useState<SyncRuntime | null>(null);
  const [logs, setLogs] = useState<LogItem[]>([]);

  const connRef = useRef<SyncSseConnection | null>(null);
  const logIdRef = useRef(0);
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
  }, []);

  const reconnect = useCallback(() => {
    setReconnectTick((t) => t + 1);
  }, []);

  useEffect(() => {
    projectRef.current = project;

    if (!project) {
      clearMonitorData();
      setConnState('idle');
      return;
    }

    let cancelled = false;
    let closedByUs = false;
    let conn: SyncSseConnection | null = null;

    setConnState('connecting');

    const connectTimer = setTimeout(() => {
      if (cancelled) return;

      clearMonitorData();

      conn = openSqlSyncMonitorSSE(project, {
        onOpen: () => {
          if (cancelled || projectRef.current !== project) return;
          setConnState('open');
        },
        onConnecting: () => {
          if (cancelled || projectRef.current !== project) return;
          setConnState('connecting');
        },
        onConnected: () => {
          if (cancelled || projectRef.current !== project) return;
          setConnState('open');
          appendLog('[监控] SSE 连接成功');
        },
        onHub: () => {
          if (cancelled || projectRef.current !== project) return;
          appendLog('[监控] 等待上游快照…');
        },
        onErrorEvent: (msg) => {
          if (cancelled || projectRef.current !== project) return;
          appendLog(`[监控] 错误: ${msg}`, true);
        },
        onClosed: () => {
          if (cancelled || projectRef.current !== project) return;
          if (closedByUs) return;
          setConnState('closed');
        },
        onHistory: (h) => loadHistory(h),
        onPipeline: (p) => setPipeline(p),
        onIncremental: (pt) => addIncr(pt),
        onBackfill: (b) => setBackfillProgress(b),
        onRuntime: (r) => setRuntime(r),
      });
      connRef.current = conn;
    }, CONNECT_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      closedByUs = true;
      clearTimeout(connectTimer);
      conn?.close();
      if (connRef.current === conn) connRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, reconnectTick]);

  return {
    connState,
    incremental,
    pipeline,
    backfillProgress,
    runtime,
    logs,
    appendLog,
    reconnect,
  };
}
