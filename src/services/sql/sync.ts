/**
 * SQL Sync（es-adb 同步监控）API
 * 所有业务请求需携带 project，由网关转发至对应 agent
 *
 * Monitor SSE：网关按项目 Redis 扇出；客户端先收 snapshot/history，再收实时事件。
 * 传输统一用浏览器原生 EventSource（token 走 URL），便于与后端对协议、也避免 Tauri HTTP 流 callback 刷屏。
 * 注意：EventSource 要求事件以空行 \\n\\n 结束，否则会 OPEN 却不派发。
 */

import { apiClient } from '../request';
import { getToken } from '../storage';
import { decryptToObject } from '@/utils/crypto';

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
  onHistory?: (data: SyncHistory) => void;
  onPipeline?: (data: SyncPipeline) => void;
  onIncremental?: (data: SyncIncrementalPoint) => void;
  onBackfill?: (data: SyncBackfillProgress) => void;
  onRuntime?: (data: SyncRuntime) => void;
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

/** 窗口补全：按异常窗列表回填（可不连续） */
export function triggerSqlSyncBackfillWindows(
  project: string,
  windows: SyncBackfillWindowMs[],
) {
  return apiClient.post<SyncBackfillWindowsResult>(
    `/sql/sync/backfill/windows?project=${encodeURIComponent(project)}`,
    { windows },
    { timeout: 600000 },
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

export interface SyncDrilldownDone {
  abnormal?: number;
  windows?: SyncDrilldownWindow[];
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

export interface SyncDrilldownHandlers {
  onOpen?: () => void;
  onRange?: (data: SyncDrilldownRange) => void;
  onProgress?: (data: SyncDrilldownProgress) => void;
  onDone?: (data: SyncDrilldownDone) => void;
  onErrorEvent?: (msg: string) => void;
  onClosed?: () => void;
}

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

function buildDrilldownSseUrl(project: string, query: SyncDrilldownQuery = {}): string {
  const token = getToken() || '';
  const q = new URLSearchParams();
  q.set('project', project);
  q.set('token', token);
  if (query.start) q.set('start', query.start);
  if (query.end) q.set('end', query.end);
  if (query.workers != null) q.set('workers', String(query.workers));
  if (query.l1 != null) q.set('l1', String(query.l1));
  if (query.l2 != null) q.set('l2', String(query.l2));
  if (query.l3 != null) q.set('l3', String(query.l3));
  if (query.l4 != null) q.set('l4', String(query.l4));
  return `${sseBaseUrl()}/sql/sync/compare/drilldown?${q.toString()}`;
}

function parseEventData(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const MONITOR_EVENTS = new Set([
  'snapshot',
  'history',
  'pipeline',
  'incremental',
  'backfill',
  'runtime',
]);

/**
 * 后端可能仍把密文放在 data 字符串里；网关 Redis 扇出后多为明文 JSON。
 * 仅当 data 不像 JSON 时才走设备解密，避免对每条消息狂打 decrypt_data IPC（会刷 callback 警告）。
 */
function looksLikeCiphertext(s: string): boolean {
  const t = s.trim();
  if (!t || t.length < 32) return false;
  if (t.startsWith('{') || t.startsWith('[') || t.startsWith('"')) return false;
  // 粗略：纯 base64/密文形态
  return /^[A-Za-z0-9+/=_-]+$/.test(t);
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

async function decryptIfEncrypted(
  parsed: unknown,
): Promise<{ parsed: unknown; decrypted: boolean }> {
  const dataField =
    parsed && typeof parsed === 'object' && typeof (parsed as { data?: unknown }).data === 'string'
      ? (parsed as { data: string }).data
      : null;
  if (dataField && looksLikeCiphertext(dataField)) {
    const decrypted = await decryptToObject(dataField);
    if (decrypted != null) return { parsed: decrypted, decrypted: true };
  }
  // data 若是 JSON 字符串，先展开一层，方便后续 unwrap
  if (parsed && typeof parsed === 'object' && dataField && !looksLikeCiphertext(dataField)) {
    const inner = coerceJsonValue(dataField);
    if (inner !== dataField) {
      return {
        parsed: { ...(parsed as object), data: inner },
        decrypted: false,
      };
    }
  }
  return { parsed, decrypted: false };
}

function unwrapMonitorPayload(
  eventName: string,
  parsed: unknown,
): { name: string; payload: unknown } {
  const normalized = camelizeKeys<Record<string, unknown>>(parsed);
  if (!normalized || typeof normalized !== 'object') {
    return { name: eventName, payload: parsed };
  }

  const nestedName = String(
    normalized.event ?? normalized.type ?? normalized.name ?? '',
  );
  let nestedPayload: unknown = normalized.data ?? normalized.payload;
  nestedPayload = coerceJsonValue(nestedPayload);
  if (nestedPayload && typeof nestedPayload === 'object') {
    nestedPayload = camelizeKeys(nestedPayload);
  }

  if (
    nestedPayload != null &&
    nestedName &&
    MONITOR_EVENTS.has(nestedName) &&
    (eventName === 'message' || eventName === 'data' || !MONITOR_EVENTS.has(eventName))
  ) {
    return { name: nestedName, payload: camelizeKeys(nestedPayload) };
  }

  if (eventName === 'message' || eventName === 'data' || eventName === 'snapshot') {
    if (
      eventName === 'snapshot' ||
      nestedName === 'snapshot' ||
      Array.isArray(normalized.incremental) ||
      Array.isArray(normalized.backfill)
    ) {
      // Redis HSET 快照：可能叫 snapshot / history，或直接带 incremental 数组
      return {
        name: eventName === 'snapshot' || nestedName === 'snapshot' ? 'snapshot' : 'history',
        payload: nestedPayload != null && nestedName === 'snapshot'
          ? camelizeKeys(nestedPayload)
          : normalized,
      };
    }
    if (
      'esReady' in normalized ||
      'mysqlReady' in normalized ||
      'intervalSec' in normalized ||
      'incrementalRunning' in normalized
    ) {
      return { name: 'pipeline', payload: normalized };
    }
    if ('hits' in normalized && 'written' in normalized) {
      return { name: 'incremental', payload: normalized };
    }
    if ('percent' in normalized || 'totalWindows' in normalized) {
      return { name: 'backfill', payload: normalized };
    }
    if ('goroutines' in normalized || 'allocMB' in normalized || 'uptimeSec' in normalized) {
      return { name: 'runtime', payload: normalized };
    }
    if (nestedName && MONITOR_EVENTS.has(nestedName)) {
      return {
        name: nestedName,
        payload: nestedPayload != null ? camelizeKeys(nestedPayload) : normalized,
      };
    }
  }

  if (eventName === 'snapshot') {
    return { name: 'snapshot', payload: normalized };
  }

  return { name: eventName, payload: normalized };
}

async function dispatchMonitorEvent(
  eventName: string,
  raw: string,
  handlers: SyncMonitorHandlers,
  seq: { n: number },
) {
  seq.n += 1;

  let parsed = parseEventData(raw);
  if (parsed == null) {
    handlers.onRaw?.(eventName, raw);
    return;
  }

  const { parsed: decryptedParsed } = await decryptIfEncrypted(parsed);
  parsed = decryptedParsed;

  const { name, payload } = unwrapMonitorPayload(eventName, parsed);

  switch (name) {
    case 'snapshot':
    case 'history': {
      const snap = payload as SyncHistory;
      handlers.onHistory?.(snap);
      if (snap?.pipeline) handlers.onPipeline?.(snap.pipeline);
      if (snap?.runtime) handlers.onRuntime?.(snap.runtime);
      if (snap?.backfillProgress) handlers.onBackfill?.(snap.backfillProgress);
      break;
    }
    case 'pipeline':
      handlers.onPipeline?.(payload as SyncPipeline);
      break;
    case 'incremental':
      handlers.onIncremental?.(payload as SyncIncrementalPoint);
      break;
    case 'backfill':
      handlers.onBackfill?.(payload as SyncBackfillProgress);
      break;
    case 'runtime':
      handlers.onRuntime?.(payload as SyncRuntime);
      break;
    default:
      handlers.onRaw?.(eventName || name, payload);
  }
}

const activeSseConnections = new Set<SyncSseConnection>();
/** 本端同时只保留一条 monitor，避免热更新/StrictMode 残留流狂打 fetch_read_body */
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
 * 浏览器原生 EventSource（要求标准 \\n\\n 分隔事件）
 */
function openEventSource(
  url: string,
  onEvent: (eventName: string, data: string) => void | Promise<void>,
  onOpen: () => void,
  onError: (err: string) => void,
  eventNames: string[],
): SyncSseConnection {
  const es = new EventSource(url);
  let opened = false;

  const emit = (name: string) =>
    ((e: MessageEvent) => {
      void Promise.resolve(onEvent(name, e.data));
    }) as EventListener;

  es.onopen = () => {
    opened = true;
    onOpen();
  };
  es.onerror = () => {
    const rs = es.readyState;
    if (rs === EventSource.CLOSED) {
      onError(opened ? 'EventSource closed' : 'EventSource failed');
    }
  };
  for (const name of eventNames) {
    es.addEventListener(name, emit(name));
  }
  es.addEventListener('message', emit('message'));
  es.addEventListener('data', emit('data'));
  return trackSse({
    close: () => {
      try {
        es.close();
      } catch {
        /* ignore */
      }
    },
  });
}

/**
 * 实时监控 SSE（原生 EventSource）
 */
export function openSqlSyncMonitorSSE(
  project: string,
  handlers: SyncMonitorHandlers,
): SyncSseConnection {
  abortMonitorSse();

  const url = buildSseUrl('/sql/sync/monitor', project);
  const seq = { n: 0 };

  const onEvent = (eventName: string, data: string) =>
    dispatchMonitorEvent(eventName, data, handlers, seq);

  const conn = openEventSource(
    url,
    onEvent,
    () => handlers.onOpen?.(),
    () => handlers.onClosed?.(),
    [...MONITOR_EVENTS],
  );

  activeMonitorConn = conn;
  return conn;
}

/**
 * 补全详情 SSE（原生 EventSource）
 */
export function openSqlSyncBackfillSSE(
  project: string,
  onDetail: (data: SyncBackfillDetail) => void,
): SyncSseConnection {
  const url = buildSseUrl('/sql/sync/backfill', project);

  const handleData = async (_eventName: string, raw: string) => {
    let parsed = parseEventData(raw);
    if (parsed == null) return;
    const { parsed: decryptedParsed } = await decryptIfEncrypted(parsed);
    parsed = decryptedParsed;
    const normalized = camelizeKeys<Record<string, unknown>>(parsed);
    const payload =
      normalized &&
      typeof normalized === 'object' &&
      (normalized.data || normalized.payload) &&
      (normalized.event || normalized.type)
        ? camelizeKeys(
            coerceJsonValue(normalized.data ?? normalized.payload) as object,
          )
        : normalized;
    onDetail(payload as SyncBackfillDetail);
  };

  return openEventSource(
    url,
    handleData,
    () => {},
    () => {},
    ['snapshot', 'detail'],
  );
}

const DRILLDOWN_EVENTS = ['range', 'progress', 'done', 'error'] as const;

/** 明文解析下钻事件（不做设备解密） */
function parseDrilldownPayload(raw: string): unknown | null {
  const parsed = parseEventData(raw);
  if (parsed == null) return null;
  const normalized = camelizeKeys<Record<string, unknown>>(parsed);
  if (!normalized || typeof normalized !== 'object') return parsed;
  // 兼容 { event, data } / { type, payload } 包装
  const nestedName = String(normalized.event ?? normalized.type ?? '');
  let nested = normalized.data ?? normalized.payload;
  nested = coerceJsonValue(nested);
  if (
    nested != null &&
    nestedName &&
    (DRILLDOWN_EVENTS as readonly string[]).includes(nestedName)
  ) {
    return typeof nested === 'object' ? camelizeKeys(nested) : nested;
  }
  return normalized;
}

/**
 * 异常分析四级下钻 SSE（明文 event + data JSON，勿当密文解密）
 */
export function openSqlSyncCompareDrilldownSSE(
  project: string,
  query: SyncDrilldownQuery,
  handlers: SyncDrilldownHandlers,
): SyncSseConnection {
  const url = buildDrilldownSseUrl(project, query);

  const handleData = (eventName: string, raw: string) => {
    const payload = parseDrilldownPayload(raw);
    if (payload == null) {
      if (eventName === 'error') handlers.onErrorEvent?.(raw || '分析失败');
      return;
    }

    const obj = payload as Record<string, unknown>;
    // 若外层仍是包装且 eventName 为 message，再按字段推断
    let name = eventName;
    if (name === 'message' || name === 'data') {
      if ('level' in obj && ('done' in obj || 'total' in obj)) name = 'progress';
      else if ('windows' in obj || 'abnormal' in obj) name = 'done';
      else if ('startMs' in obj || ('start' in obj && 'end' in obj && !('diff' in obj))) name = 'range';
      else if ('message' in obj || 'msg' in obj || 'error' in obj) name = 'error';
    }

    switch (name) {
      case 'range':
        handlers.onRange?.(payload as SyncDrilldownRange);
        break;
      case 'progress':
        handlers.onProgress?.(payload as SyncDrilldownProgress);
        break;
      case 'done':
        handlers.onDone?.(payload as SyncDrilldownDone);
        break;
      case 'error': {
        const msg =
          String(
            (obj.message as string) ||
              (obj.msg as string) ||
              (obj.error as string) ||
              raw,
          ) || '分析失败';
        handlers.onErrorEvent?.(msg);
        break;
      }
      default:
        break;
    }
  };

  return openEventSource(
    url,
    handleData,
    () => handlers.onOpen?.(),
    () => handlers.onClosed?.(),
    [...DRILLDOWN_EVENTS],
  );
}
