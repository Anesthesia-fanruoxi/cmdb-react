/**
 * Tab2：订阅列表（点击行选中可跳到 Tab3 看消息）
 */
import type { SubscriptionInfo } from '@/services/sse/types';

interface Props {
  subscriptions: SubscriptionInfo[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const STATE_TEXT: Record<string, string> = {
  pending: '建立中',
  active: '活跃',
  paused: '暂停',
  error: '错误',
  closed: '已关闭',
};

function formatAge(createdAt: number) {
  const ageSec = Math.floor((Date.now() - createdAt) / 1000);
  if (ageSec < 60) return `${ageSec}s`;
  if (ageSec < 3600) return `${Math.floor(ageSec / 60)}m`;
  return `${Math.floor(ageSec / 3600)}h`;
}

export function SubscriptionsTab({ subscriptions, selectedId, onSelect }: Props) {
  if (subscriptions.length === 0) {
    return <div className="sse-monitor-empty">暂无订阅</div>;
  }

  return (
    <div className="sse-monitor-subs">
      {subscriptions.map(sub => {
        const active = sub.id === selectedId;
        return (
          <div
            key={sub.id}
            className={`sse-monitor-sub ${active ? 'is-active' : ''}`}
            onClick={() => onSelect(active ? null : sub.id)}
            title={sub.id}
          >
            <div className="sse-monitor-sub__head">
              <span className="sse-monitor-sub__channel">{sub.channel}</span>
              <span className={`sse-monitor-tag sse-monitor-tag--${sub.state}`}>
                {STATE_TEXT[sub.state] || sub.state}
              </span>
            </div>
            <div className="sse-monitor-sub__meta">
              <span>消息: {sub.msgCount}</span>
              <span>已订阅: {formatAge(sub.createdAt)}</span>
            </div>
            <div className="sse-monitor-sub__id">{sub.id}</div>
          </div>
        );
      })}
    </div>
  );
}
