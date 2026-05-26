/**
 * 浮动快捷操作按钮（FAB）
 * 浮球为 L 形拐角原点，X/Y 轴从浮球生长出来
 * - X 轴：工具快捷入口
 * - Y 轴：自定义快捷菜单（最多 8 个）
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { Wrench, X, Pencil, Check } from 'lucide-react';
import { useMenuStore } from '../../stores/menuStore';
import type { MenuItem } from '../../types/menu';
import './style.css';

const TOOLS = [
  { id: 'password', icon: '🔑', label: '随机密码' },
  { id: 'case',     icon: '🐪', label: '驼峰转换' },
  { id: 'json',     icon: '📋', label: 'JSON' },
  { id: 'cron',     icon: '⏰', label: 'Cron' },
  { id: 'time',     icon: '🕐', label: '时间戳' },
];

const MAX_SHORTCUTS = 8;
const SHORTCUT_KEY = 'cmdb-fab-shortcuts';
const POSITION_KEY = 'cmdb-fab-position';
const FAB_SIZE = 44;
const ITEM_SIZE = 44;   // 子按钮尺寸
const ITEM_GAP = 8;     // 子按钮间距

function loadShortcuts(): string[] {
  try { return JSON.parse(localStorage.getItem(SHORTCUT_KEY) || '[]'); } catch { return []; }
}
function saveShortcuts(v: string[]) {
  try { localStorage.setItem(SHORTCUT_KEY, JSON.stringify(v)); } catch { /* */ }
}
function loadPosition(): { x: number; y: number } | null {
  try { return JSON.parse(localStorage.getItem(POSITION_KEY) || 'null'); } catch { return null; }
}
function savePosition(pos: { x: number; y: number }) {
  try { localStorage.setItem(POSITION_KEY, JSON.stringify(pos)); } catch { /* */ }
}

function flattenMenuLeaves(menus: MenuItem[]): MenuItem[] {
  const result: MenuItem[] = [];
  const walk = (items: MenuItem[]) => {
    for (const item of items) {
      if (item.children?.length) walk(item.children);
      else if (item.path) result.push(item);
    }
  };
  walk(menus);
  return result;
}

/** 根据浮球位置决定 L 形展开方向 */
function getDir(pos: { x: number; y: number }) {
  const xDir = pos.x > window.innerWidth / 2 ? 'left' : 'right';
  const yDir = pos.y > window.innerHeight / 2 ? 'up' : 'down';
  return { xDir, yDir };
}

