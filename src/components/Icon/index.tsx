/**
 * 图标组件
 * 将图标名称映射到 lucide-react 图标
 */

import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// 图标名称映射（支持多种命名方式）
const iconMap: Record<string, LucideIcon> = {
  // Element Plus 风格命名 -> Lucide 图标
  HomeOutlined: Icons.Home,
  DashboardOutlined: Icons.LayoutDashboard,
  SettingOutlined: Icons.Settings,
  UserOutlined: Icons.User,
  TeamOutlined: Icons.Users,
  MenuOutlined: Icons.Menu,
  DatabaseOutlined: Icons.Database,
  SafetyOutlined: Icons.Shield,
  FileOutlined: Icons.File,
  FolderOutlined: Icons.Folder,
  AppstoreOutlined: Icons.Package,
  ToolOutlined: Icons.Wrench,
  CloudOutlined: Icons.Cloud,
  MonitorOutlined: Icons.Monitor,
  LockOutlined: Icons.Lock,
  KeyOutlined: Icons.Key,
  BankOutlined: Icons.Building2,
  FileTextOutlined: Icons.FileText,
  ServerOutlined: Icons.Server,
  HddOutlined: Icons.HardDrive,
  // Lucide 原生命名（直接使用）
  ...Object.fromEntries(
    Object.entries(Icons).filter(([key]) => 
      typeof Icons[key as keyof typeof Icons] === 'function' && 
      key !== 'createLucideIcon' && 
      key !== 'default'
    )
  ) as Record<string, LucideIcon>,
};

interface IconProps {
  name?: string;
  size?: number;
  className?: string;
  color?: string;
}

const Icon = ({ name, size = 16, className = '', color }: IconProps) => {
  if (!name) return <Icons.File size={size} className={className} color={color} />;
  
  const IconComponent = iconMap[name];
  if (!IconComponent) return <Icons.File size={size} className={className} color={color} />;
  
  return <IconComponent size={size} className={className} color={color} />;
};

export default Icon;
export { iconMap };
