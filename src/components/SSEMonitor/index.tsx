/**
 * SSE 监控入口：小绿灯 + 浮层
 * 挂在 Sidebar logo 右侧。点击展开右侧浮层（贴 Sidebar 右边缘）。
 */
import { useRef, useState } from 'react';
import { StatusDot } from './StatusDot';
import { MonitorPanel } from './MonitorPanel';
import { useSSEMonitor } from './useSSEMonitor';
import './styles.css';

export function SSEMonitor() {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const snap = useSSEMonitor(open);

  return (
    <div className="sse-monitor" ref={anchorRef}>
      <StatusDot state={snap.dot} onClick={() => setOpen(v => !v)} />
      {open && (
        <MonitorPanel
          snap={snap}
          anchorRef={anchorRef}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

export default SSEMonitor;
