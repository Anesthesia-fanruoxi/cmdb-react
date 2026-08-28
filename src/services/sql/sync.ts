/**
 * SQL Sync（es-adb 同步监控）API
 * 所有业务请求需携带 project，由网关转发至对应 agent
 *
 * Sync agent 的 SSE 常缺事件结束空行（`\\n\\n`），原生 EventSource 会一直 OPEN 却不派发。
 * Tauri 环境用 plugin-http 按行宽松解析；非 Tauri 再回退 EventSource。
 */

import { apiClient, CLIENT_AGENT } from '../request';
import { getToken } from '../storage';
import { isTauriEnv } from '../machine';
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

export function compareSqlSync(
  project: string,
  body: { start?: string; end?: string },
) {
  return apiClient.post<SyncCompareResult>(
    `/sql/sync/compare?project=${encodeURIComponent(project)}`,
    body,
  );
}

function sseBaseUrl(): string {
  return import.meta.env.VITE_SSE_BASE_URL || import.meta.env.VITE_API_BASE_URL || '';
}

function maskUrl(url: string): string {
  return url.replace(/token=[^&]*/g, 'token=***');
}

function truncate(s: string, n = 240): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + `…(+${s.length - n})`;
}

function buildSseUrl(path: string, project: string): string {
  const token = getToken() || '';
  return (
    `${sseBaseUrl()}${path}` +
    `?project=${encodeURIComponent(project)}&token=${token}`
  );
}

