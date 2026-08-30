/**
 * SQL Sync（es-adb 同步监控）API
 * 所有业务请求需携带 project，由网关转发至对应 agent
 *
 * SSE（monitor / backfill / analyze 进度 / analyze 详情）经 Redis 中转，协议统一：
 * connected → heartbeat/hub（可忽略）→ 业务事件；data 明文 JSON，勿解密。
 */

import { apiClient, CLIENT_AGENT } from '../request';
import { getToken } from '../storage';
import { isTauriEnv } from '../machine';

/** 是否视为成功（兼容网关 200 与 agent 原样 0） */
export function isSyncOk(code: number | undefined): boolean {
  return code === 200 || code === 0;
}

export interface SyncProject {
  label: string;
  value: string;
  project: string;
  project_name: string;
}

export interface SyncWindow {
  start?: string;
  end?: string;
}

export interface SyncIncrementalPoint {
  atStr?: string;
  window?: SyncWindow;
  hits?: number;
  written?: number;
  durationMs?: number;
  success?: boolean;
}

export interface SyncBackfillProgress {
  percent?: number;
  completed?: number;
  failed?: number;
  totalWindows?: number;
  totalHits?: number;
  totalWritten?: number;
  rangeStart?: string;
  rangeEnd?: string;
}

export interface SyncPipeline {
  intervalSec?: number;
  lagSec?: number;
  esReady?: boolean;
  mysqlReady?: boolean;
  incrementalRunning?: boolean;
  backfillActive?: boolean;
  lastIncremental?: SyncIncrementalPoint;
  targetWindow?: SyncWindow;
  backfillProgress?: SyncBackfillProgress;
}

export interface SyncRuntime {
  uptimeSec?: number;
  goroutines?: number;
  goMaxProcs?: number;
  numCPU?: number;
  allocMB?: number;
  heapSysMB?: number;
  sysMB?: number;
  totalAllocMB?: number;
  numGC?: number;
  pauseTotalSec?: number;
  goVersion?: string;
}

export interface SyncHistory {
  incremental?: SyncIncrementalPoint[];
  backfill?: SyncBackfillProgress[];
  /** Redis 快照可能顺带带上当前态 */
  pipeline?: SyncPipeline;
  runtime?: SyncRuntime;
  backfillProgress?: SyncBackfillProgress;
}

export interface SyncBackfillSession {
  startedAtStr?: string;
  finishedAtStr?: string;
  startedAtMs?: number;
  finishedAtMs?: number;
}

export interface SyncQpsPoint {
  writeQps?: number;
  hitQps?: number;
  windowQps?: number;
}

export interface SyncRuntimeSeriesPoint {
  heapAllocMB?: number;
  heapSysMB?: number;
  sysMB?: number;
  numGoroutine?: number;
  numGC?: number;
}

export interface SyncBackfillDetail {
  progress?: SyncBackfillProgress;
  session?: SyncBackfillSession;
  backfillActive?: boolean;
  qpsSeries?: SyncQpsPoint[];
  runtimeSeries?: SyncRuntimeSeriesPoint[];
}

export interface SyncCompareResult {
  es: { count: number; field?: string };
  mysql: { count: number; field?: string };
  diff: number;
  range: { start: string; end: string };
  match?: boolean;
}

export interface SyncBackfillSummary {
  totalWindows?: number;
  totalHits?: number;
  totalWritten?: number;
  failed?: number;
}

export interface SyncMonitorHandlers {
  onOpen?: () => void;
  onConnecting?: () => void;
  onClosed?: () => void;
  /** Redis 中转：SSE 连接成功 */
  onConnected?: (data: unknown) => void;
  /** 等待上游快照，属正常 */
  onHub?: (data: unknown) => void;
  onHistory?: (data: SyncHistory) => void;
  onPipeline?: (data: SyncPipeline) => void;
  onIncremental?: (data: SyncIncrementalPoint) => void;
  onBackfill?: (data: SyncBackfillProgress) => void;
  onBackfillWindow?: (data: unknown) => void;
  onRuntime?: (data: SyncRuntime) => void;
  onErrorEvent?: (message: string) => void;
  onRaw?: (eventName: string, data: unknown) => void;
  onDebug?: (msg: string, err?: boolean) => void;
}

