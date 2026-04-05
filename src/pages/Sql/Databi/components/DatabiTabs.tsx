/**
 * BI 查询标签页组件
 */

import { useRef, useState, useEffect } from 'react';

interface Tab {
  id: string;
  name: string;
}

interface DatabiTabsProps {
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
  onAddTab: () => void;
  onTabsReorder?: (tabs: Tab[]) => void;
}

export const DatabiTabs = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onAddTab,
  onTabsReorder
}: DatabiTabsProps) => {
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [dragOverTab, setDragOverTab] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTab(tabId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    if (draggedTab && draggedTab !== tabId) {
      setDragOverTab(tabId);
    }
  };

  const handleDragEnd = () => {
    if (draggedTab && dragOverTab && draggedTab !== dragOverTab && onTabsReorder) {
      const draggedIndex = tabs.findIndex(t => t.id === draggedTab);
      const targetIndex = tabs.findIndex(t => t.id === dragOverTab);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newTabs = [...tabs];
        const [removed] = newTabs.splice(draggedIndex, 1);
        newTabs.splice(targetIndex, 0, removed);
        onTabsReorder(newTabs);
      }
    }
    
    setDraggedTab(null);
    setDragOverTab(null);
  };

  return (
    <div className="databi-tabs-container">
      <div className="databi-tabs" ref={tabsRef}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`databi-tab ${activeTabId === tab.id ? 'active' : ''} ${dragOverTab === tab.id ? 'drag-over' : ''}`}
            draggable
            onDragStart={(e) => handleDragStart(e, tab.id)}
            onDragOver={(e) => handleDragOver(e, tab.id)}
            onDragEnd={handleDragEnd}
            onClick={() => onTabClick(tab.id)}
          >
            <span className="tab-name">{tab.name}</span>
            {tabs.length > 1 && (
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button className="add-tab-btn" onClick={onAddTab} title="新建标签页">
          +
        </button>
      </div>
    </div>
  );
};
