/**
 * SSE 监控面板（贴 Sidebar 右侧弹出）
 */
import { useEffect, useRef, useState } from 'react';
import type { SSEMonitorSnapshot } from './useSSEMonitor';
import { ConnectionTab } from './ConnectionTab';
import { SubscriptionsTab } from './SubscriptionsTab';
import { MessagesTab } from './MessagesTab';

type TabKey = 'conn' | 'subs' | 'msgs';

interface Props {
  snap: SSEMonitorSnapshot;
  /** 锚点元素（小绿灯按钮），用于点击外部关闭判定 */
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}

export function MonitorPanel({ snap, anchorRef, onClose }: Props) {
  const [tab, setTab] = useState<TabKey>('conn');
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // 计算浮层位置（贴 anchor 右侧 + 顶端对齐 anchor 顶部）
  useEffect(() => {
    const update = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      if (!a) return;
      setPos({ top: a.top, left: a.right + 12 });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [anchorRef]);

  // 点击外部 / ESC 关闭
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchorRef, onClose]);

  const handleSelectSub = (id: string | null) => {
    setSelectedSubId(id);
    if (id) setTab('msgs');
  };

  return (
    <div
      className="sse-monitor-panel"
      ref={panelRef}
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="sse-monitor-panel__head">
        <span className="sse-monitor-panel__title">SSE 网关</span>
        <button type="button" className="sse-monitor-panel__close" onClick={onClose}>×</button>
      </div>
      <div className="sse-monitor-panel__tabs">
        <button
          type="button"
          className={tab === 'conn' ? 'is-active' : ''}
          onClick={() => setTab('conn')}
        >连接</button>
        <button
          type="button"
          className={tab === 'subs' ? 'is-active' : ''}
          onClick={() => setTab('subs')}
        >订阅 ({snap.subscriptions.length})</button>
        <button
          type="button"
          className={tab === 'msgs' ? 'is-active' : ''}
          onClick={() => setTab('msgs')}
        >消息 ({snap.messages.length})</button>
      </div>
      <div className="sse-monitor-panel__body">
        {tab === 'conn' && <ConnectionTab snap={snap} />}
        {tab === 'subs' && (
          <SubscriptionsTab
            subscriptions={snap.subscriptions}
            selectedId={selectedSubId}
            onSelect={handleSelectSub}
          />
        )}
        {tab === 'msgs' && (
          <MessagesTab
            messages={snap.messages}
            filterSubId={selectedSubId}
            onClearFilter={() => setSelectedSubId(null)}
          />
        )}
      </div>
    </div>
  );
}