export interface SyncSseConnection {
  close: () => void;
}

function parseProjectItems(data: unknown): SyncProject[] {
  let items: unknown[] = [];
  if (Array.isArray(data)) {
    items = data;
  } else if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.items)) items = d.items;
    else if (Array.isArray(d.list)) items = d.list;
    else if (Array.isArray(d.projects)) items = d.projects;
  }

  return items.map((item) => {
    if (typeof item === 'string') {
      return { label: item, value: item, project: item, project_name: item };
    }
    const o = (item || {}) as Record<string, unknown>;
    const project = String(o.project ?? o.value ?? o.key ?? o.name ?? '');
    const project_name = String(o.project_name ?? o.label ?? o.name ?? o.value ?? o.project ?? project);
    return { label: project_name, value: project, project, project_name };
  }).filter((p) => p.value);
}

export function camelizeKeys<T = unknown>(input: unknown): T {
  if (Array.isArray(input)) {
    return input.map((v) => camelizeKeys(v)) as T;
  }
  if (input && typeof input === 'object' && input.constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      const ck = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      out[ck] = camelizeKeys(v);
    }
    return out as T;
  }
  return input as T;
}

export function getSqlSyncProjects() {
  return apiClient.get<unknown>('/sql/sync/projects').then((res) => {
    if (!isSyncOk(res.code)) return { ...res, data: [] as SyncProject[] };
    return { ...res, data: parseProjectItems(res.data) };
  });
}

export function getSqlSyncHealth(project: string) {
  return apiClient.get<unknown>('/sql/sync/health', { project });
}

export function triggerSqlSyncBackfill(
  project: string,
  body: { start: string; end?: string },
) {
  return apiClient.post<{ summary: SyncBackfillSummary }>(
    `/sql/sync/backfill?project=${encodeURIComponent(project)}`,
    body,
    { timeout: 600000 },
  );
}

/** 窗口补全：按异常窗列表回填（可不连续）；带 analysisId 才会更新分析缓存并推详情 update */
export function triggerSqlSyncBackfillWindows(
  project: string,
  windows: SyncBackfillWindowMs[],
  analysisId?: string,
) {
  const body: { windows: SyncBackfillWindowMs[]; analysisId?: string } = { windows };
  if (analysisId) body.analysisId = analysisId;
  return apiClient.post<SyncBackfillWindowsResult>(
    `/sql/sync/backfill/windows?project=${encodeURIComponent(project)}`,
    body,
    { timeout: 600000 },
  );
}

/** 轮询分析详情（可选，优先走详情 SSE） */
export function getSqlSyncAnalyzeDetail(project: string, analysisId: string) {
  return apiClient.get<SyncAnalyzeDetailPayload>(
    `/sql/sync/analyze?project=${encodeURIComponent(project)}&analysisId=${encodeURIComponent(analysisId)}`,
  );
}

export function compareSqlSync(
  project: string,
  body: { start?: string; end?: string },
) {
  return apiClient.post<SyncCompareResult>(
    `/sql/sync/compare?project=${encodeURIComponent(project)}`,
    body,
  );
}

/** 四级下钻进度：((level-1) + done/total) / 4 * 100% */
export function calcDrilldownPercent(level: number, done: number, total: number): number {
  const lv = Math.min(4, Math.max(1, level || 1));
  const t = Math.max(total || 0, 1);
  const d = Math.min(Math.max(done || 0, 0), t);
  return (((lv - 1) + d / t) / 4) * 100;
}

export function drilldownWindowsToBackfill(
  windows: SyncDrilldownWindow[],
): SyncBackfillWindowMs[] {
  return windows
    .filter((w) => typeof w.s === 'number' && typeof w.e === 'number' && w.e > w.s)
    .map((w) => ({ startMs: w.s, endMs: w.e }));
}

/**
 * 点选任意层级时，展开为末级（优先 10 秒）异常窗再提交补全：
 * - L1 日 → 当天全部 L4
 * - L2 小时 → 该小时全部 L4
 * - L3 5 分 → 该块全部 L4
 * - L4 单窗 → 仅自身
 */
