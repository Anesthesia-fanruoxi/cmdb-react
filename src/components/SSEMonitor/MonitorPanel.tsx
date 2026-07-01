/**
 * SSE 监控面板（贴 Sidebar 右侧弹出）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);

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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 拖拽
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setDragging(true);
    hasDragged.current = false;
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      hasDragged.current = true;
      setPos({ top: e.clientY - dragOffset.current.y, left: e.clientX - dragOffset.current.x });
    };
    const onUp = () => setDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

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
        <div className="sse-monitor-panel__head" onMouseDown={handleMouseDown} style={{ cursor: dragging ? 'grabbing' : 'grab' }}>
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
