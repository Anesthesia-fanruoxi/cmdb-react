/**
 * 图标选择器组件 - 支持分类和搜索
 */

import { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './style.css';

// 按分类组织图标
const iconCategories: { name: string; icons: { name: string; icon: LucideIcon }[] }[] = [
  {
    name: '导航布局',
    icons: [
      { name: 'Home', icon: Icons.Home },
      { name: 'LayoutDashboard', icon: Icons.LayoutDashboard },
      { name: 'Menu', icon: Icons.Menu },
      { name: 'Grid3X3', icon: Icons.Grid3X3 },
      { name: 'LayoutGrid', icon: Icons.LayoutGrid },
      { name: 'Layers', icon: Icons.Layers },
      { name: 'PanelLeft', icon: Icons.PanelLeft },
      { name: 'Sidebar', icon: Icons.PanelLeftClose },
    ],
  },
  {
    name: '用户团队',
    icons: [
      { name: 'User', icon: Icons.User },
      { name: 'Users', icon: Icons.Users },
      { name: 'UserCog', icon: Icons.UserCog },
      { name: 'UserPlus', icon: Icons.UserPlus },
      { name: 'UserCheck', icon: Icons.UserCheck },
      { name: 'UserX', icon: Icons.UserX },
      { name: 'Contact', icon: Icons.Contact },
      { name: 'CircleUser', icon: Icons.CircleUser },
    ],
  },
  {
    name: '系统设置',
    icons: [
      { name: 'Settings', icon: Icons.Settings },
      { name: 'Cog', icon: Icons.Cog },
      { name: 'SlidersHorizontal', icon: Icons.SlidersHorizontal },
      { name: 'Wrench', icon: Icons.Wrench },
      { name: 'Hammer', icon: Icons.Hammer },
      { name: 'Settings2', icon: Icons.Settings2 },
      { name: 'Bolt', icon: Icons.Bolt },
      { name: 'Gauge', icon: Icons.Gauge },
    ],
  },
  {
    name: '安全权限',
    icons: [
      { name: 'Shield', icon: Icons.Shield },
      { name: 'ShieldCheck', icon: Icons.ShieldCheck },
      { name: 'ShieldAlert', icon: Icons.ShieldAlert },
      { name: 'Lock', icon: Icons.Lock },
      { name: 'Unlock', icon: Icons.Unlock },
      { name: 'Key', icon: Icons.Key },
      { name: 'KeyRound', icon: Icons.KeyRound },
      { name: 'Fingerprint', icon: Icons.Fingerprint },
    ],
  },
  {
    name: '文件文档',
    icons: [
      { name: 'File', icon: Icons.File },
      { name: 'FileText', icon: Icons.FileText },
      { name: 'FileCode', icon: Icons.FileCode },
      { name: 'FileJson', icon: Icons.FileJson },
      { name: 'Files', icon: Icons.Files },
      { name: 'Folder', icon: Icons.Folder },
      { name: 'FolderOpen', icon: Icons.FolderOpen },
      { name: 'FolderCog', icon: Icons.FolderCog },
      { name: 'Archive', icon: Icons.Archive },
      { name: 'ClipboardList', icon: Icons.ClipboardList },
      { name: 'ClipboardCheck', icon: Icons.ClipboardCheck },
      { name: 'FileSearch', icon: Icons.FileSearch },
    ],
  },
  {
    name: '数据存储',
    icons: [
      { name: 'Database', icon: Icons.Database },
      { name: 'Server', icon: Icons.Server },
      { name: 'HardDrive', icon: Icons.HardDrive },
      { name: 'Cpu', icon: Icons.Cpu },
      { name: 'MemoryStick', icon: Icons.MemoryStick },
      { name: 'CircuitBoard', icon: Icons.CircuitBoard },
      { name: 'Container', icon: Icons.Container },
      { name: 'Disc', icon: Icons.Disc },
    ],
  },
  {
    name: '网络云端',
    icons: [
      { name: 'Cloud', icon: Icons.Cloud },
      { name: 'CloudCog', icon: Icons.CloudCog },
      { name: 'CloudUpload', icon: Icons.CloudUpload },
      { name: 'CloudDownload', icon: Icons.CloudDownload },
      { name: 'Globe', icon: Icons.Globe },
      { name: 'Network', icon: Icons.Network },
      { name: 'Wifi', icon: Icons.Wifi },
      { name: 'Router', icon: Icons.Router },
      { name: 'Cable', icon: Icons.Cable },
      { name: 'Satellite', icon: Icons.Satellite },
    ],
  },
  {
    name: '监控图表',
    icons: [
      { name: 'Monitor', icon: Icons.Monitor },
      { name: 'Activity', icon: Icons.Activity },
      { name: 'BarChart3', icon: Icons.BarChart3 },
      { name: 'BarChart2', icon: Icons.BarChart2 },
      { name: 'LineChart', icon: Icons.LineChart },
      { name: 'PieChart', icon: Icons.PieChart },
      { name: 'TrendingUp', icon: Icons.TrendingUp },
      { name: 'TrendingDown', icon: Icons.TrendingDown },
      { name: 'AreaChart', icon: Icons.AreaChart },
      { name: 'Radar', icon: Icons.Radar },
    ],
  },
  {
    name: '组织机构',
    icons: [
      { name: 'Building2', icon: Icons.Building2 },
      { name: 'Building', icon: Icons.Building },
      { name: 'Landmark', icon: Icons.Landmark },
      { name: 'Factory', icon: Icons.Factory },
      { name: 'Store', icon: Icons.Store },
      { name: 'Warehouse', icon: Icons.Warehouse },
      { name: 'Hospital', icon: Icons.Hospital },
      { name: 'School', icon: Icons.School },
    ],
  },
  {
    name: '通知消息',
    icons: [
      { name: 'Bell', icon: Icons.Bell },
      { name: 'BellRing', icon: Icons.BellRing },
      { name: 'BellOff', icon: Icons.BellOff },
      { name: 'Mail', icon: Icons.Mail },
      { name: 'MailOpen', icon: Icons.MailOpen },
      { name: 'MessageSquare', icon: Icons.MessageSquare },
      { name: 'MessagesSquare', icon: Icons.MessagesSquare },
      { name: 'Send', icon: Icons.Send },
      { name: 'Megaphone', icon: Icons.Megaphone },
      { name: 'AtSign', icon: Icons.AtSign },
    ],
  },
  {
    name: '时间日历',
    icons: [
      { name: 'Calendar', icon: Icons.Calendar },
      { name: 'CalendarDays', icon: Icons.CalendarDays },
      { name: 'CalendarCheck', icon: Icons.CalendarCheck },
      { name: 'Clock', icon: Icons.Clock },
      { name: 'Timer', icon: Icons.Timer },
      { name: 'History', icon: Icons.History },
      { name: 'Hourglass', icon: Icons.Hourglass },
      { name: 'AlarmClock', icon: Icons.AlarmClock },
    ],
  },
  {
    name: '任务工作',
    icons: [
      { name: 'ListTodo', icon: Icons.ListTodo },
      { name: 'List', icon: Icons.List },
      { name: 'ListChecks', icon: Icons.ListChecks },
      { name: 'CheckSquare', icon: Icons.CheckSquare },
      { name: 'Workflow', icon: Icons.Workflow },
      { name: 'GitBranch', icon: Icons.GitBranch },
      { name: 'GitMerge', icon: Icons.GitMerge },
      { name: 'Milestone', icon: Icons.Milestone },
      { name: 'Flag', icon: Icons.Flag },
      { name: 'Target', icon: Icons.Target },
    ],
  },
  {
    name: '常用操作',
    icons: [
      { name: 'Search', icon: Icons.Search },
      { name: 'Filter', icon: Icons.Filter },
      { name: 'Plus', icon: Icons.Plus },
      { name: 'Minus', icon: Icons.Minus },
      { name: 'Edit', icon: Icons.Edit },
      { name: 'Trash2', icon: Icons.Trash2 },
      { name: 'Download', icon: Icons.Download },
      { name: 'Upload', icon: Icons.Upload },
      { name: 'RefreshCw', icon: Icons.RefreshCw },
      { name: 'RotateCcw', icon: Icons.RotateCcw },
      { name: 'Copy', icon: Icons.Copy },
      { name: 'Clipboard', icon: Icons.Clipboard },
    ],
  },
  {
    name: '其他图标',
    icons: [
      { name: 'Package', icon: Icons.Package },
      { name: 'Box', icon: Icons.Box },
      { name: 'Boxes', icon: Icons.Boxes },
      { name: 'Tag', icon: Icons.Tag },
      { name: 'Tags', icon: Icons.Tags },
      { name: 'Bookmark', icon: Icons.Bookmark },
      { name: 'Star', icon: Icons.Star },
      { name: 'Heart', icon: Icons.Heart },
      { name: 'Zap', icon: Icons.Zap },
      { name: 'Flame', icon: Icons.Flame },
      { name: 'Award', icon: Icons.Award },
      { name: 'Trophy', icon: Icons.Trophy },
      { name: 'Crown', icon: Icons.Crown },
      { name: 'Gem', icon: Icons.Gem },
      { name: 'Sparkles', icon: Icons.Sparkles },
      { name: 'Lightbulb', icon: Icons.Lightbulb },
    ],
  },
];

// 获取所有图标的扁平列表
const allIcons = iconCategories.flatMap(c => c.icons);

interface IconSelectProps {
  value?: string;
  onChange?: (value: string) => void;
}

const IconSelect = ({ value, onChange }: IconSelectProps) => {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const selectedIcon = allIcons.find(i => i.name === value);
  const SelectedIconComponent = selectedIcon?.icon;

  // ESC 键关闭弹窗
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible]);

  // 搜索过滤
  const filteredCategories = search
    ? [{
        name: '搜索结果',
        icons: allIcons.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
      }]
    : iconCategories;

  const handleSelect = (name: string) => {
    onChange?.(name);
    setVisible(false);
    setSearch('');
  };

  const handleClose = () => {
    setVisible(false);
    setSearch('');
    setActiveCategory(null);
  };

  return (
    <div className="icon-select">
      <div className="icon-select-trigger" onClick={() => setVisible(true)}>
        {SelectedIconComponent ? (
          <>
            <SelectedIconComponent size={18} />
            <span className="icon-name">{value}</span>
          </>
        ) : (
          <span className="placeholder">选择图标</span>
        )}
        <span className="arrow">▼</span>
      </div>
      
      {visible && (
        <div className="icon-modal-overlay" onClick={handleClose}>
          <div className="icon-modal" onClick={e => e.stopPropagation()}>
            <div className="icon-modal-header">
              <h4>选择图标</h4>
              <button className="close-btn" onClick={handleClose}>×</button>
            </div>
            
            <div className="icon-modal-search">
              <Icons.Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="搜索图标名称..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
              {search && (
                <button className="clear-btn" onClick={() => setSearch('')}>
                  <Icons.X size={14} />
                </button>
              )}
            </div>

            <div className="icon-modal-body">
              {!search && (
                <div className="category-tabs">
                  <button
                    className={`category-tab ${!activeCategory ? 'active' : ''}`}
                    onClick={() => setActiveCategory(null)}
                  >
                    全部
                  </button>
                  {iconCategories.map(cat => (
                    <button
                      key={cat.name}
                      className={`category-tab ${activeCategory === cat.name ? 'active' : ''}`}
                      onClick={() => setActiveCategory(cat.name)}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="icon-list">
                {(activeCategory && !search
                  ? filteredCategories.filter(c => c.name === activeCategory)
                  : filteredCategories
                ).map(category => (
                  <div key={category.name} className="icon-category">
                    {!activeCategory && <div className="category-title">{category.name}</div>}
                    <div className="icon-grid">
                      {category.icons.map(({ name, icon: IconComponent }) => (
                        <div
                          key={name}
                          className={`icon-item ${value === name ? 'selected' : ''}`}
                          onClick={() => handleSelect(name)}
                          title={name}
                        >
                          <IconComponent size={22} />
                          <span className="icon-label">{name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {search && filteredCategories[0].icons.length === 0 && (
                  <div className="no-result">未找到匹配的图标</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IconSelect;
export { iconCategories, allIcons };
