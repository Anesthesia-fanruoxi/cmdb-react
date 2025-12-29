/**
 * 页面缓存组件
 * 类似 Vue 的 keep-alive，缓存已访问的页面，切换时不重新渲染
 */

import { useRef, useEffect, ReactElement, memo } from 'react';
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
  const { cachedViews } = useMenuStore();
  const cacheRef = useRef<Map<string, CacheItem>>(new Map());
  const currentPath = location.pathname;

  // 更新缓存
  useEffect(() => {
    const cache = cacheRef.current;
    
    // 添加当前页面到缓存
    if (!cache.has(currentPath)) {
      // 超出最大缓存数量时，删除最早的
      if (cache.size >= maxCache) {
        const firstKey = cache.keys().next().value;
        if (firstKey) cache.delete(firstKey);
      }
      cache.set(currentPath, { path: currentPath, element: children });
    } else {
      // 更新已有缓存的元素
      cache.set(currentPath, { path: currentPath, element: children });
    }

    // 清理不在 cachedViews 中的缓存（被关闭的标签）
    cache.forEach((_, key) => {
      const shouldCache = cachedViews.includes(key) || key === currentPath || key === '/' || key === '/dashboard';
      if (!shouldCache) {
        cache.delete(key);
      }
    });
  }, [currentPath, children, cachedViews, maxCache]);

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
