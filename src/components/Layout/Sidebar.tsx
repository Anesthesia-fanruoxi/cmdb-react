/**
 * 侧边栏组件
 * 包含菜单和底部用户区域
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMenuStore } from '../../stores/menuStore';
import { useAuthStore } from '../../stores/authStore';
import { useAppStore } from '../../stores/appStore';
import { useMessageStore } from '../../stores/messageStore';
import type { MenuItem } from '../../types/menu';
import Icon from '../Icon';
import { Package, LogOut, User, ListTodo, RefreshCw, Trash2, Info } from 'lucide-react';
import { confirm } from '../ConfirmModal';
import { showStatus, updateStatus } from '../StatusModal';
import MessageCenter from '../MessageCenter';
import ProfileDrawer from '../ProfileDrawer';
import TaskCenter from '../TaskCenter';
import { openComponentWindow } from '../../utils/window';
import { isTauriEnv } from '../../services/machine';
import './Sidebar.css';

interface SidebarProps {
  collapsed?: boolean;
}

const Sidebar = ({ collapsed = false }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { menuList, fetchUserMenus } = useMenuStore();
  const { userName, logout, fetchProfile } = useAuthStore();
  const { theme, toggleTheme } = useAppStore();
  const unreadCount = useMessageStore(state => state.unreadCount);
  
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [taskCenterVisible, setTaskCenterVisible] = useState(false);
  const [messageCenterVisible, setMessageCenterVisible] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeKey = location.pathname;

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

  const toggleExpand = (path: string) => {
    setExpandedKeys(prev => prev.includes(path) ? prev.filter(k => k !== path) : [...prev, path]);
  };

  const handleMenuClick = (menu: MenuItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (menu.children && menu.children.length > 0) {
      toggleExpand(menu.path);
    } else {
      navigate(menu.path);
    }
  };

  const handleLogout = async () => {
    setDropdownVisible(false);
    try {
      await logout();
      window.location.href = '/login?from=logout';
    } catch (err) {
      console.error('登出失败:', err);
    }
  };

  const handleRefreshPermissions = async () => {
    setDropdownVisible(false);
    showStatus('重新获取权限中...');
    try {
      await Promise.all([fetchUserMenus(), fetchProfile()]);
      updateStatus('权限获取完成', 1000);
    } catch {
      updateStatus('刷新权限失败', 1500);
    }
  };

  const handleClearData = async () => {
    const confirmed = await confirm({
      title: '清除缓存',
      content: '确定要清除所有本地缓存数据吗？',
      type: 'warning',
      okText: '确定清除',
      cancelText: '取消',
    });
    if (confirmed) {
      setDropdownVisible(false);
      window.location.href = '/dashboard?clear=1';
    }
  };

  const getInitial = (name?: string | null) => name ? name.charAt(0).toUpperCase() : 'U';

  const renderMenuItem = (menu: MenuItem, level = 0) => {
    const hasChildren = menu.children && menu.children.length > 0;
    const isExpanded = expandedKeys.includes(menu.path);
    const isActive = activeKey === menu.path;
    if (menu.is_visible === false) return null;

    return (
      <li key={menu.path} className="menu-item-wrapper">
        <button
          className={`menu-item ${isActive ? 'active' : ''} ${hasChildren ? 'has-children' : ''}`}
          style={{ paddingLeft: `${16 + level * 16}px` }}
          onClick={(e) => handleMenuClick(menu, e)}
        >
          <span className="menu-icon"><Icon name={menu.icon} size={18} /></span>
          {!collapsed && (
            <>
              <span className="menu-label">{menu.meta?.title || menu.name}</span>
              {hasChildren && <span className={`menu-arrow ${isExpanded ? 'expanded' : ''}`}>▶</span>}
            </>
          )}
        </button>
        {hasChildren && isExpanded && !collapsed && (
          <ul className="sub-menu">{menu.children!.map(child => renderMenuItem(child, level + 1))}</ul>
        )}
      </li>
    );
  };

  return (
    <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <Package size={24} className="logo-icon" />
        {!collapsed && <span className="logo-text">CMDB系统</span>}
      </div>
      
      <nav className="sidebar-nav">
        <ul className="menu-list">{menuList?.map(menu => renderMenuItem(menu))}</ul>
      </nav>

      {/* 底部用户区域 */}
      <div className="sidebar-footer">
        {collapsed ? (
          /* 收起状态：只显示头像，有消息时显示铃铛 */
          <div className="footer-collapsed">
            {unreadCount > 0 ? (
              <button className="footer-icon-btn bell-shake" onClick={() => setMessageCenterVisible(true)}>
                🔔
              </button>
            ) : (
              <div className="footer-avatar" onClick={() => setDropdownVisible(!dropdownVisible)}>
                {getInitial(userName)}
              </div>
            )}
          </div>
        ) : (
          /* 展开状态：头像在左，主题在中间，铃铛在右 */
          <div className="footer-expanded">
            <div className="footer-user" ref={dropdownRef}>
              <div className="footer-avatar" onClick={() => setDropdownVisible(!dropdownVisible)}>
                {getInitial(userName)}
              </div>
              {dropdownVisible && (
                <div className="footer-dropdown">
                  <div className="dropdown-item" onClick={() => { setDropdownVisible(false); setProfileVisible(true); }}><User size={16} /><span>个人信息</span></div>
                  <div className="dropdown-item" onClick={() => { setDropdownVisible(false); setTaskCenterVisible(true); }}><ListTodo size={16} /><span>任务中心</span></div>
                  {isTauriEnv() && (
                    <div className="dropdown-item" onClick={() => { 
                      setDropdownVisible(false); 
                      openComponentWindow({ type: 'system-info', label: 'system-info', title: '系统信息', width: 400, height: 600 });
                    }}><Info size={16} /><span>系统信息</span></div>
                  )}
                  <div className="dropdown-divider" />
                  <div className="dropdown-item" onClick={handleRefreshPermissions}><RefreshCw size={16} /><span>刷新权限</span></div>
                  <div className="dropdown-item" onClick={handleClearData}><Trash2 size={16} /><span>清除缓存</span></div>
                  <div className="dropdown-divider" />
                  <div className="dropdown-item danger" onClick={handleLogout}><LogOut size={16} /><span>退出登录</span></div>
                </div>
              )}
            </div>
            <button className="footer-icon-btn theme-btn" onClick={toggleTheme} title={theme === 'light' ? '暗色模式' : '亮色模式'}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className={`footer-icon-btn bell-btn ${unreadCount > 0 ? 'bell-shake' : ''}`} onClick={() => setMessageCenterVisible(true)}>
              🔔
              {unreadCount > 0 && <span className="badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
          </div>
        )}
      </div>

      <ProfileDrawer visible={profileVisible} onClose={() => setProfileVisible(false)} />
      <TaskCenter visible={taskCenterVisible} onClose={() => setTaskCenterVisible(false)} />
      <MessageCenter visible={messageCenterVisible} onClose={() => setMessageCenterVisible(false)} />
    </aside>
  );
};

export default Sidebar;
