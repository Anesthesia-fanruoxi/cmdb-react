/**
 * Tab1：连接信息
 */
import { SSEGateway } from '@/services/sse/SSEGateway';
import type { SSEMonitorSnapshot } from './useSSEMonitor';

interface Props {
  snap: SSEMonitorSnapshot;
}

const STATE_LABEL: Record<string, string> = {
  open: '已连接',
  connecting: '连接中',
  reconnecting: '重连中',
  closed: '已断开',
};

function formatTime(ts: number) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.toLocaleTimeString()} (${Math.floor((Date.now() - ts) / 1000)}s 前)`;
}

export function ConnectionTab({ snap }: Props) {
  const handleReconnect = () => {
    try {
      SSEGateway.getInstance().forceReconnect();
    } catch (e) {
      console.error('[SSEMonitor] 手动重连失败:', e);
    }
  };

  return (
    <div className="sse-monitor-conn">
      <div className="sse-monitor-row">
        <label>连接状态</label>
        <span className={`sse-monitor-tag sse-monitor-tag--${snap.dot}`}>
          {STATE_LABEL[snap.state] || snap.state}
        </span>
      </div>
      <div className="sse-monitor-row">
        <label>Connection ID</label>
        <span className="sse-monitor-mono" title={snap.connectionId || ''}>
          {snap.connectionId ? snap.connectionId.slice(0, 16) + '…' : '—'}
        </span>
      </div>
      <div className="sse-monitor-row">
        <label>重连次数</label>
        <span>{snap.reconnectAttempts}</span>
      </div>
      <div className="sse-monitor-row">
        <label>最近心跳</label>
        <span>{formatTime(snap.lastHeartbeatAt)}</span>
      </div>
      <div className="sse-monitor-row">
        <label>订阅数量</label>
        <span>{snap.subscriptions.length}</span>
      </div>
      <button
        type="button"
        className="sse-monitor-btn"
        onClick={handleReconnect}
        disabled={snap.state === 'connecting'}
      >
        手动重连
      </button>
    </div>
  );
}