export function expandDrilldownToLeafWindows(
  all: SyncDrilldownWindow[],
  anchor: SyncDrilldownWindow,
): SyncDrilldownWindow[] {
  const lv = anchor.level || 1;
  if (lv >= 4) return [anchor];

  const leaves = all
    .filter((w) => (w.level || 1) === 4 && w.s >= anchor.s && w.e <= anchor.e)
    .sort((a, b) => a.s - b.s);
  if (leaves.length) return leaves;

  // 若尚无 L4，退到可见的最深层级
  for (let depth = 3; depth > lv; depth--) {
    const mid = all
      .filter((w) => (w.level || 1) === depth && w.s >= anchor.s && w.e <= anchor.e)
      .sort((a, b) => a.s - b.s);
    if (mid.length) return mid;
  }
  return [anchor];
}

export interface SyncBackfillWindowMs {
  startMs: number;
  endMs: number;
}

export interface SyncBackfillWindowsResult {
  windows?: number;
  summary?: SyncBackfillSummary & { workers?: number };
}

export interface SyncDrilldownRange {
  startMs?: number;
  endMs?: number;
  start?: string;
  end?: string;
}

export interface SyncDrilldownProgress {
  level?: number;
  done?: number;
  total?: number;
}

export interface SyncDrilldownWindow {
  level?: number;
  s: number;
  e: number;
  start?: string;
  end?: string;
  diff?: number;
}

/** @deprecated ready 已取代 done；保留兼容字段 */
export interface SyncDrilldownDone {
  abnormal?: number;
  windows?: SyncDrilldownWindow[];
  analysisId?: string;
  status?: string;
}

export interface SyncAnalyzeReady {
  analysisId: string;
  abnormal?: number;
  status?: string;
}

export interface SyncAnalyzeDetailPayload {
  analysisId?: string;
  abnormal?: number;
  windows?: SyncDrilldownWindow[];
  status?: string;
}

export interface SyncDrilldownQuery {
  start?: string;
  end?: string;
  workers?: number;
  l1?: number;
  l2?: number;
  l3?: number;
  l4?: number;
}

export interface SyncAnalyzeProgressHandlers {
  onOpen?: () => void;
  onConnected?: (data: unknown) => void;
  onHub?: (data: unknown) => void;
  onRange?: (data: SyncDrilldownRange) => void;
  onProgress?: (data: SyncDrilldownProgress) => void;
  /** 分析完成：仅含 analysisId / abnormal，不含 windows */
  onReady?: (data: SyncAnalyzeReady) => void;
  onErrorEvent?: (msg: string) => void;
  onClosed?: () => void;
  onDebug?: (msg: string) => void;
}

export interface SyncAnalyzeDetailHandlers {
  onOpen?: () => void;
  onConnected?: (data: unknown) => void;
  onSnapshot?: (data: SyncAnalyzeDetailPayload) => void;
  onUpdate?: (data: SyncAnalyzeDetailPayload) => void;
  onErrorEvent?: (msg: string) => void;
  onClosed?: () => void;
}

/** @deprecated 使用 SyncAnalyzeProgressHandlers */
export type SyncDrilldownHandlers = SyncAnalyzeProgressHandlers & {
  onDone?: (data: SyncDrilldownDone) => void;
  onRaw?: (eventName: string, raw: string) => void;
};

function sseBaseUrl(): string {
  return import.meta.env.VITE_SSE_BASE_URL || import.meta.env.VITE_API_BASE_URL || '';
}

function buildSseUrl(path: string, project: string): string {
  const token = getToken() || '';
  return (
    `${sseBaseUrl()}${path}` +
    `?project=${encodeURIComponent(project)}&token=${token}`
  );
}

function normSyncTime(s?: string) {
  return s ? s.replace(/\.\d{1,3}$/, '').trim() : s;
}

function buildAnalyzeProgressSseUrl(
  project: string,
  query: SyncDrilldownQuery = {},
): string {
  const token = getToken() || '';
  const q = new URLSearchParams();
  q.set('project', project);
  q.set('token', token);
  if (query.start) q.set('start', normSyncTime(query.start)!);
  if (query.end) q.set('end', normSyncTime(query.end)!);
  if (query.workers != null) q.set('workers', String(query.workers));
  if (query.l1 != null) q.set('l1', String(query.l1));
  if (query.l2 != null) q.set('l2', String(query.l2));
  if (query.l3 != null) q.set('l3', String(query.l3));
  if (query.l4 != null) q.set('l4', String(query.l4));
  return `${sseBaseUrl()}/sql/sync/analyze?${q.toString()}`;
}

