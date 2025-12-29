/**
 * 可拖拽标签页组件
 * 支持：1. 拖拽调整顺序 2. 拖拽到窗口外创建独立窗口
 */

import { useState, useRef, useCallback } from 'react';

interface Tab {
  id: string;
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
}

const DraggableTabs = ({
  tabs, activeTabId, onTabClick, onTabClose, onTabsReorder, onTabDetach, onAddTab, onShowHistory
}: Props) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // 开始拖拽
  const handleDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    setDraggedId(tabId);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    
    // 设置拖拽数据
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
    
    // 设置拖拽图像
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
    
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    // 重新排序
    const draggedIndex = tabs.findIndex(t => t.id === draggedId);
    const targetIndex = tabs.findIndex(t => t.id === targetId);
    
    if (draggedIndex !== -1 && targetIndex !== -1) {
      const newTabs = [...tabs];
      const [removed] = newTabs.splice(draggedIndex, 1);
      newTabs.splice(targetIndex, 0, removed);
      onTabsReorder(newTabs);
    }

    setDraggedId(null);
    setDragOverId(null);
  }, [draggedId, tabs, onTabsReorder]);

  // 拖拽结束
  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const startPos = dragStartPos.current;
    const container = tabsContainerRef.current;
    
    if (startPos && container && draggedId) {
      const containerRect = container.getBoundingClientRect();
      const endX = e.clientX;
      const endY = e.clientY;
      
      // 检查是否拖出了标签栏区域（向下拖出超过 50px 或向左右拖出）
      const isOutside = 
        endY > containerRect.bottom + 50 ||
        endY < containerRect.top - 50 ||
        endX < containerRect.left - 100 ||
        endX > containerRect.right + 100;
      
      if (isOutside) {
        const tab = tabs.find(t => t.id === draggedId);
        if (tab) {
          onTabDetach(tab);
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
            onClick={() => onTabClick(tab.id)}
          >
            <span className="tab-name">{tab.name}</span>
            {tabs.length > 1 && (
              <span 
                className="tab-close" 
                onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}
              >
                ×
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="tabs-actions">
        <button className="icon-btn" onClick={onAddTab} title="新建查询">+</button>
        <button className="icon-btn" onClick={onShowHistory} title="历史记录">⏱</button>
      </div>
    </div>
  );
};

export default DraggableTabs;