function parseEventData(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const MONITOR_EVENTS = new Set([
  'history',
  'pipeline',
  'incremental',
  'backfill',
  'runtime',
]);

/**
 * 后端将真实负载加密（AES-GCM 设备密钥）后放入 data 字段推送。
 * 若 data 字段为 base64 密文则解密还原为对象；否则原样返回。
 */
async function decryptIfEncrypted(
  parsed: unknown,
): Promise<{ parsed: unknown; decrypted: boolean }> {
  const dataField =
    parsed && typeof parsed === 'object' && typeof (parsed as { data?: unknown }).data === 'string'
      ? (parsed as { data: string }).data
      : null;
  if (dataField) {
    const decrypted = await decryptToObject(dataField);
    if (decrypted != null) return { parsed: decrypted, decrypted: true };
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
  const nestedPayload = normalized.data ?? normalized.payload;

  if (
    nestedPayload != null &&
    nestedName &&
    MONITOR_EVENTS.has(nestedName) &&
    (eventName === 'message' || eventName === 'data' || !MONITOR_EVENTS.has(eventName))
  ) {
    return { name: nestedName, payload: camelizeKeys(nestedPayload) };
  }

  if (eventName === 'message' || eventName === 'data') {
    if (Array.isArray(normalized.incremental) || Array.isArray(normalized.backfill)) {
      return { name: 'history', payload: normalized };
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

  return { name: eventName, payload: normalized };
}

async function dispatchMonitorEvent(
  eventName: string,
  raw: string,
  handlers: SyncMonitorHandlers,
  seq: { n: number },
) {
  seq.n += 1;
  const debug = (msg: string, err?: boolean) => {
    handlers.onDebug?.(msg, err);
  };
  debug(`#${seq.n} 收到 event="${eventName}" raw=${truncate(raw)}`);

  let parsed = parseEventData(raw);
  if (parsed == null) {
    debug(`#${seq.n} JSON解析失败`, true);
    handlers.onRaw?.(eventName, raw);
    return;
  }

  // 后端将真实 SSE 负载加密（AES-GCM 设备密钥）后放入 data 字段推送，需先解密还原
  const { parsed: decryptedParsed, decrypted } = await decryptIfEncrypted(parsed);
  if (decrypted) {
    debug(`#${seq.n} 解密成功 → ${truncate(JSON.stringify(decryptedParsed), 240)}`);
  }
  parsed = decryptedParsed;

  const { name, payload } = unwrapMonitorPayload(eventName, parsed);
  if (name !== eventName) debug(`#${seq.n} 映射 ${eventName} → ${name}`);

  switch (name) {
    case 'history':
      handlers.onHistory?.(payload as SyncHistory);
      break;
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
      debug(
        `#${seq.n} 未识别 event="${name}" keys=${
          payload && typeof payload === 'object'
            ? Object.keys(payload as object).join(',')
            : typeof payload
        }`,
        true,
      );
      handlers.onRaw?.(eventName || name, payload);
  }
}

const activeSseConnections = new Set<SyncSseConnection>();

function trackSse(conn: SyncSseConnection): SyncSseConnection {
  activeSseConnections.add(conn);
  const origClose = conn.close;
  conn.close = () => {
    activeSseConnections.delete(conn);
    origClose();
  };
  return conn;
}

/** 刷新/关闭页时主动掐断 Tauri SSE，减少 orphan callback 刷屏 */
export function abortAllSqlSyncSse(): void {
  for (const conn of [...activeSseConnections]) {
    try {
      conn.close();
    } catch {
      /* ignore */
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => abortAllSqlSyncSse());
  window.addEventListener('beforeunload', () => abortAllSqlSyncSse());
}

/**
 * Tauri HTTP 流式读 SSE：按行解析，不要求标准空行分隔。
 */
function openTauriSseStream(
  url: string,
  onEvent: (eventName: string, data: string) => void | Promise<void>,
  onOpen: () => void,
  onError: (err: string) => void,
  onDebug?: (msg: string, err?: boolean) => void,
): SyncSseConnection {
  const controller = new AbortController();
  let closed = false;
  let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const run = async () => {
    try {
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
      const token = getToken() || '';
      onDebug?.(`[tauri-sse] GET ${maskUrl(url)}`);
      const res = await tauriFetch(url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          Authorization: token ? `Bearer ${token}` : '',
          'Cache-Control': 'no-cache',
          'User-Agent': CLIENT_AGENT,
          'X-Client-Agent': CLIENT_AGENT,
        },
        signal: controller.signal,
      });

      if (closed) return;
      onDebug?.(
        `[tauri-sse] status=${res.status} content-type=${res.headers.get('content-type') || '(空)'}`,
      );
      if (!res.ok) {
        onError(`HTTP ${res.status}`);
        return;
      }

      onOpen();

      const body = res.body;
      if (!body || typeof (body as ReadableStream<Uint8Array>).getReader !== 'function') {
        onError('响应无可读 body（Tauri 流不可用）');
        return;
      }

      const reader = (body as ReadableStream<Uint8Array>).getReader();
      activeReader = reader;
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let currentEvent = 'message';

      while (!closed) {
        const { done, value } = await reader.read();
        if (done) {
          onDebug?.('[tauri-sse] 流结束');
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        let nl = 0;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          const trimmed = line.replace(/^\uFEFF/, '').trim();
          if (!trimmed) {
            // 标准空行：重置事件名（可选）
            currentEvent = 'message';
            continue;
          }
          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.slice(6).trim() || currentEvent;
            continue;
          }
          if (!trimmed.startsWith('data:')) continue;
          const content = trimmed.slice(5).trim();
          if (!content) continue;
          // 兼容内层再包一层 data:/event:
          if (content.startsWith('event:')) {
            currentEvent = content.slice(6).trim() || currentEvent;
            continue;
          }
          if (content.startsWith('data:')) {
            const inner = content.slice(5).trim();
            if (inner) await onEvent(currentEvent || 'message', inner);
            continue;
          }
          await onEvent(currentEvent || 'message', content);
        }
      }

      if (!closed) onError('stream ended');
    } catch (e) {
      if (closed || controller.signal.aborted) return;
      const msg = e instanceof Error ? e.message : String(e);
      onDebug?.(`[tauri-sse] 异常: ${msg}`, true);
      onError(msg);
    } finally {
      activeReader = null;
    }
  };

  void run();

  return trackSse({
    close: () => {
      closed = true;
      try {
        if (activeReader) {
          void activeReader.cancel().catch(() => {});
          activeReader = null;
        }
        controller.abort();
      } catch {
        /* ignore */
      }
    },
  });
}

/** 浏览器原生 EventSource（要求标准 \\n\\n 分隔） */
function openEventSource(
  url: string,
  onEvent: (eventName: string, data: string) => void | Promise<void>,
  onOpen: () => void,
  onError: () => void,
  eventNames: string[],
): SyncSseConnection {
  const es = new EventSource(url);
  const emit = (name: string) =>
    ((e: MessageEvent) => {
      void Promise.resolve(onEvent(name, e.data));
    }) as EventListener;

  es.onopen = () => onOpen();
  es.onerror = () => onError();
  for (const name of eventNames) {
    es.addEventListener(name, emit(name));
  }
  es.addEventListener('message', emit('message'));
  es.addEventListener('data', emit('data'));
  return trackSse({
    close: () => es.close(),
  });
}

/**
 * 实时监控 SSE（Tauri 优先）
 */
export function openSqlSyncMonitorSSE(
  project: string,
  handlers: SyncMonitorHandlers,
): SyncSseConnection {
  const url = buildSseUrl('/sql/sync/monitor', project);
  const seq = { n: 0 };
  const transport = isTauriEnv() ? 'tauri-http' : 'eventsource';

  handlers.onDebug?.(`[diag] transport=${transport} project=${project}`);
  handlers.onDebug?.(`[diag] url=${maskUrl(url)}`);

  const onEvent = (eventName: string, data: string) =>
    dispatchMonitorEvent(eventName, data, handlers, seq);

  if (isTauriEnv()) {
    return openTauriSseStream(
      url,
      onEvent,
      () => handlers.onOpen?.(),
      (err) => {
        handlers.onDebug?.(`[tauri-sse] closed: ${err}`, true);
        handlers.onClosed?.();
      },
      handlers.onDebug,
    );
  }

  return openEventSource(
    url,
    onEvent,
    () => handlers.onOpen?.(),
    () => handlers.onClosed?.(),
    [...MONITOR_EVENTS],
  );
}

/**
 * 补全详情 SSE（Tauri 优先）
 */
export function openSqlSyncBackfillSSE(
  project: string,
  onDetail: (data: SyncBackfillDetail) => void,
  onDebug?: (msg: string, err?: boolean) => void,
): SyncSseConnection {
  const url = buildSseUrl('/sql/sync/backfill', project);
  const transport = isTauriEnv() ? 'tauri-http' : 'eventsource';
  onDebug?.(`[backfill-sse] transport=${transport} url=${maskUrl(url)}`);

  let n = 0;
  const handleData = async (eventName: string, raw: string) => {
    n += 1;
    onDebug?.(`[backfill-sse] #${n} event=${eventName} raw=${truncate(raw)}`);
    let parsed = parseEventData(raw);
    if (parsed == null) {
      onDebug?.(`[backfill-sse] #${n} JSON解析失败`, true);
      return;
    }
    const { parsed: decryptedParsed, decrypted } = await decryptIfEncrypted(parsed);
    if (decrypted) {
      onDebug?.(`[backfill-sse] #${n} 解密成功 → ${truncate(JSON.stringify(decryptedParsed), 240)}`);
    }
    parsed = decryptedParsed;
    const normalized = camelizeKeys<Record<string, unknown>>(parsed);
    const payload =
      normalized &&
      typeof normalized === 'object' &&
      (normalized.data || normalized.payload) &&
      (normalized.event || normalized.type)
        ? camelizeKeys(normalized.data ?? normalized.payload)
        : normalized;
    onDetail(payload as SyncBackfillDetail);
  };

  if (isTauriEnv()) {
    return openTauriSseStream(
      url,
      handleData,
      () => onDebug?.('[backfill-sse] opened'),
      (err) => onDebug?.(`[backfill-sse] closed: ${err}`, true),
      onDebug,
    );
  }

  return openEventSource(
    url,
    handleData,
    () => onDebug?.('[backfill-sse] opened'),
    () => onDebug?.('[backfill-sse] error', true),
    ['snapshot', 'detail'],
  );
}
