/**
 * 顶部导航栏组件
 * 仅保留折叠按钮、主题切换和用户菜单
 */

import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useAppStore } from '../../stores/appStore';
import { Sun, Moon, LogOut, ChevronLeft, ChevronRight, User, ListTodo } from 'lucide-react';
import { getUserAvatar } from '../../services/storage';
import MessageCenter from '../MessageCenter';
import TaskCenter from '../TaskCenter';
import ProfileDrawer from '../ProfileDrawer';
import './Header.css';

interface HeaderProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const Header = ({ collapsed, onToggleCollapse }: HeaderProps) => {
  const { user, userName } = useAuthStore();
  const { theme, toggleTheme } = useAppStore();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [taskCenterVisible, setTaskCenterVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 加载头像
  useEffect(() => {
    if (userName) {
      setAvatarUrl(getUserAvatar(userName));
    }
  }, [userName]);

  // ProfileDrawer 关闭时刷新头像
  const handleProfileClose = () => {
    setProfileVisible(false);
    if (userName) {
      setAvatarUrl(getUserAvatar(userName));
    }
  };

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setDropdownVisible(false);
    // 将用户主题保存到登录页本地状态
    localStorage.setItem('login-theme', theme);
    // 立即跳转，让动画页面处理退出逻辑
    window.location.href = '/login?from=logout';
  };

  const handleProfile = () => {
    setDropdownVisible(false);
    setProfileVisible(true);
  };

  const handleTaskCenter = () => {
    setDropdownVisible(false);
    setTaskCenterVisible(true);
  };

  const getInitial = () => {
    // 优先使用 nick_name，没有则用 userName
    const nickName = user?.nick_name;
    const name = nickName || userName || '';
    return name.charAt(0) || 'U';
  };

  // 显示名称
  const displayName = user?.nick_name || userName || '用户';

  return (
    <header className="app-header">
      <div className="header-left">
        {onToggleCollapse && (
          <button className="collapse-btn" onClick={onToggleCollapse}>
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        )}
      </div>

      <div className="header-right">
        <button className="theme-btn" onClick={toggleTheme} title={theme === 'light' ? '切换暗色模式' : '切换亮色模式'}>
          {theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        
        <MessageCenter />
        
        <div className="user-dropdown" ref={dropdownRef}>
          <div className="user-info" onClick={() => setDropdownVisible(!dropdownVisible)}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="头像" className="user-avatar-img" />
            ) : (
              <div className="user-avatar">{getInitial()}</div>
            )}
            <span className="user-name">{displayName}</span>
          </div>
          
          {dropdownVisible && (
            <div className="dropdown-menu">
              <div className="dropdown-item" onClick={handleProfile}>
                <User size={16} />
                <span>个人信息</span>
              </div>
              <div className="dropdown-item" onClick={handleTaskCenter}>
                <ListTodo size={16} />
                <span>任务中心</span>
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-item danger" onClick={handleLogout}>
                <LogOut size={16} />
                <span>退出登录</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <TaskCenter visible={taskCenterVisible} onClose={() => setTaskCenterVisible(false)} />
      <ProfileDrawer visible={profileVisible} onClose={handleProfileClose} />
    </header>
  );
};

export default Header;
