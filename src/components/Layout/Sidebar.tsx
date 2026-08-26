/**
 * 侧边栏组件 - 使用 Ant Design Menu
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';
import { useMenuStore } from '../../stores/menuStore';
import { useAuthStore } from '../../stores/authStore';
import { useAppStore } from '../../stores/appStore';
import { useMessageStore } from '../../stores/messageStore';
import { useTaskCenterStore } from '../../stores/taskCenterStore';
import type { MenuItem as MenuItemType } from '../../types/menu';
import Icon from '../Icon';
import { Circle, LogOut, User, ListTodo, RefreshCw, Trash2, Info } from 'lucide-react';
import { confirm } from '../ConfirmModal';
import { showStatus, updateStatus } from '../StatusModal';
import { getUserAvatar } from '../../services/storage';
import MessageCenter from '../MessageCenter';
import ProfileDrawer from '../ProfileDrawer';
import TaskCenter from '../TaskCenter';
import SSEMonitor from '../SSEMonitor';
import SystemInfoModal from '../../pages/SystemInfo/SystemInfoModal';
import { isTauriEnv } from '../../services/machine';
import './Sidebar.css';

type AntMenuItem = Required<MenuProps>['items'][number];

interface SidebarProps {
  collapsed?: boolean;
}

const Sidebar = ({ collapsed = false }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { menuList, fetchUserMenus } = useMenuStore();
  const { user, userName, fetchProfile } = useAuthStore();
  const { theme, toggleTheme, hasUpdate, openUpdateModal } = useAppStore();
  const unreadCount = useMessageStore(state => state.unreadCount);
  const { visible: taskCenterVisible, open: openTaskCenter, close: closeTaskCenter } = useTaskCenterStore();
  
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [messageCenterVisible, setMessageCenterVisible] = useState(false);
  const [systemInfoVisible, setSystemInfoVisible] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 加载头像（监听 user 变化）
  useEffect(() => {
    if (userName) {
      setAvatarUrl(getUserAvatar(userName));
    }
  }, [user, userName]);

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

  // 转换菜单数据为 antd Menu 格式
  const menuItems: AntMenuItem[] = useMemo(() => {
    const convertMenu = (menus: MenuItemType[]): AntMenuItem[] => {
      return menus
        .filter(menu => menu.is_visible !== false)
        .map(menu => {
          const hasChildren = menu.children && menu.children.length > 0;
          const item: AntMenuItem = {
            key: menu.path,
            icon: <Icon name={menu.icon} size={18} />,
            label: menu.meta?.title || menu.name,
            children: hasChildren ? convertMenu(menu.children!) : undefined,
          };
          return item;
        });
    };
    return menuList ? convertMenu(menuList) : [];
  }, [menuList]);

  // 菜单点击
  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  // 计算当前选中的菜单
  const selectedKeys = [location.pathname];
  
  // 手风琴效果：管理展开的菜单 keys
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  
  // 初始化时根据当前路径设置展开的菜单
  useEffect(() => {
    if (collapsed) {
      // 收起状态不设置 openKeys，让 antd 处理弹出菜单
      return;
    }
    const findParent = (menus: MenuItemType[], path: string): string[] => {
      for (const menu of menus) {
        if (menu.children) {
          for (const child of menu.children) {
            if (child.path === path) {
              return [menu.path];
            }
          }
          const found = findParent(menu.children, path);
          if (found.length) return [menu.path, ...found];
        }
      }
      return [];
    };
    if (menuList) {
      setOpenKeys(findParent(menuList, location.pathname));
    }
  }, [menuList, location.pathname, collapsed]);
  
  // 手风琴效果：只允许展开一个菜单
  const handleOpenChange: MenuProps['onOpenChange'] = (keys) => {
    if (collapsed) {
      // 收起状态让 antd 自己处理弹出菜单
      return;
    }
    const latestOpenKey = keys.find(key => !openKeys.includes(key));
    // 只保留最新展开的菜单（手风琴效果）
    setOpenKeys(latestOpenKey ? [latestOpenKey] : []);
  };

  const handleLogout = () => {
    setDropdownVisible(false);
    // 将用户主题保存到登录页本地状态
    localStorage.setItem('login-theme', theme);
    // 立即跳转，让动画页面处理退出逻辑
    window.location.href = '/login?from=logout';
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

  // 获取头像显示文字
  const getInitial = () => {
    const name = user?.nick_name || userName || '';
    return name.charAt(0) || 'U';
  };

  // 渲染头像
  const renderAvatar = () => {
    if (avatarUrl) {
      return <img src={avatarUrl} alt="头像" className="footer-avatar-img" />;
    }
    return getInitial();
  };

  return (
    <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <Circle size={24} className="logo-icon" />
        {!collapsed && <span className="logo-text">CMDB系统</span>}
        {!collapsed && <SSEMonitor />}
      </div>
      
      <nav className="sidebar-nav">
        <Menu
          mode="inline"
          theme="dark"
          inlineCollapsed={collapsed}
          selectedKeys={selectedKeys}
          {...(!collapsed && { openKeys, onOpenChange: handleOpenChange })}
          items={menuItems}
          onClick={handleMenuClick}
          inlineIndent={16}
          style={{ border: 'none', background: 'transparent' }}
        />
      </nav>

      {/* 底部用户区域 */}
      <div className="sidebar-footer">
        {collapsed ? (
          <div className="footer-collapsed">
            {unreadCount > 0 ? (
              <button className="footer-icon-btn bell-shake" onClick={() => setMessageCenterVisible(true)}>
                🔔
              </button>
            ) : (
              <div className="footer-avatar" onClick={() => setDropdownVisible(!dropdownVisible)}>
                {renderAvatar()}
              </div>
            )}
          </div>
        ) : (
          <div className="footer-expanded">
            <div className="footer-user" ref={dropdownRef}>
              <div className="footer-avatar" onClick={() => setDropdownVisible(!dropdownVisible)}>
                {renderAvatar()}
              </div>
              {dropdownVisible && (
                <div className="footer-dropdown">
                  <div className="dropdown-item" onClick={() => { setDropdownVisible(false); setProfileVisible(true); }}>
                    <User size={16} /><span>个人信息</span>
                  </div>
                  <div className="dropdown-item" onClick={() => { setDropdownVisible(false); openTaskCenter(); }}>
                    <ListTodo size={16} /><span>任务中心</span>
                  </div>
                  {isTauriEnv() && (
                    <div className="dropdown-item" onClick={() => { setDropdownVisible(false); setSystemInfoVisible(true); }}>
                      <Info size={16} />
                      <span>系统信息</span>
                      {hasUpdate && <span className="new-badge">NEW</span>}
                    </div>
                  )}
                  <div className="dropdown-divider" />
                  <div className="dropdown-item" onClick={handleRefreshPermissions}>
                    <RefreshCw size={16} /><span>刷新权限</span>
                  </div>
                  <div className="dropdown-item" onClick={handleClearData}>
                    <Trash2 size={16} /><span>清除缓存</span>
                  </div>
                  <div className="dropdown-divider" />
                  <div className="dropdown-item danger" onClick={handleLogout}>
                    <LogOut size={16} /><span>退出登录</span>
                  </div>
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
            {/* 更新图标 */}
            {hasUpdate && isTauriEnv() && (
              <button 
                className="footer-icon-btn update-btn" 
                onClick={openUpdateModal}
                title="有新版本可用"
              >
                🆙
              </button>
            )}
          </div>
        )}
      </div>

      <ProfileDrawer visible={profileVisible} onClose={handleProfileClose} />
      <TaskCenter visible={taskCenterVisible} onClose={closeTaskCenter} />
      <MessageCenter visible={messageCenterVisible} onClose={() => setMessageCenterVisible(false)} />
      <SystemInfoModal visible={systemInfoVisible} onClose={() => setSystemInfoVisible(false)} />
    </aside>
  );
};

export default Sidebar;