function buildAnalyzeDetailSseUrl(project: string, analysisId: string): string {
  const token = getToken() || '';
  const q = new URLSearchParams();
  q.set('project', project);
  q.set('token', token);
  q.set('analysisId', analysisId);
  return `${sseBaseUrl()}/sql/sync/analyze/detail?${q.toString()}`;
}

/* -------------------------------------------------------------------------- */
/* 统一 Sync SSE（EventSource）                                               */
/* -------------------------------------------------------------------------- */

/** 公共控制面事件：勿当业务失败 */
const SYNC_SSE_META = ['connected', 'heartbeat', 'hub', 'error'] as const;

export interface OpenSyncSseOptions {
  url: string;
  /** 业务事件名（不含公共 connected/heartbeat/hub/error，会自动监听） */
  events: string[];
  /**
   * 一次性任务（补全详情 / 下钻）：连接失败时主动 close，禁止原生静默重连。
   * 监控长连接保持 EventSource 默认重连。
   */
  oneShot?: boolean;
  onOpen?: () => void;
  onConnected?: (data: unknown) => void;
  onHeartbeat?: (data: unknown) => void;
  onHub?: (data: unknown) => void;
  onErrorEvent?: (message: string) => void;
  onClosed?: () => void;
  /** 业务事件（已 camelize 的明文 JSON） */
  onEvent: (eventName: string, data: unknown) => void;
  onRaw?: (eventName: string, raw: string) => void;
}

function parseEventData(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function coerceJsonValue(input: unknown): unknown {
  if (typeof input !== 'string') return input;
  const t = input.trim();
  if (
    (t.startsWith('{') && t.endsWith('}')) ||
    (t.startsWith('[') && t.endsWith(']'))
  ) {
    try {
      return JSON.parse(t);
    } catch {
      return input;
    }
  }
  return input;
}

/** 明文解析：兼容直接 JSON，或 { event/type, data/payload } 包装 */
function normalizeSsePayload(
  eventName: string,
  raw: string,
): { name: string; payload: unknown } {
  const parsed = parseEventData(raw);
  if (parsed == null) {
    return { name: eventName, payload: raw };
  }

  const normalized = camelizeKeys<Record<string, unknown>>(parsed);
  if (!normalized || typeof normalized !== 'object') {
    return { name: eventName, payload: parsed };
  }

  const nestedName = String(normalized.event ?? normalized.type ?? '');
  let nested = normalized.data ?? normalized.payload;
  nested = coerceJsonValue(nested);
  if (nested != null && nestedName) {
    return {
      name: nestedName,
      payload: typeof nested === 'object' ? camelizeKeys(nested) : nested,
    };
  }
  return { name: eventName, payload: normalized };
}

function errorMessageFromPayload(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const o = payload as Record<string, unknown>;
    const msg = o.message ?? o.msg ?? o.error;
    if (msg != null && String(msg)) return String(msg);
  }
  if (typeof payload === 'string' && payload) return payload;
  return fallback;
}

const activeSseConnections = new Set<SyncSseConnection>();
let activeMonitorConn: SyncSseConnection | null = null;

function trackSse(conn: SyncSseConnection): SyncSseConnection {
  activeSseConnections.add(conn);
  const origClose = conn.close;
  conn.close = () => {
    activeSseConnections.delete(conn);
    if (activeMonitorConn === conn) activeMonitorConn = null;
    origClose();
  };
  return conn;
}

function abortMonitorSse(): void {
  if (!activeMonitorConn) return;
  try {
    activeMonitorConn.close();
  } catch {
    /* ignore */
  }
  activeMonitorConn = null;
}

