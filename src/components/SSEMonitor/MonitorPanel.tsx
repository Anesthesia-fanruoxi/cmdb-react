/**
 * SSE 监控面板（贴 Sidebar 右侧弹出）
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SSEMonitorSnapshot } from './useSSEMonitor';
import { ConnectionTab } from './ConnectionTab';
import { SubscriptionsTab } from './SubscriptionsTab';
import { SubscriptionMessages } from './SubscriptionMessages';

type TabKey = 'conn' | 'subs';

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
  const submsgRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // 主面板定位：贴 anchor 右侧 + 顶端对齐
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

  // 点击外部 / ESC 关闭（副浮层视为内部，不触发关闭）
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (submsgRef.current?.contains(t)) return;
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

  // 切换 Tab 离开订阅则收起副浮层
  useEffect(() => {
    if (tab !== 'subs') setSelectedSubId(null);
  }, [tab]);

  const handleSelectSub = (id: string | null) => {
    setSelectedSubId(prev => (prev === id ? null : id));
  };

  const selectedChannel = useMemo(() => {
    if (!selectedSubId) return '';
    return snap.subscriptions.find(s => s.id === selectedSubId)?.channel ?? '';
  }, [selectedSubId, snap.subscriptions]);

  return (
    <>
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
        </div>
      </div>
      {selectedSubId && (
        <div ref={submsgRef}>
          <SubscriptionMessages
            subId={selectedSubId}
            channel={selectedChannel}
            messages={snap.messages}
            panelRef={panelRef}
            onClose={() => setSelectedSubId(null)}
          />
        </div>
      )}
    </>
  );
}
