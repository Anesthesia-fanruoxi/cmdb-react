/**
 * 路由配置
 * 支持静态路由和动态路由
 */

import { createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import AuthGuard from './AuthGuard';

// 懒加载组件包装器
const LazyComponent = ({ component: Component }: { component: React.LazyExoticComponent<React.ComponentType> }) => (
  <Suspense fallback={<div className="loading-container"><div className="loading-spinner" /><p>加载中...</p></div>}>
    <Component />
  </Suspense>
);

// 动态导入页面组件
const pageModules = import.meta.glob('../pages/**/index.tsx');

// 懒加载 Login 和 Home
const Login = lazy(() => import('../pages/Login'));
const Home = lazy(() => import('../pages/Home'));

// 预加载 Home 组件（供启动流程调用）
export const preloadHome = () => import('../pages/Home');

// 强制双因子认证页面（独立页面，不在主布局内）
const ForceTwoFactor = lazy(() => import('../pages/ForceTwoFactor'));

// 根据路径加载组件
export const loadComponent = (componentPath: string) => {
  // 转换路径格式: system/setting -> ../pages/System/Setting/index.tsx
  const parts = componentPath.split('/');
  const formattedPath = parts
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('/');
  
  const modulePath = `../pages/${formattedPath}/index.tsx`;
  
  if (pageModules[modulePath]) {
    return lazy(pageModules[modulePath] as () => Promise<{ default: React.ComponentType }>);
  }
  
  console.warn(`组件未找到: ${modulePath}`);
  return null;
};

// 独立窗口页面
const DetachedWindow = lazy(() => import('../pages/Detached'));

/**
 * 创建应用路由
 * @param isAuthenticated 是否已认证
 */
export const createAppRouter = (isAuthenticated: boolean) => {
  return createBrowserRouter([
    {
      path: '/login',
      element: <LazyComponent component={Login} />,
    },
    {
      path: '/force-two-factor',
      element: <LazyComponent component={ForceTwoFactor} />,
    },
    {
      path: '/detached',
      element: <LazyComponent component={DetachedWindow} />,
    },
    {
      path: '/*',
      element: (
        <AuthGuard isAuthenticated={isAuthenticated}>
          <LazyComponent component={Home} />
        </AuthGuard>
      ),
    },
  ]);
};

export { LazyComponent };
export default createAppRouter;
