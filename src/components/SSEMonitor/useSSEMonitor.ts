/**
 * SSE 监控面板数据 Hook
 * - 订阅 stateChange/message 事件，实时刷新连接状态、订阅列表、消息缓冲
 * - 1s 轮询心跳时间，用于判定 stale 状态
 * - active=false 时仅保留连接状态订阅，避免高频消息触发 UI 重渲染
 */
import { useEffect, useState } from 'react';
import { SSEGateway } from '@/services/sse/SSEGateway';
import type { SSEConnectionState, SubscriptionInfo, BufferedMessage } from '@/services/sse/types';

/** 派生的 UI 状态 */
export type DotState = 'open' | 'connecting' | 'closed' | 'stale';

export interface SSEMonitorSnapshot {
  /** 原始连接状态 */
  state: SSEConnectionState;
  /** 派生的指示灯状态（open + 心跳健康/超时） */
  dot: DotState;
  connectionId: string | null;
  reconnectAttempts: number;
  lastHeartbeatAt: number;
  /** 距上次心跳秒数（无心跳则 -1） */
  heartbeatAgeSec: number;
  subscriptions: SubscriptionInfo[];
  messages: BufferedMessage[];
}

/** 心跳超时阈值：60s 内无任何事件视为 stale */
const STALE_THRESHOLD_MS = 60_000;

function getGateway(): SSEGateway | null {
  try {
    return SSEGateway.getInstance();
  } catch {
    return null;
  }
}

function buildSnapshot(): SSEMonitorSnapshot {
  const gw = getGateway();
  if (!gw) {
    return {
      state: 'closed',
      dot: 'closed',
      connectionId: null,
      reconnectAttempts: 0,
      lastHeartbeatAt: 0,
      heartbeatAgeSec: -1,
      subscriptions: [],
      messages: [],
    };
  }
  const state = gw.getState();
  const lastHb = gw.getLastHeartbeatAt();
  const ageMs = lastHb > 0 ? Date.now() - lastHb : -1;
  const heartbeatAgeSec = ageMs < 0 ? -1 : Math.floor(ageMs / 1000);

  let dot: DotState;
  if (state === 'connecting' || state === 'reconnecting') dot = 'connecting';
  else if (state === 'closed') dot = 'closed';
  else if (lastHb > 0 && ageMs > STALE_THRESHOLD_MS) dot = 'stale';
  else dot = 'open';

  return {
    state,
    dot,
    connectionId: gw.getConnectionId(),
    reconnectAttempts: gw.getReconnectAttempts(),
    lastHeartbeatAt: lastHb,
    heartbeatAgeSec,
    subscriptions: gw.listSubscriptions(),
    messages: gw.getMessageHistory(),
  };
}

/** SSE 监控 Hook
 * @param active 是否激活高频订阅（面板打开时为 true，仅指示灯模式可传 false）
 */
export function useSSEMonitor(active: boolean): SSEMonitorSnapshot {
  const [snap, setSnap] = useState<SSEMonitorSnapshot>(() => buildSnapshot());

  useEffect(() => {
    const gw = getGateway();
    if (!gw) return;

    const refresh = () => setSnap(buildSnapshot());

    const offState = gw.on('stateChange', refresh);
    const offConnected = gw.on('connected', refresh);
    const offDisconnected = gw.on('disconnected', refresh);
    const offMessage = active ? gw.on('message', refresh) : () => {};

    // 心跳/订阅状态需要轮询（无独立事件）
    const interval = setInterval(refresh, active ? 1000 : 3000);

    return () => {
      offState();
      offConnected();
      offDisconnected();
      offMessage();
      clearInterval(interval);
    };
  }, [active]);

  return snap;
}
