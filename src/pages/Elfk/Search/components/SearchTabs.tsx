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
  tabs,
  activeTabId,
  onTabChange,
  onAddTab,
  onCloseTab,
  onDuplicateTab,
  onTabsReorder,
  onTabDetach
}: SearchTabsProps) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // 开始拖拽
  const handleDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    setDraggedId(tabId);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
    
    const target = e.currentTarget as HTMLElement;
    if (target) {
      e.dataTransfer.setDragImage(target, target.offsetWidth / 2, target.offsetHeight / 2);
    }
  }, []);

  // 拖拽经过
  const handleDragOver = useCallback((e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedId && tabId !== draggedId) {
      setDragOverId(tabId);
    }
  }, [draggedId]);

  // 拖拽离开
  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  // 放置
  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    
    if (!draggedId || draggedId === targetId || !onTabsReorder) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const draggedIndex = tabs.findIndex(t => t.id === draggedId);
    const targetIndex = tabs.findIndex(t => t.id === targetId);
    
    if (draggedIndex !== -1 && targetIndex !== -1) {
      const newTabs = [...tabs];
      const [removed] = newTabs.splice(draggedIndex, 1);
      newTabs.splice(targetIndex, 0, removed);
      onTabsReorder(newTabs.map(t => ({ id: t.id, name: t.name })));
    }

    setDraggedId(null);
    setDragOverId(null);
  }, [draggedId, tabs, onTabsReorder]);

  // 拖拽结束
  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const startPos = dragStartPos.current;
    const container = tabsContainerRef.current;
    
    if (startPos && container && draggedId && onTabDetach) {
      const containerRect = container.getBoundingClientRect();
      const endX = e.clientX;
      const endY = e.clientY;
      
      // 检查是否拖出了标签栏区域
      const isOutside = 
        endY > containerRect.bottom + 50 ||
        endY < containerRect.top - 50 ||
        endX < containerRect.left - 100 ||
        endX > containerRect.right + 100;
      
      if (isOutside) {
        const tab = tabs.find(t => t.id === draggedId);
        if (tab) {
          onTabDetach({ id: tab.id, name: tab.name });
        }
      }
    }
    
    setDraggedId(null);
    setDragOverId(null);
    dragStartPos.current = null;
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
              <button
                className="tab-close"
                onClick={e => { e.stopPropagation(); onCloseTab(tab.id); }}
              >
                ×
              </button>
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
