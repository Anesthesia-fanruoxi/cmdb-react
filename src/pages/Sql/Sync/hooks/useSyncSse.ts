/**
 * 统一 Sync SSE hook：三条通道共用 connected / heartbeat / hub / error 约定。
 */

import { useEffect, useRef } from 'react';
import {
  openSyncSse,
  type OpenSyncSseOptions,
  type SyncSseConnection,
} from '@/services/sql/sync';

export interface UseSyncSseParams {
  /** falsy 时不连接 */
  url: string | null | undefined;
  events: string[];
  oneShot?: boolean;
  onEvent: (eventName: string, data: unknown) => void;
  onConnected?: OpenSyncSseOptions['onConnected'];
  onHub?: OpenSyncSseOptions['onHub'];
  onHeartbeat?: OpenSyncSseOptions['onHeartbeat'];
  onErrorEvent?: OpenSyncSseOptions['onErrorEvent'];
  onOpen?: OpenSyncSseOptions['onOpen'];
  onClosed?: OpenSyncSseOptions['onClosed'];
  enabled?: boolean;
}

export function useSyncSse({
  url,
  events,
  oneShot,
  onEvent,
  onConnected,
  onHub,
  onHeartbeat,
  onErrorEvent,
  onOpen,
  onClosed,
  enabled = true,
}: UseSyncSseParams) {
  const onEventRef = useRef(onEvent);
  const onConnectedRef = useRef(onConnected);
  const onHubRef = useRef(onHub);
  const onHeartbeatRef = useRef(onHeartbeat);
  const onErrorEventRef = useRef(onErrorEvent);
  const onOpenRef = useRef(onOpen);
  const onClosedRef = useRef(onClosed);

  onEventRef.current = onEvent;
  onConnectedRef.current = onConnected;
  onHubRef.current = onHub;
  onHeartbeatRef.current = onHeartbeat;
  onErrorEventRef.current = onErrorEvent;
  onOpenRef.current = onOpen;
  onClosedRef.current = onClosed;

  const eventsKey = events.join(',');

  useEffect(() => {
    if (!enabled || !url) return;

    let conn: SyncSseConnection | null = openSyncSse({
      url,
      events: eventsKey.split(',').filter(Boolean),
      oneShot,
      onOpen: () => onOpenRef.current?.(),
      onConnected: (d) => onConnectedRef.current?.(d),
      onHub: (d) => onHubRef.current?.(d),
      onHeartbeat: (d) => onHeartbeatRef.current?.(d),
      onErrorEvent: (m) => onErrorEventRef.current?.(m),
      onClosed: () => onClosedRef.current?.(),
      onEvent: (name, data) => onEventRef.current(name, data),
    });

    return () => {
      conn?.close();
      conn = null;
    };
  }, [url, eventsKey, oneShot, enabled]);
}
