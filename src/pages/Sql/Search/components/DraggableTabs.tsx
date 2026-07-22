/**
 * 标签页组件
 * 支持：1. 按住横向拖拽滑动标签栏 2. 往下拉摘取标签、跟随鼠标拖拽排序
 *       3. 滚轮横向滚动 4. 双击重命名
 *       5. 右键菜单（复制/重命名/独立窗口/删除/新增）
 */

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';

interface Tab {
  id: string;
  name: string;
}

interface ContextMenu {
  tabId: string;
  x: number;
  y: number;
}

/** 拖拽幽灵（跟随鼠标的悬浮标签） */
interface GhostState {
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
}

interface Props {
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabsReorder: (tabs: Tab[]) => void;
  onTabDetach: (tab: Tab) => void;
  onAddTab: () => void;
  onShowHistory: () => void;
  onShowSettings?: () => void;
  onTabRename: (id: string, name: string) => void;
  onTabDuplicate: (id: string) => void;
}

const DRAG_THRESHOLD = 5;

const DraggableTabs = ({
  tabs, activeTabId, onTabClick, onTabClose, onTabsReorder, onTabDetach,
  onAddTab, onShowHistory, onShowSettings, onTabRename, onTabDuplicate
}: Props) => {
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  // 摘取的标签 id 与跟随鼠标的幽灵
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<GhostState | null>(null);

  // 鼠标交互状态：点击 / 横向滑动 / 下拉摘取排序
  const mouseState = useRef<{
    tabId: string | null;
    startX: number;
    startY: number;
    mode: 'pending' | 'scroll' | 'reorder' | 'none';
    scrollStartLeft: number;
    grabOffsetX: number;
    grabOffsetY: number;
  }>({ tabId: null, startX: 0, startY: 0, mode: 'none', scrollStartLeft: 0, grabOffsetX: 0, grabOffsetY: 0 });

  // 手动双击检测（因为拖拽会抑制原生 dblclick）
  const lastClickRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });
  // FLIP 动画：记录上一次各标签的位置
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // 滚轮横向滚动
  useEffect(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth > el.clientWidth) {
        e.preventDefault();
        el.scrollLeft += e.deltaY || e.deltaX;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // FLIP：排序后让其他标签平滑滑动到新位置
  useLayoutEffect(() => {
    const container = tabsContainerRef.current;
    if (!container) return;
    const els = Array.from(container.querySelectorAll<HTMLElement>('.tab-item'));
    if (draggedId) {
      els.forEach(el => {
        const id = el.getAttribute('data-tab-id');
        if (!id || id === draggedId) return; // 占位框不做动画
        const prev = prevRectsRef.current.get(id);
        const now = el.getBoundingClientRect();
        if (prev) {
          const dx = prev.left - now.left;
          if (Math.abs(dx) > 1) {
            el.animate(
              [{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }],
              { duration: 180, easing: 'ease-out' }
            );
          }
        }
      });
    }
    const next = new Map<string, DOMRect>();
    els.forEach(el => {
      const id = el.getAttribute('data-tab-id');
      if (id) next.set(id, el.getBoundingClientRect());
    });
    prevRectsRef.current = next;
  }, [tabs, draggedId]);

  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ tabId, x: e.clientX, y: e.clientY });
  }, []);

  const startRename = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    setContextMenu(null);
    setEditingId(tabId);
    setEditingName(tab.name);
  }, [tabs]);

  const commitRename = useCallback(() => {
    if (editingId && editingName.trim()) {
      onTabRename(editingId, editingName.trim());
    }
    setEditingId(null);
  }, [editingId, editingName, onTabRename]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') setEditingId(null);
  }, [commitRename]);

  // ─── 鼠标交互：点击 / 横向滑动 / 下拉摘取排序 ─────────────────────────
  const handleTabMouseDown = useCallback((e: React.MouseEvent, tabId: string) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.tab-close')) return;
    mouseState.current = {
      tabId, startX: e.clientX, startY: e.clientY,
      mode: 'pending', scrollStartLeft: tabsContainerRef.current?.scrollLeft ?? 0,
      grabOffsetX: 0, grabOffsetY: 0
    };

    const onMouseMove = (ev: MouseEvent) => {
      const st = mouseState.current;
      if (st.mode === 'none') return;
      const dx = ev.clientX - st.startX;
      const dy = ev.clientY - st.startY;

      if (st.mode === 'pending') {
        if (Math.abs(dx) > DRAG_THRESHOLD && Math.abs(dx) >= Math.abs(dy)) {
          // 横向为主 → 滑动标签栏
          st.mode = 'scroll';
          document.body.style.cursor = 'grabbing';
          document.body.style.userSelect = 'none';
        } else if (dy > DRAG_THRESHOLD && dy > Math.abs(dx)) {
          // 向下为主 → 摘取标签
          const container = tabsContainerRef.current;
          const el = container?.querySelector<HTMLElement>(`[data-tab-id="${st.tabId}"]`);
          if (el && st.tabId) {
            const rect = el.getBoundingClientRect();
            st.grabOffsetX = st.startX - rect.left;
            st.grabOffsetY = st.startY - rect.top;
            st.mode = 'reorder';
            setDraggedId(st.tabId);
            setGhost({
              x: ev.clientX - st.grabOffsetX,
              y: ev.clientY - st.grabOffsetY,
              w: rect.width,
              h: rect.height,
              name: tabsRef.current.find(t => t.id === st.tabId)?.name || ''
            });
            document.body.style.userSelect = 'none';
          }
        } else {
          return; // 未超过阈值
        }
      }

      if (st.mode === 'scroll') {
        const container = tabsContainerRef.current;
        if (container) container.scrollLeft = st.scrollStartLeft - dx;
      } else if (st.mode === 'reorder' && st.tabId) {
        // 幽灵跟随鼠标
        setGhost(prev => (prev ? { ...prev, x: ev.clientX - st.grabOffsetX, y: ev.clientY - st.grabOffsetY } : prev));
        // 占据相邻标签 80% 宽度时才交换位置
        const container = tabsContainerRef.current;
        if (!container) return;
        const tabEls = Array.from(container.querySelectorAll<HTMLElement>('.tab-item'));
        const placeholder = tabEls.find(el => el.getAttribute('data-tab-id') === st.tabId);
        const ghostW = placeholder?.getBoundingClientRect().width ?? 0;
        const ghostLeft = ev.clientX - st.grabOffsetX;
        const ghostRight = ghostLeft + ghostW;
        const currentIdx = tabsRef.current.findIndex(t => t.id === st.tabId);
        if (currentIdx === -1) return;

        // 右侧邻居：幽灵覆盖其 80% → 交换（旧标签往左移）
        if (currentIdx < tabEls.length - 1) {
          const r = tabEls[currentIdx + 1].getBoundingClientRect();
          if (ghostRight - r.left >= r.width * 0.8) {
            const next = [...tabsRef.current];
            [next[currentIdx], next[currentIdx + 1]] = [next[currentIdx + 1], next[currentIdx]];
            onTabsReorder(next);
            return;
          }
        }
        // 左侧邻居：幽灵覆盖其 80% → 交换（旧标签往右移）
        if (currentIdx > 0) {
          const r = tabEls[currentIdx - 1].getBoundingClientRect();
          if (r.right - ghostLeft >= r.width * 0.8) {
            const next = [...tabsRef.current];
            [next[currentIdx - 1], next[currentIdx]] = [next[currentIdx], next[currentIdx - 1]];
            onTabsReorder(next);
            return;
          }
        }
      }
    };

    const onMouseUp = () => {
      const st = mouseState.current;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (st.mode === 'pending' && st.tabId) {
        // 未超过阈值 → 视为点击
        onTabClick(st.tabId);
        const now = Date.now();
        if (lastClickRef.current.id === st.tabId && now - lastClickRef.current.time < 350) {
          startRename(st.tabId);
          lastClickRef.current = { id: '', time: 0 };
        } else {
          lastClickRef.current = { id: st.tabId, time: now };
        }
      }

      setDraggedId(null);
      setGhost(null);
      mouseState.current = { ...mouseState.current, mode: 'none', tabId: null };
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [onTabClick, onTabsReorder, startRename]);

  return (
    <div className="tabs-header">
      <div className="tabs-list" ref={tabsContainerRef}>
        {tabs.map(tab => {
          const isDragged = draggedId === tab.id;
          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              className={`tab-item ${tab.id === activeTabId ? 'active' : ''} ${isDragged ? 'dragging-placeholder' : ''}`}
              onMouseDown={(e) => { if (editingId !== tab.id && !draggedId) handleTabMouseDown(e, tab.id); }}
              onDragStart={(e) => e.preventDefault()}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
            >
              {editingId === tab.id ? (
                <input
                  ref={inputRef}
                  className="tab-name-input"
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={handleEditKeyDown}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className="tab-name">{tab.name}</span>
              )}
              {tabs.length > 1 && editingId !== tab.id && (
                <span className="tab-close" onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}>×</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="tabs-actions">
        <button className="icon-btn" onClick={onAddTab} title="新建查询">+</button>
        <button className="icon-btn" onClick={onShowHistory} title="历史记录">⏱</button>
        {onShowSettings && (
          <button className="icon-btn" onClick={onShowSettings} title="快捷键设置">⚙</button>
        )}
      </div>

      {/* 拖拽幽灵：摘取后跟随鼠标 */}
      {ghost && (
        <div
          className="tab-ghost"
          style={{ left: ghost.x, top: ghost.y, width: ghost.w, height: ghost.h }}
        >
          <span className="tab-name">{ghost.name}</span>
        </div>
      )}

      {contextMenu && (
        <div
          className="tab-context-menu"
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="tab-context-item" onClick={() => { onTabDuplicate(contextMenu.tabId); setContextMenu(null); }}>
            📋 复制标签页
          </div>
          <div className="tab-context-item" onClick={() => startRename(contextMenu.tabId)}>
            ✏️ 重命名
          </div>
          <div className="tab-context-item" onClick={() => {
            const tab = tabs.find(t => t.id === contextMenu.tabId);
            if (tab) onTabDetach(tab);
            setContextMenu(null);
          }}>
            🪟 独立窗口
          </div>
          <div className="tab-context-item" onClick={() => { onAddTab(); setContextMenu(null); }}>
            ➕ 新增标签页
          </div>
          {tabs.length > 1 && (
            <div className="tab-context-item danger" onClick={() => { onTabClose(contextMenu.tabId); setContextMenu(null); }}>
              🗑️ 删除
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DraggableTabs;