/** 刷新/关闭页时主动掐断 SSE */
export function abortAllSqlSyncSse(): void {
  abortMonitorSse();
  for (const conn of [...activeSseConnections]) {
    try {
      conn.close();
    } catch {
      /* ignore */
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => abortAllSqlSyncSse());
}

/**
 * 统一 Sync SSE：公共事件 + 业务事件；明文 JSON；EventSource 标准帧。
 */
export function openSyncSse(options: OpenSyncSseOptions): SyncSseConnection {
  const {
    url,
    events,
    oneShot = false,
    onOpen,
    onConnected,
    onHeartbeat,
    onHub,
    onErrorEvent,
    onClosed,
    onEvent,
    onRaw,
  } = options;

  const es = new EventSource(url);
  let closedByUs = false;
  let terminal = false; // 已收到业务 error / 主动结束，勿再报连接失败
  let opened = false;
  let connectTimer: ReturnType<typeof setTimeout> | null = null;

  const markTerminal = () => {
    terminal = true;
  };

  const clearConnectTimer = () => {
    if (connectTimer) {
      clearTimeout(connectTimer);
      connectTimer = null;
    }
  };

  const failClosed = () => {
    if (closedByUs || terminal) return;
    closedByUs = true;
    clearConnectTimer();
    try {
      es.close();
    } catch {
      /* ignore */
    }
    onClosed?.();
  };

  const dispatch = (eventName: string, raw: string) => {
    onRaw?.(eventName, raw);
    const { name, payload } = normalizeSsePayload(eventName, raw);

    switch (name) {
      case 'connected':
        onConnected?.(payload);
        return;
      case 'heartbeat':
        onHeartbeat?.(payload);
        return;
      case 'hub':
        onHub?.(payload);
        return;
      case 'error': {
        markTerminal();
        clearConnectTimer();
        onErrorEvent?.(errorMessageFromPayload(payload, raw || 'SSE 错误'));
        return;
      }
      default:
        onEvent(name, payload);
    }
  };

  es.onopen = () => {
    opened = true;
    clearConnectTimer();
    onOpen?.();
  };

  es.onerror = () => {
    if (closedByUs || terminal) return;

    if (oneShot) {
      // 连接握手阶段浏览器常先打一次 error 再 OPEN；此时 readyState=CONNECTING，不能当失败掐断
      if (!opened && es.readyState === EventSource.CONNECTING) {
        return;
      }
      failClosed();
      return;
    }

    if (es.readyState === EventSource.CLOSED) {
      onClosed?.();
    }
  };

  // 一次性任务：过久仍未 OPEN 再判失败（避免永久卡在 CONNECTING）
  if (oneShot) {
    connectTimer = setTimeout(() => {
      if (!opened && !closedByUs && !terminal) {
        failClosed();
      }
    }, 20000);
  }

  const listen = (name: string) => {
    // `error` 与连接失败同名：仅 MessageEvent + data 当业务 error
    if (name === 'error') {
      es.addEventListener('error', ((e: Event) => {
        if (e instanceof MessageEvent && typeof e.data === 'string' && e.data.length > 0) {
          dispatch('error', e.data);
        }
      }) as EventListener);
      return;
    }
    es.addEventListener(name, ((e: MessageEvent) => {
      dispatch(name, e.data);
    }) as EventListener);
  };

  const allEvents = new Set<string>([...SYNC_SSE_META, ...events, 'message', 'data']);
  for (const name of allEvents) listen(name);

  return trackSse({
    close: () => {
      closedByUs = true;
      markTerminal();
      clearConnectTimer();
      try {
        es.close();
      } catch {
        /* ignore */
      }
    },
  });
}

/** @deprecated 内部用；对外请用 openSyncSse */
function onClosedCompat(
  handler: (() => void) | undefined,
): () => void {
  return () => handler?.();
}

/**
 * 实时监控 SSE
 * 业务：history / pipeline / runtime / incremental / backfill / backfill_window
 */
export function openSqlSyncMonitorSSE(
  project: string,
  handlers: SyncMonitorHandlers,
): SyncSseConnection {
  abortMonitorSse();
  handlers.onConnecting?.();

  const url = buildSseUrl('/sql/sync/monitor', project);
  const biz = [
    'snapshot',
    'history',
    'pipeline',
    'incremental',
    'backfill',
    'backfill_window',
    'runtime',
  ];

  const conn = openSyncSse({
    url,
    events: biz,
    oneShot: false,
    onOpen: () => handlers.onOpen?.(),
    onConnected: (d) => {
      handlers.onConnected?.(d);
      // connected 视为真正可用
      handlers.onOpen?.();
    },
    onHub: (d) => handlers.onHub?.(d),
    onErrorEvent: (msg) => handlers.onErrorEvent?.(msg),
    onClosed: onClosedCompat(handlers.onClosed),
    onEvent: (name, payload) => {
      const data = camelizeKeys(payload);
      switch (name) {
        case 'snapshot':
        case 'history': {
          const snap = data as SyncHistory;
          handlers.onHistory?.(snap);
          if (snap?.pipeline) handlers.onPipeline?.(snap.pipeline);
          if (snap?.runtime) handlers.onRuntime?.(snap.runtime);
          if (snap?.backfillProgress) handlers.onBackfill?.(snap.backfillProgress);
          break;
        }
        case 'pipeline':
          handlers.onPipeline?.(data as SyncPipeline);
          break;
        case 'incremental':
          handlers.onIncremental?.(data as SyncIncrementalPoint);
          break;
        case 'backfill':
          handlers.onBackfill?.(data as SyncBackfillProgress);
          break;
        case 'backfill_window':
          handlers.onBackfillWindow?.(data);
          break;
        case 'runtime':
          handlers.onRuntime?.(data as SyncRuntime);
          break;
        default:
          handlers.onRaw?.(name, data);
      }
    },
  });

  activeMonitorConn = conn;
  return conn;
}

/**
 * 补全详情 SSE：snapshot / detail
 */
export function openSqlSyncBackfillSSE(
  project: string,
  onDetail: (data: SyncBackfillDetail) => void,
  handlers?: Pick<
    OpenSyncSseOptions,
    'onConnected' | 'onHub' | 'onErrorEvent' | 'onClosed' | 'onOpen'
  >,
): SyncSseConnection {
  const url = buildSseUrl('/sql/sync/backfill', project);

  return openSyncSse({
    url,
    events: ['snapshot', 'detail'],
    oneShot: true,
    onOpen: handlers?.onOpen,
    onConnected: handlers?.onConnected,
    onHub: handlers?.onHub,
    onErrorEvent: handlers?.onErrorEvent,
    onClosed: () => handlers?.onClosed?.(),
    onEvent: (_name, payload) => {
      onDetail(camelizeKeys(payload) as SyncBackfillDetail);
    },
  });
}

/**
 * 从缓冲区拆出完整 SSE 帧（空行分隔），返回剩余半包。
 */
function consumeSseFrames(
  buffer: string,
  onFrame: (eventName: string, data: string) => void,
): string {
  const normalized = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const parts = normalized.split('\n\n');
  const rest = parts.pop() ?? '';
  for (const block of parts) {
    if (!block.trim()) continue;
    let eventName = 'message';
    const dataLines: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue;
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim() || 'message';
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).replace(/^ /, ''));
      }
    }
    if (dataLines.length) onFrame(eventName, dataLines.join('\n'));
  }
  return rest;
}

