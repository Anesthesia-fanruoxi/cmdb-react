/**
 * 可拖拽标签页组件
 * 支持：1. 拖拽调整顺序 2. 拖拽到窗口外创建独立窗口
 *       3. 双击重命名 4. 右键菜单（复制/重命名/删除/新增）
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface Tab {
  id: string;
  name: string;
}

interface ContextMenu {
  tabId: string;
  x: number;
  y: number;
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

const DraggableTabs = ({
  tabs, activeTabId, onTabClick, onTabClose, onTabsReorder, onTabDetach,
  onAddTab, onShowHistory, onShowSettings, onTabRename, onTabDuplicate
}: Props) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

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

  // 拖拽
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
    if (!draggedId || draggedId === targetId) { setDraggedId(null); setDragOverId(null); return; }
    const di = tabs.findIndex(t => t.id === draggedId);
    const ti = tabs.findIndex(t => t.id === targetId);
    if (di !== -1 && ti !== -1) {
      const next = [...tabs];
      const [removed] = next.splice(di, 1);
      next.splice(ti, 0, removed);
      onTabsReorder(next);
    }
    setDraggedId(null); setDragOverId(null);
  }, [draggedId, tabs, onTabsReorder]);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const startPos = dragStartPos.current;
    const container = tabsContainerRef.current;
    if (startPos && container && draggedId) {
      const rect = container.getBoundingClientRect();
      const isOutside =
        e.clientY > rect.bottom + 50 || e.clientY < rect.top - 50 ||
        e.clientX < rect.left - 100 || e.clientX > rect.right + 100;
      if (isOutside) {
        const tab = tabs.find(t => t.id === draggedId);
        if (tab) onTabDetach(tab);
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
            draggable={editingId !== tab.id}
            onDragStart={(e) => handleDragStart(e, tab.id)}
            onDragOver={(e) => handleDragOver(e, tab.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, tab.id)}
            onDragEnd={handleDragEnd}
            onClick={() => !editingId && onTabClick(tab.id)}
            onDoubleClick={() => startRename(tab.id)}
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
        ))}
      </div>

      <div className="tabs-actions">
        <button className="icon-btn" onClick={onAddTab} title="新建查询">+</button>
        <button className="icon-btn" onClick={onShowHistory} title="历史记录">⏱</button>
        {onShowSettings && (
          <button className="icon-btn" onClick={onShowSettings} title="快捷键设置">⚙</button>
        )}
      </div>

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
