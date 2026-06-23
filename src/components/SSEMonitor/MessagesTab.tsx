/**
 * Tab3：消息缓冲（最近 N 条），可按订阅过滤
 */
import { useState } from 'react';
import type { BufferedMessage } from '@/services/sse/types';

interface Props {
  messages: BufferedMessage[];
  /** 选中的订阅 ID（来自 Tab2），不为空时仅展示该订阅消息 */
  filterSubId: string | null;
  onClearFilter: () => void;
}

function formatTs(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function MessageItem({ msg }: { msg: BufferedMessage }) {
  const [expanded, setExpanded] = useState(false);
  const summary = msg.subscriptionId
    ? msg.subscriptionId
    : msg.channel
      ? `(channel) ${msg.channel}`
      : '(broadcast)';

  return (
    <div className="sse-monitor-msg">
      <div className="sse-monitor-msg__head" onClick={() => setExpanded(!expanded)}>
        <span className="sse-monitor-msg__ts">{formatTs(msg.ts)}</span>
        <span className={`sse-monitor-tag sse-monitor-tag--${msg.event}`}>{msg.event}</span>
        <span className="sse-monitor-msg__sub" title={summary}>{summary}</span>
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

export function MessagesTab({ messages, filterSubId, onClearFilter }: Props) {
  const filtered = filterSubId
    ? messages.filter(m => m.subscriptionId === filterSubId)
    : messages;
  const reversed = [...filtered].reverse();

  return (
    <div className="sse-monitor-msgs">
      {filterSubId && (
        <div className="sse-monitor-filter">
          <span>过滤: {filterSubId}</span>
          <button type="button" onClick={onClearFilter}>清除</button>
        </div>
      )}
      {reversed.length === 0 ? (
        <div className="sse-monitor-empty">暂无消息</div>
      ) : (
        reversed.map((m, i) => <MessageItem key={`${m.ts}-${i}`} msg={m} />)
      )}
    </div>
  );
}