function maskSseUrl(url: string): string {
  return url.replace(/([?&]token=)[^&]*/i, '$1***');
}

/**
 * fetch 流式读 SSE（Tauri 走 plugin-http，与 REST 同通道）。
 * 比 EventSource 更能暴露 HTTP 状态，且避免 WebView 握手误报 error。
 */
function openFetchSse(
  url: string,
  onFrame: (eventName: string, data: string) => void,
  handlers: {
    onOpen?: () => void;
    onHttpError?: (status: number, body: string) => void;
    onClosed?: () => void;
    onTransportError?: (msg: string) => void;
    onDebug?: (msg: string) => void;
  },
  oneShot = true,
): SyncSseConnection {
  const controller = new AbortController();
  let closed = false;
  let finished = false;

  const markFinished = () => {
    finished = true;
  };

  const run = async () => {
    handlers.onDebug?.(`[sse-fetch] GET ${maskSseUrl(url)}`);
    try {
      const headers: Record<string, string> = {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        'User-Agent': CLIENT_AGENT,
        'X-Client-Agent': CLIENT_AGENT,
      };
      const token = getToken() || '';
      if (token) headers.Authorization = `Bearer ${token}`;

      let res: Response;
      if (isTauriEnv()) {
        const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
        res = await tauriFetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
      } else {
        res = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
      }

      if (closed) return;

      const ct = res.headers.get('content-type') || '(空)';
      handlers.onDebug?.(`[sse-fetch] status=${res.status} content-type=${ct}`);

      if (!res.ok) {
        let body = '';
        try {
          body = (await res.text()).slice(0, 300);
        } catch {
          /* ignore */
        }
        markFinished();
        handlers.onHttpError?.(res.status, body);
        return;
      }

      handlers.onOpen?.();

      const body = res.body;
      if (!body || typeof body.getReader !== 'function') {
        const text = await res.text();
        handlers.onDebug?.(`[sse-fetch] no stream reader, bodyLen=${text.length}`);
        if (text) {
          let buf = text;
          buf = consumeSseFrames(buf, onFrame);
          if (buf.trim()) onFrame('message', buf.trim());
        }
        if (!finished && !closed) handlers.onClosed?.();
        return;
      }

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let bytes = 0;

      while (!closed) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        buffer += decoder.decode(value, { stream: true });
        buffer = consumeSseFrames(buffer, (name, data) => {
          // 业务终态由上层 markFinished（ready/error）
          onFrame(name, data);
        });
      }

      if (buffer.trim()) {
        handlers.onDebug?.(`[sse-fetch] tail len=${buffer.length}`);
        onFrame('message', buffer.trim());
      }
      handlers.onDebug?.(`[sse-fetch] eof bytes=${bytes} finished=${finished}`);

      if (!finished && !closed) {
        if (bytes === 0) {
          markFinished();
          handlers.onTransportError?.(
            '连接成功但未收到任何数据（网关缓冲或上游未 flush）',
          );
        } else if (oneShot) {
          handlers.onClosed?.();
        } else {
          handlers.onClosed?.();
        }
      }
    } catch (e) {
      if (closed) return;
      const msg = e instanceof Error ? e.message : String(e);
      if (/abort/i.test(msg)) return;
      handlers.onDebug?.(`[sse-fetch] err ${msg}`);
      if (!finished) handlers.onTransportError?.(msg);
    }
  };

  void run();

  return trackSse({
    close: () => {
      closed = true;
      markFinished();
      try {
        controller.abort();
      } catch {
        /* ignore */
      }
    },
  });
}

