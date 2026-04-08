/**
 * 搜索标签页组件（支持拖拽排序和分离）
 */

import { useState, useRef, useCallback } from 'react';
import type { TabData } from '../index';

interface Tab {
  id: string;
  name: string;
}

interface SearchTabsProps {
  tabs: TabData[];
  activeTabId: string;
  onTabChange: (id: string) => void;
  onAddTab: () => void;
  onCloseTab: (id: string) => void;
  onDuplicateTab: (id: string) => void;
  onTabsReorder?: (tabs: Tab[]) => void;
  onTabDetach?: (tab: Tab) => void;
}

const SearchTabs = ({
  tabs, activeTabId, onTabChange, onAddTab, onCloseTab,
  onDuplicateTab, onTabsReorder, onTabDetach
}: SearchTabsProps) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    setDraggedId(tabId);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
    const target = e.currentTarget as HTMLElement;
    if (target) e.dataTransfer.setDragImage(target, target.offsetWidth / 2, target.offsetHeight / 2);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedId && tabId !== draggedId) setDragOverId(tabId);
  }, [draggedId]);

  const handleDragLeave = useCallback(() => setDragOverId(null), []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId || !onTabsReorder) { setDraggedId(null); setDragOverId(null); return; }
    const di = tabs.findIndex(t => t.id === draggedId);
    const ti = tabs.findIndex(t => t.id === targetId);
    if (di !== -1 && ti !== -1) {
      const next = [...tabs];
      const [removed] = next.splice(di, 1);
      next.splice(ti, 0, removed);
      onTabsReorder(next.map(t => ({ id: t.id, name: t.name })));
    }
    setDraggedId(null); setDragOverId(null);
  }, [draggedId, tabs, onTabsReorder]);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const startPos = dragStartPos.current;
    const container = tabsContainerRef.current;
    if (startPos && container && draggedId && onTabDetach) {
      const rect = container.getBoundingClientRect();
      const isOutside =
        e.clientY > rect.bottom + 50 || e.clientY < rect.top - 50 ||
        e.clientX < rect.left - 100 || e.clientX > rect.right + 100;
      if (isOutside) {
        const tab = tabs.find(t => t.id === draggedId);
        if (tab) onTabDetach({ id: tab.id, name: tab.name });
      }
    }
    setDraggedId(null); setDragOverId(null); dragStartPos.current = null;
  }, [draggedId, tabs, onTabDetach]);

  return (
    <div className="tabs-header">
      <div className="tabs-list" ref={tabsContainerRef}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab-item ${tab.id === activeTabId ? 'active' : ''} ${draggedId === tab.id ? 'dragging' : ''} ${dragOverId === tab.id ? 'drag-over' : ''}`}
            draggable
            onDragStart={(e) => handleDragStart(e, tab.id)}
            onDragOver={(e) => handleDragOver(e, tab.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, tab.id)}
            onDragEnd={handleDragEnd}
            onClick={() => onTabChange(tab.id)}
            onDoubleClick={() => onDuplicateTab(tab.id)}
          >
            <span className="tab-name">{tab.name}</span>
            {tabs.length > 1 && (
              <button className="tab-close" onClick={e => { e.stopPropagation(); onCloseTab(tab.id); }}>×</button>
            )}
          </div>
        ))}
      </div>
      <button className="add-tab-btn" onClick={onAddTab}>+</button>
      <span className="tabs-tip">双击复制 | 拖出分离</span>
    </div>
  );
};

export default SearchTabs;
