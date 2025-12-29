/**
 * 顶部导航栏组件
 * 仅保留折叠按钮、主题切换和用户菜单
 */

import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useAppStore } from '../../stores/appStore';
import { Sun, Moon, LogOut, ChevronLeft, ChevronRight, User, ListTodo } from 'lucide-react';
import MessageCenter from '../MessageCenter';
import TaskCenter from '../TaskCenter';
import ProfileDrawer from '../ProfileDrawer';
import './Header.css';

interface HeaderProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const Header = ({ collapsed, onToggleCollapse }: HeaderProps) => {
  const { userName, logout } = useAuthStore();
  const { theme, toggleTheme } = useAppStore();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [taskCenterVisible, setTaskCenterVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleLogout = async () => {
    setDropdownVisible(false);
    try {
      await logout();
      window.location.href = '/login';
    } catch (err) {
      console.error('登出失败:', err);
    }
  };

  const handleProfile = () => {
    setDropdownVisible(false);
    setProfileVisible(true);
  };

  const handleTaskCenter = () => {
    setDropdownVisible(false);
    setTaskCenterVisible(true);
  };

  const getInitial = (name?: string | null) => {
    return name ? name.charAt(0).toUpperCase() : 'U';
  };

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
            <div className="user-avatar">{getInitial(userName)}</div>
            <span className="user-name">{userName || '用户'}</span>
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
      <ProfileDrawer visible={profileVisible} onClose={() => setProfileVisible(false)} />
    </header>
  );
};

export default Header;