function dispatchAnalyzeProgressFrame(
  eventName: string,
  raw: string,
  handlers: SyncAnalyzeProgressHandlers,
  finish: () => void,
  finished: () => boolean,
) {
  const { name, payload } = normalizeSsePayload(eventName, raw);
  const data = (
    payload && typeof payload === 'object' ? camelizeKeys(payload) : payload
  ) as Record<string, unknown>;

  switch (name) {
    case 'connected':
      handlers.onConnected?.(data);
      return;
    case 'heartbeat':
      return;
    case 'hub':
      handlers.onHub?.(data);
      return;
    case 'range':
      handlers.onRange?.(data as SyncDrilldownRange);
      return;
    case 'progress':
      handlers.onProgress?.(data as SyncDrilldownProgress);
      return;
    case 'ready': {
      if (finished()) return;
      finish();
      const analysisId = String(data.analysisId || data.analysis_id || '');
      handlers.onReady?.({
        analysisId,
        abnormal: data.abnormal as number | undefined,
        status: data.status as string | undefined,
      });
      return;
    }
    case 'done': {
      if (finished()) return;
      finish();
      const analysisId = String(data.analysisId || data.analysis_id || '');
      if (analysisId) {
        handlers.onReady?.({
          analysisId,
          abnormal: data.abnormal as number | undefined,
          status: (data.status as string) || 'done',
        });
      } else {
        handlers.onErrorEvent?.('分析完成但缺少 analysisId');
      }
      return;
    }
    case 'error': {
      if (finished()) return;
      finish();
      handlers.onErrorEvent?.(errorMessageFromPayload(data, raw || '分析失败'));
      return;
    }
    default:
      // message 兜底推断
      if (data && typeof data === 'object') {
        if ('level' in data && ('done' in data || 'total' in data)) {
          handlers.onProgress?.(data as SyncDrilldownProgress);
        } else if (data.analysisId || data.analysis_id) {
          if (finished()) return;
          finish();
          handlers.onReady?.({
            analysisId: String(data.analysisId || data.analysis_id),
            abnormal: data.abnormal as number | undefined,
            status: data.status as string | undefined,
          });
        }
      }
  }
}

