/**
 * 订阅消息副浮层（贴主面板右侧弹出，展示某订阅的消息缓冲）
 */
import { useEffect, useState } from 'react';
import type { BufferedMessage } from '@/services/sse/types';

interface Props {
  subId: string;
  channel: string;
  messages: BufferedMessage[];
  /** 主面板 DOM ref，用于定位 */
  panelRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}

function formatTs(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function MessageItem({ msg }: { msg: BufferedMessage }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="sse-monitor-msg">
      <div className="sse-monitor-msg__head" onClick={() => setExpanded(!expanded)}>
        <span className="sse-monitor-msg__ts">{formatTs(msg.ts)}</span>
        <span className={`sse-monitor-tag sse-monitor-tag--${msg.event}`}>{msg.event}</span>
        <span className="sse-monitor-msg__chevron">{expanded ? '▾' : '▸'}</span>
      </div>
      {expanded && (
        <pre className="sse-monitor-msg__json">
          {JSON.stringify(msg.raw, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function SubscriptionMessages({ subId, channel, messages, panelRef, onClose }: Props) {
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // 紧贴主面板右侧
  useEffect(() => {
    const update = () => {
      const r = panelRef.current?.getBoundingClientRect();
      if (!r) return;
      setPos({ top: r.top, left: r.right + 8 });
    };
    update();
    window.addEventListener('resize', update);
    const interval = setInterval(update, 200); // 跟随主面板潜在移动
    return () => {
      window.removeEventListener('resize', update);
      clearInterval(interval);
    };
  }, [panelRef]);

  const list = messages.filter(m => m.subscriptionId === subId);
  const reversed = [...list].reverse();

  return (
    <div className="sse-monitor-submsg" style={{ top: pos.top, left: pos.left }}>
      <div className="sse-monitor-submsg__head">
        <div className="sse-monitor-submsg__title">
          <span className="sse-monitor-submsg__channel">{channel}</span>
          <span className="sse-monitor-submsg__count">{list.length} 条</span>
        </div>
        <button type="button" className="sse-monitor-panel__close" onClick={onClose}>×</button>
      </div>
      <div className="sse-monitor-submsg__subid" title={subId}>{subId}</div>
      <div className="sse-monitor-submsg__body">
        {reversed.length === 0 ? (
          <div className="sse-monitor-empty">该订阅暂无消息</div>
        ) : (
          reversed.map((m, i) => <MessageItem key={`${m.ts}-${i}`} msg={m} />)
        )}
      </div>
    </div>
  );
}
