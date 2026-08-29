import type { LogItem } from '../hooks/useSyncMonitor';

interface EventLogProps {
  logs: LogItem[];
}

export default function EventLog({ logs }: EventLogProps) {
  return (
    <div className="card event-log-card" style={{ minHeight: 120 }}>
      <div className="card-head">
        <h2>事件日志</h2>
      </div>
      <div className="event-log">
        {logs.map((item) => (
          <div key={item.id} className={item.err ? 'err' : ''}>
            <span className="ts">{item.ts}</span>
            {item.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