/**
 * 异常分析进度 SSE：connected → range → progress* → ready | error
 * 使用 fetch 流（Tauri HTTP），避免 EventSource 握手误杀 / 看不到 HTTP 状态
 */
export function openSqlSyncAnalyzeProgressSSE(
  project: string,
  query: SyncDrilldownQuery,
  handlers: SyncAnalyzeProgressHandlers,
): SyncSseConnection {
  const url = buildAnalyzeProgressSseUrl(project, query);
  let finished = false;
  const finish = () => {
    finished = true;
  };

  let conn: SyncSseConnection | null = null;
  conn = openFetchSse(
    url,
    (eventName, raw) => {
      dispatchAnalyzeProgressFrame(
        eventName,
        raw,
        handlers,
        () => {
          finish();
          conn?.close();
        },
        () => finished,
      );
    },
    {
      onOpen: () => handlers.onOpen?.(),
      onHttpError: (status, body) => {
        if (finished) return;
        finish();
        handlers.onErrorEvent?.(
          `HTTP ${status}${body ? `: ${body}` : ''}`,
        );
      },
      onTransportError: (msg) => {
        if (finished) return;
        finish();
        handlers.onErrorEvent?.(msg);
      },
      onClosed: () => {
        if (finished) return;
        handlers.onClosed?.();
      },
      onDebug: (msg) => handlers.onDebug?.(msg),
    },
    true,
  );

  return conn;
}

/**
 * 异常分析详情 SSE：connected → snapshot → update* → heartbeat
 */
export function openSqlSyncAnalyzeDetailSSE(
  project: string,
  analysisId: string,
  handlers: SyncAnalyzeDetailHandlers,
): SyncSseConnection {
  const url = buildAnalyzeDetailSseUrl(project, analysisId);
  let gotBiz = false;

  return openFetchSse(
    url,
    (eventName, raw) => {
      const { name, payload } = normalizeSsePayload(eventName, raw);
      const data = camelizeKeys(payload) as SyncAnalyzeDetailPayload & Record<string, unknown>;
      switch (name) {
        case 'connected':
          handlers.onConnected?.(data);
          break;
        case 'heartbeat':
          break;
        case 'snapshot':
          gotBiz = true;
          handlers.onSnapshot?.(data);
          break;
        case 'update':
          gotBiz = true;
          handlers.onUpdate?.(data);
          break;
        case 'error':
          handlers.onErrorEvent?.(errorMessageFromPayload(data, raw || '详情失败'));
          break;
        default:
          if (data && typeof data === 'object' && ('windows' in data || 'abnormal' in data)) {
            gotBiz = true;
            handlers.onSnapshot?.(data);
          }
          break;
      }
    },
    {
      onOpen: () => handlers.onOpen?.(),
      onHttpError: (status, body) => {
        handlers.onErrorEvent?.(
          `HTTP ${status}${body ? `: ${body}` : ''}（详情）`,
        );
      },
      onTransportError: (msg) => handlers.onErrorEvent?.(msg),
      onClosed: () => {
        if (!gotBiz) handlers.onClosed?.();
      },
    },
    false,
  );
}

/** @deprecated 请用 openSqlSyncAnalyzeProgressSSE */
export function openSqlSyncCompareDrilldownSSE(
  project: string,
  query: SyncDrilldownQuery,
  handlers: SyncDrilldownHandlers,
): SyncSseConnection {
  return openSqlSyncAnalyzeProgressSSE(project, query, {
    ...handlers,
    onReady: (r) => {
      handlers.onReady?.(r);
      handlers.onDone?.({
        analysisId: r.analysisId,
        abnormal: r.abnormal,
        status: r.status,
        windows: [],
      });
    },
  });
}
