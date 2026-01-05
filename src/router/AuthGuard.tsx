/**
 * 路由守卫组件
 * 未登录用户将被重定向到登录页
 * 菜单数据已在 App.tsx 启动流程中预加载
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useMenuStore } from '../stores/menuStore';

interface AuthGuardProps {
  children: React.ReactNode;
  isAuthenticated: boolean;
}

const AuthGuard = ({ children, isAuthenticated }: AuthGuardProps) => {
  const location = useLocation();
  const { menuList } = useMenuStore();

  // 未登录，跳转到登录页
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 菜单数据应该已在启动流程中加载完成
  // 如果没有菜单数据，说明可能是异常情况，显示简单的加载状态
  if (!menuList) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>加载中...</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthGuard;
