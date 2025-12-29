/**
 * 路由守卫组件
 * 未登录用户将被重定向到登录页
 * 已登录用户自动获取菜单数据和用户权限
 */

import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMenuStore } from '../stores/menuStore';
import { useAuthStore } from '../stores/authStore';

interface AuthGuardProps {
  children: React.ReactNode;
  isAuthenticated: boolean;
}

const AuthGuard = ({ children, isAuthenticated }: AuthGuardProps) => {
  const location = useLocation();
  const { menuList, fetchUserMenus } = useMenuStore();
  const { fetchProfile } = useAuthStore();
  const [isLoadingMenus, setIsLoadingMenus] = useState(false);

  useEffect(() => {
    // 已登录但没有菜单数据时，获取菜单和用户权限
    if (isAuthenticated && !menuList && !isLoadingMenus) {
      setIsLoadingMenus(true);
      Promise.all([
        fetchUserMenus(),
        fetchProfile()
      ])
        .catch((error) => {
          console.error('获取菜单/权限失败:', error);
        })
        .finally(() => {
          setIsLoadingMenus(false);
        });
    }
  }, [isAuthenticated, menuList, fetchUserMenus, fetchProfile, isLoadingMenus]);

  // 未登录，跳转到登录页
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 正在加载菜单
  if (isLoadingMenus || (!menuList && isAuthenticated)) {
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