export default function FloatingActions() {
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editSearch, setEditSearch] = useState('');
  const [shortcuts, setShortcuts] = useState<string[]>(loadShortcuts);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    const saved = loadPosition();
    if (saved) return saved;
    return { x: window.innerWidth - FAB_SIZE - 24, y: 80 };
  });
  const [dragging, setDragging] = useState(false);

  const dragOffset = useRef({ dx: 0, dy: 0 });
  const hasDragged = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { menuList } = useMenuStore();

  const isDashboard = location.pathname === '/' || location.pathname === '/dashboard';
  const { xDir, yDir } = getDir(pos);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEditMode(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // 拖拽
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    hasDragged.current = false;
    dragOffset.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    setDragging(true);
  }, [pos]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      hasDragged.current = true;
      const nx = Math.max(0, Math.min(window.innerWidth - FAB_SIZE, e.clientX - dragOffset.current.dx));
      const ny = Math.max(0, Math.min(window.innerHeight - FAB_SIZE, e.clientY - dragOffset.current.dy));
      setPos({ x: nx, y: ny });
    };
    const onUp = () => {
      setDragging(false);
      setPos(p => { savePosition(p); return p; });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  const handleMainClick = useCallback(() => {
    if (hasDragged.current) return;
    setOpen(o => !o);
    if (open) setEditMode(false);
  }, [open]);

  const openTool = useCallback((toolId: string) => {
    invoke('open_tool_window', { tool: toolId }).catch(() => {});
    setOpen(false);
  }, []);

  const goTo = useCallback((path: string) => {
    navigate(path);
    setOpen(false);
    setEditMode(false);
  }, [navigate]);

  const toggleShortcut = useCallback((path: string) => {
    setShortcuts(prev => {
      if (prev.includes(path)) {
        const next = prev.filter(p => p !== path);
        saveShortcuts(next);
        return next;
      }
      if (prev.length >= MAX_SHORTCUTS) return prev;
      const next = [...prev, path];
      saveShortcuts(next);
      return next;
    });
  }, []);

  const allLeaves = menuList ? flattenMenuLeaves(menuList) : [];
  const shortcutMenus = shortcuts
    .map(path => allLeaves.find(m => m.path === path))
    .filter(Boolean) as MenuItem[];

  if (isDashboard) return null;

  // 子按钮偏移计算
  // X 轴：沿水平方向，step = ITEM_SIZE + ITEM_GAP
  const xStep = ITEM_SIZE + ITEM_GAP;
  // Y 轴：沿垂直方向
  const yStep = ITEM_SIZE + ITEM_GAP;

  // X 轴起始偏移（从浮球边缘开始）
  const xStart = xDir === 'left' ? -(ITEM_SIZE + ITEM_GAP) : (FAB_SIZE + ITEM_GAP);
  // Y 轴起始偏移
  const yStart = yDir === 'up' ? -(ITEM_SIZE + ITEM_GAP) : (FAB_SIZE + ITEM_GAP);

  return (
    <div
      className={`fab-root ${dragging ? 'fab-root--dragging' : ''}`}
      ref={containerRef}
      style={{ left: pos.x, top: pos.y, width: FAB_SIZE, height: FAB_SIZE }}
    >
      {/* 主按钮 */}
      <button
        className={`fab-main ${open ? 'fab-main--open' : ''} ${dragging ? 'fab-main--dragging' : ''}`}
        onMouseDown={onMouseDown}
        onClick={handleMainClick}
        title="快捷工具（拖拽可移动）"
      >
        {open ? <X size={18} /> : <Wrench size={18} />}
      </button>

      {open && (
        <>
          {/* X 轴：工具按钮，从浮球水平生长 */}
          {TOOLS.map((tool, i) => {
            const offset = xDir === 'left'
              ? xStart - i * xStep
              : xStart + i * xStep;
            return (
              <button
                key={tool.id}
                className="fab-child fab-tool-item"
                style={{
                  left: offset,
                  top: 0,
                  animationDelay: `${i * 30}ms`,
                  width: ITEM_SIZE,
                  height: ITEM_SIZE,
                }}
                onClick={() => openTool(tool.id)}
                title={tool.label}
              >
                <span className="fab-tool-icon">{tool.icon}</span>
                <span className="fab-tool-label">{tool.label}</span>
              </button>
            );
          })}

          {/* Y 轴：快捷菜单，从浮球垂直生长 */}
          {!editMode && shortcutMenus.map((menu, i) => {
            const offset = yDir === 'up'
              ? yStart - i * yStep
              : yStart + i * yStep;
            return (
              <button
                key={menu.path}
                className="fab-child fab-shortcut-item"
                style={{
                  top: offset,
                  left: 0,
                  animationDelay: `${i * 25}ms`,
                  height: ITEM_SIZE,
                }}
                onClick={() => goTo(menu.path!)}
                title={menu.meta?.title || menu.name}
              >
                {menu.meta?.title || menu.name}
              </button>
            );
          })}

          {/* 编辑按钮：Y 轴末尾 */}
          {!editMode && (() => {
            const i = shortcutMenus.length;
            const offset = yDir === 'up'
              ? yStart - i * yStep
              : yStart + i * yStep;
            return (
              <button
                key="edit"
                className="fab-child fab-edit-trigger"
                style={{ top: offset, left: 0, height: ITEM_SIZE, animationDelay: `${i * 25}ms` }}
                onClick={() => setEditMode(true)}
                title="编辑快捷菜单"
              >
                <Pencil size={13} />
                {shortcutMenus.length === 0 ? '添加' : '编辑'}
              </button>
            );
          })()}

          {/* 编辑面板：浮在 Y 轴方向 */}
          {editMode && (
            <div
              className="fab-edit-panel"
              style={{
                [yDir === 'up' ? 'bottom' : 'top']: FAB_SIZE + ITEM_GAP,
                [xDir === 'left' ? 'right' : 'left']: 0,
              }}
            >
              <div className="fab-edit-header">
                <span className="fab-edit-title">快捷菜单（已选 {shortcuts.length} / {MAX_SHORTCUTS}）</span>
                <button className="fab-edit-done" onClick={() => { setEditMode(false); setEditSearch(''); }}>
                  <Check size={12} /> 完成
                </button>
              </div>
              <div className="fab-edit-search-wrap">
                <input
                  className="fab-edit-search"
                  placeholder="搜索菜单..."
                  value={editSearch}
                  onChange={e => setEditSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="fab-edit-list">
                {allLeaves.length === 0 && <div className="fab-edit-empty">暂无可用菜单</div>}
                {allLeaves
                  .filter(menu => {
                    const name = (menu.meta?.title || menu.name || '').toLowerCase();
                    return name.includes(editSearch.toLowerCase());
                  })
                  .map(menu => {
                    const checked = shortcuts.includes(menu.path!);
                    const disabled = !checked && shortcuts.length >= MAX_SHORTCUTS;
                    return (
                      <div
                        key={menu.path}
                        className={`fab-edit-item ${checked ? 'fab-edit-item--selected' : ''} ${disabled ? 'fab-edit-item--disabled' : ''}`}
                        onClick={() => !disabled && toggleShortcut(menu.path!)}
                      >
                        <span>{menu.meta?.title || menu.name}</span>
                        {checked && <Check size={12} className="fab-edit-check" />}
                      </div>
                    );
                  })
                }
                {editSearch && allLeaves.filter(m => (m.meta?.title || m.name || '').toLowerCase().includes(editSearch.toLowerCase())).length === 0 && (
                  <div className="fab-edit-empty">无匹配结果</div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
