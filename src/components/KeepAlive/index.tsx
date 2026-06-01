/**
 * 页面缓存组件
 * 类似 Vue 的 keep-alive，缓存已访问的页面，切换时不重新渲染
 */

import { useRef, useEffect, ReactElement, memo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMenuStore } from '../../stores/menuStore';

interface CacheItem {
  path: string;
  element: ReactElement;
}

interface KeepAliveProps {
  children: ReactElement;
  /** 最大缓存数量 */
  maxCache?: number;
}

const KeepAlive = memo(({ children, maxCache = 10 }: KeepAliveProps) => {
  const location = useLocation();
  const { visitedViews } = useMenuStore();
  const cacheRef = useRef<Map<string, CacheItem>>(new Map());
  const [, forceUpdate] = useState(0);
  const currentPath = location.pathname;

  // 已打开标签页的路径集合（用于判断哪些缓存该保留）
  const visitedPaths = new Set(visitedViews.map(v => v.path));

  // 更新缓存
  useEffect(() => {
    const cache = cacheRef.current;
    
    // 只有当页面不在缓存中时才添加
    if (!cache.has(currentPath)) {
      if (cache.size >= maxCache) {
        const firstKey = cache.keys().next().value;
        if (firstKey) cache.delete(firstKey);
      }
      cache.set(currentPath, { path: currentPath, element: children });
      forceUpdate(n => n + 1);
    }

    // 清理不在 visitedViews 中的缓存（已关闭的标签页）
    let needUpdate = false;
    cache.forEach((_, key) => {
      if (key === currentPath) return;
      if (!visitedPaths.has(key)) {
        cache.delete(key);
        needUpdate = true;
      }
    });
    if (needUpdate) forceUpdate(n => n + 1);
  }, [currentPath, visitedViews, maxCache]);

  // 渲染所有缓存的页面，当前页面显示，其他隐藏
  return (
    <>
      {Array.from(cacheRef.current.entries()).map(([path, item]) => (
        <div
          key={path}
          style={{
            display: path === currentPath ? 'block' : 'none',
            height: '100%',
          }}
        >
          {item.element}
        </div>
      ))}
    </>
  );
});

KeepAlive.displayName = 'KeepAlive';

export default KeepAlive;
