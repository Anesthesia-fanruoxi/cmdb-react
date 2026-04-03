/**
 * 标签页导航组件
 * 支持拖拽排序
 */

import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMenuStore } from '../../stores/menuStore';
import type { TagView } from '../../types/menu';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './TagsView.css';

interface TagsViewProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const TagsView = ({ collapsed, onToggleCollapse }: TagsViewProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { visitedViews, delVisitedView, delOtherViews, delAllViews, addVisitedView, menuList, reorderViews } = useMenuStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // 拖拽状态
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    tag: TagView | null;
  }>({ visible: false, x: 0, y: 0, tag: null });



  // 根据路径查找菜单标题
  const findMenuTitle = (path: string): string => {
    if (path === '/' || path === '/dashboard') return '首页';
    const search = (menus: typeof menuList): string => {
      if (!menus) return '';
      for (const menu of menus) {
        if (menu.path === path) return menu.meta?.title || menu.name;
        if (menu.children) {
          const title = search(menu.children);
          if (title) return title;
        }
      }
      return '';
    };
    return search(menuList) || path.split('/').pop() || '页面';
  };

  // 监听路由变化，自动添加标签
  useEffect(() => {
    let path = location.pathname;
    if (path === '/login') return;
    if (path === '/') path = '/dashboard';
    
    // 使用 ref 来追踪当前路径，避免闭包问题
    // 同时利用 addVisitedView 内部的去重检查
    const title = findMenuTitle(path);
    addVisitedView({
      path,
      name: path,
      title,
      meta: { title, affix: path === '/dashboard' },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // 拖拽开始
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  // 拖拽经过
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex !== null && index !== dragIndex) {
      setDragOverIndex(index);
    }
  };

  // 拖拽离开
  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  // 放置
  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== toIndex) {
      reorderViews(dragIndex, toIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // 拖拽结束
  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // 点击标签
  const handleClick = (tag: TagView) => {
    if (tag.path !== location.pathname) navigate(tag.path);
  };

  // 关闭标签
  const handleClose = (e: React.MouseEvent, tag: TagView) => {
    e.stopPropagation();
    if (tag.meta?.affix) {
      return;
    }

    if (tag.path === location.pathname) {
      const index = visitedViews.findIndex(v => v.path === tag.path);
      
      // 优先显示右边的标签，如果是最后一个则显示左边的
      let nextTag: TagView | undefined;
      if (index < visitedViews.length - 1) {
        // 不是最后一个，显示右边的
        nextTag = visitedViews[index + 1];
      } else if (index > 0) {
        // 是最后一个，显示左边的
        nextTag = visitedViews[index - 1];
      }
      
      // 先跳转到下一个标签，再删除当前标签
      // 这样可以避免 useEffect 在删除后重新添加当前路径
      if (nextTag) {
        navigate(nextTag.path);
      } else {
        navigate('/dashboard');
      }
      
      // 导航后再删除标签
      delVisitedView(tag);
    } else {
      delVisitedView(tag);
    }
  };

  // 右键菜单
  const handleContextMenu = (e: React.MouseEvent, tag: TagView) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, tag });
  };

  // 菜单操作
  const handleMenuAction = (action: string) => {
    const { tag } = contextMenu;
    setContextMenu({ visible: false, x: 0, y: 0, tag: null });
    if (!tag) return;

    switch (action) {
      case 'close':
        if (!tag.meta?.affix) {
          const index = visitedViews.findIndex(v => v.path === tag.path);
          
          if (tag.path === location.pathname) {
            // 关闭当前标签，优先显示右边的，如果是最后一个则显示左边的
            let nextTag: TagView | undefined;
            if (index < visitedViews.length - 1) {
              nextTag = visitedViews[index + 1];
            } else if (index > 0) {
              nextTag = visitedViews[index - 1];
            }
            
            if (nextTag) {
              navigate(nextTag.path);
            } else {
              navigate('/dashboard');
            }
          }
          
          delVisitedView(tag);
        }
        break;
      case 'closeOthers':
        delOtherViews(tag);
        if (tag.path !== location.pathname) navigate(tag.path);
        break;
      case 'closeAll':
        delAllViews();
        navigate('/dashboard');
        break;
    }
  };

  // 点击外部关闭右键菜单
  useEffect(() => {
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.tags-context-menu')) {
        setContextMenu(m => ({ ...m, visible: false }));
      }
    };
    if (contextMenu.visible) document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [contextMenu.visible]);

  // 滚动到当前标签
  useEffect(() => {
    const scrollToActive = () => {
      const el = scrollRef.current?.querySelector('.tag-item.active');
      el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    };
    scrollToActive();
  }, [location.pathname]);

  // 窗口大小变化时也滚动到当前标签
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const scrollToActive = () => {
      const el = container.querySelector('.tag-item.active');
      el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    };

    // 使用 ResizeObserver 监听容器大小变化
    const resizeObserver = new ResizeObserver(() => {
      scrollToActive();
    });
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // 鼠标滚轮横向滚动
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div className="tags-view">
      {/* 左侧：折叠按钮 */}
      <div className="tags-left">
        {onToggleCollapse && (
          <button className="collapse-btn" onClick={onToggleCollapse}>
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        )}
      </div>

      {/* 标签页 */}
      <div className="tags-scroll" ref={scrollRef}>
        {visitedViews.map((tag, index) => (
          <div
            key={tag.path}
            draggable
            onDragStart={e => handleDragStart(e, index)}
            onDragOver={e => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`tag-item ${tag.path === location.pathname ? 'active' : ''} ${dragIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
            onClick={() => handleClick(tag)}
            onContextMenu={e => handleContextMenu(e, tag)}
          >
            {tag.path === location.pathname && <span className="tag-dot" />}
            <span className="tag-text">{tag.title || tag.meta?.title}</span>
            {!tag.meta?.affix && (
              <span className="tag-close" onClick={e => handleClose(e, tag)}>×</span>
            )}
          </div>
        ))}
      </div>

      {/* 右键菜单 */}
      {contextMenu.visible && (
        <ul className="tags-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {!contextMenu.tag?.meta?.affix && (
            <li onClick={() => handleMenuAction('close')}>关闭</li>
          )}
          <li onClick={() => handleMenuAction('closeOthers')}>关闭其他</li>
          <li onClick={() => handleMenuAction('closeAll')}>关闭所有</li>
        </ul>
      )}
    </div>
  );
};

export default TagsView;
