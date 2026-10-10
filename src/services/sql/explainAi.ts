/**
 * SQL EXPLAIN AI 分析（SSE 流式）
 * POST /sse/sql/explain/analyze
 *
 * 事件流：connected → stage(explain) → stage(meta) → stage(ai) → delta × N → done
 * 任意阶段异常推送 error 后结束；期间穿插 heartbeat（忽略）。
 * POST 请求体上限 1MB，后端整体超时 5 分钟；流关闭前未收到 done 视为异常。
 * 请求体：agent / dbName / query，并附带前端解析的真实源表名 tables（避免别名干扰元数据采集）。
 */

import { getToken } from '../storage';
import { isTauriEnv } from '../machine';
import { CLIENT_AGENT } from '../request';
import { extractSourceTables } from '../../utils/sql/tableExtractor';

export interface ExplainAiParams {
  /** 项目标识符 */
  agent: string;
  /** 数据库名称 */
  dbName: string;
  /** 待分析的 EXPLAIN 语句（必须单条、以 EXPLAIN 开头） */
  query: string;
}

export interface ExplainAiStageEvent {
  /** explain（执行 EXPLAIN）/ meta（采集表元数据）/ ai（AI 分析） */
  stage: string;
  message: string;
}

export interface ExplainAiDoneEvent {
  message?: string;
  model?: string;
  /** 总耗时（毫秒） */
  took?: number;
  /** 本次实际采集元数据的关联表名列表 */
  tables?: string[];
}

export interface ExplainAiHandlers {
  /** 连接建立成功 */
  onConnected?: (message: string) => void;
  /** 阶段提示 */
  onStage?: (event: ExplainAiStageEvent) => void;
  /** AI 输出增量文本片段（需按顺序拼接） */
  onDelta?: (content: string) => void;
  /** 分析完成 */
  onDone?: (event: ExplainAiDoneEvent) => void;
  /** SSE 流内 error 事件（EXPLAIN 执行失败 / AI 调用失败等） */
  onError?: (message: string) => void;
  /** 前置校验失败（HTTP 非 200，返回普通 JSON） */
  onHttpError?: (status: number, message: string) => void;
  /** 传输层异常（网络错误等） */
  onTransportError?: (message: string) => void;
  /** 流关闭但未收到 done（超时 / 网关掐断），应提示用户重试 */
  onClosed?: () => void;
}

export interface ExplainAiConnection {
  close: () => void;
}

/** 解析单个 SSE 事件块（event: xxx / data: xxx） */
function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      event = line.slice(6).trim() || 'message';
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''));
    }
  }
  if (!dataLines.length) return null;
  return { event, data: dataLines.join('\n') };
}

/** 从缓冲区切出完整 SSE 事件块，返回剩余不完整数据 */
function consumeSseBuffer(
  buffer: string,
  onEvent: (event: string, data: string) => void,
): string {
  const normalized = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const parts = normalized.split('\n\n');
  const rest = parts.pop() ?? '';
  for (const block of parts) {
    if (!block.trim()) continue;
    const parsed = parseSseBlock(block);
    if (parsed) onEvent(parsed.event, parsed.data);
  }
  return rest;
}

/**
 * 发起 EXPLAIN AI 分析（fetch 流式读 SSE）
 * Tauri 走 plugin-http（与 REST 同通道，不受 CORS 限制）；浏览器环境走原生 fetch。
 */
export function analyzeExplainAi(
  params: ExplainAiParams,
  handlers: ExplainAiHandlers,
): ExplainAiConnection {
  const baseUrl = import.meta.env.VITE_SSE_BASE_URL || import.meta.env.VITE_API_BASE_URL || '';
  const url = `${baseUrl}/sql/explain/analyze`;

  const controller = new AbortController();
  let closed = false;
  /** 已收到业务终态（done / error），流关闭时不再视为异常 */
  let finished = false;

  const dispatch = (event: string, dataStr: string) => {
    let data: Record<string, unknown>;
    try {
      data = dataStr ? (JSON.parse(dataStr) as Record<string, unknown>) : {};
    } catch {
      return;
    }

    switch (event) {
      case 'connected':
        handlers.onConnected?.(String(data.message ?? '连接成功'));
        break;
      case 'stage':
        handlers.onStage?.({
          stage: String(data.stage ?? ''),
          message: String(data.message ?? ''),
        });
        break;
      case 'delta':
        if (typeof data.content === 'string') handlers.onDelta?.(data.content);
        break;
      case 'done':
        finished = true;
        handlers.onDone?.({
          message: data.message != null ? String(data.message) : undefined,
          model: data.model != null ? String(data.model) : undefined,
          took: typeof data.took === 'number' ? data.took : undefined,
          tables: Array.isArray(data.tables) ? data.tables.map(String) : undefined,
        });
        break;
      case 'error':
        finished = true;
        handlers.onError?.(String(data.message ?? '分析失败'));
        break;
      case 'heartbeat':
        break;
      default:
        break;
    }
  };

  const run = async () => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        'User-Agent': CLIENT_AGENT,
        'X-Client-Agent': CLIENT_AGENT,
      };
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      // 解析真实源表名（消除别名 / CTE 干扰），随请求下发供后端采集表元数据
      const tables = extractSourceTables(params.query);

      const body = JSON.stringify({
        agent: params.agent,
        dbName: params.dbName,
        query: params.query,
        // 解析为空时省略该字段，后端回退按 EXPLAIN 计划解析（向后兼容）
        ...(tables.length > 0 ? { tables } : {}),
      });

      let res: Response;
      if (isTauriEnv()) {
        const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
        res = await tauriFetch(url, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });
      } else {
        res = await fetch(url, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });
      }

      if (closed) return;

      // 前置校验失败：普通 JSON 响应，不进入 SSE 流
      if (!res.ok) {
        let message = `请求失败 (HTTP ${res.status})`;
        try {
          const text = await res.text();
          try {
            const parsed = JSON.parse(text) as { message?: string };
            if (parsed?.message) message = parsed.message;
          } catch {
            if (text) message = text.slice(0, 300);
          }
        } catch {
          /* ignore */
        }
        finished = true;
        handlers.onHttpError?.(res.status, message);
        return;
      }

      const resBody = res.body;
      if (!resBody || typeof resBody.getReader !== 'function') {
        // 兜底：无流式读取能力时整体解析
        const text = await res.text();
        let rest = consumeSseBuffer(text, dispatch);
        if (rest.trim()) {
          const parsed = parseSseBlock(rest);
          if (parsed) dispatch(parsed.event, parsed.data);
        }
        if (!finished && !closed) handlers.onClosed?.();
        return;
      }

      const reader = resBody.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!closed) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = consumeSseBuffer(buffer, dispatch);
      }

      if (buffer.trim()) {
        const parsed = parseSseBlock(buffer);
        if (parsed) dispatch(parsed.event, parsed.data);
      }

      if (!finished && !closed) handlers.onClosed?.();
    } catch (e) {
      if (closed) return;
      const msg = e instanceof Error ? e.message : String(e);
      if (/abort/i.test(msg)) return;
      handlers.onTransportError?.(msg);
    }
  };

  void run();

  return {
    close: () => {
      closed = true;
      try {
        controller.abort();
      } catch {
        /* ignore */
      }
    },
  };
}
