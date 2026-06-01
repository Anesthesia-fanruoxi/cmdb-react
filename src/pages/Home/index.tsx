/**
 * 主页布局
 * 包含 Sidebar、Header、TagsView 和内容区
 */

import { useState, Suspense, lazy, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Layout/Sidebar';
import Content from '../../components/Layout/Content';
import TagsView from '../../components/Layout/TagsView';
import KeepAlive from '../../components/KeepAlive';
import { useMenuStore } from '../../stores/menuStore';
import { usePageStateStore } from '../../stores/pageStateStore';
import { saveCurrentRoute } from '../../services/storage/routeManager';
import Dashboard from './Dashboard';
import FloatingActions from '../../components/FloatingActions';
import './style.css';

// 懒加载页面组件 - 使用 eager: false 确保懒加载
const pageModules = import.meta.glob('../**/index.tsx') as Record<string, () => Promise<{ default: React.ComponentType }>>;

// 页面组件缓存
const pageCache = new Map<string, React.LazyExoticComponent<React.ComponentType>>();

// 加载页面组件
const loadPage = (path: string) => {
  // 检查缓存
  if (pageCache.has(path)) {
    return pageCache.get(path)!;
  }

  // 路径映射: /system/setting -> ../System/Setting/index.tsx
  const parts = path.split('/').filter(Boolean);
  const modulePath = `../${parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('/')}/index.tsx`;
  
  if (pageModules[modulePath]) {
    const LazyComponent = lazy(pageModules[modulePath]);
    pageCache.set(path, LazyComponent);
    return LazyComponent;
  }
  return null;
};

const Home = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { menuList } = useMenuStore();
  const { lastRoute, _hasHydrated, setLastRoute } = usePageStateStore();
  const hasRedirected = useRef(false);

  // 自动跳转到最后访问的页面
  useEffect(() => {
    if (!_hasHydrated || hasRedirected.current) return;
    hasRedirected.current = true;

    // 如果有保存的路由且不是当前路由，则跳转
    if (lastRoute && lastRoute !== location.pathname && lastRoute !== '/') {
      navigate(lastRoute, { replace: true });
    }
  }, [_hasHydrated, lastRoute, location.pathname, navigate]);

  // 保存当前路由
  useEffect(() => {
    if (_hasHydrated && location.pathname !== '/') {
      setLastRoute(location.pathname);
      saveCurrentRoute(location.pathname); // 防抖 1 秒保存路由状态
    }
  }, [_hasHydrated, location.pathname, setLastRoute]);

  // 获取当前页面标题
  const getPageTitle = (): string => {
    const findTitle = (menus: typeof menuList, path: string): string => {
      if (!menus) return '';
      for (const menu of menus) {
        if (menu.path === path) return menu.meta?.title || menu.name;
        if (menu.children) {
          const title = findTitle(menu.children, path);
          if (title) return title;
        }
      }
      return '';
    };
    return findTitle(menuList, location.pathname) || '首页';
  };

  // 渲染页面内容
  const renderContent = () => {
    const path = location.pathname;
    
    // 首页/仪表盘
    if (path === '/' || path === '/dashboard') {
      return <Dashboard />;
    }

    // 动态加载其他页面
    const PageComponent = loadPage(path);
    if (PageComponent) {
      return (
        <Suspense fallback={<div className="page-loading">加载中...</div>}>
          <PageComponent />
        </Suspense>
      );
    }

    return <div className="page-404">页面不存在</div>;
  };

  return (
    <div className="home-layout">
      <Sidebar collapsed={collapsed} />
      <div className={`main-container ${collapsed ? 'collapsed' : ''}`}>
        <TagsView 
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />
        <Content title={getPageTitle()}>
          <KeepAlive>
            {renderContent()}
          </KeepAlive>
        </Content>
      </div>
      <FloatingActions />
    </div>
  );
};

export default Home;
