/**
 * 图标组件
 * 将 Element Plus 图标名称映射到 lucide-react 图标
 */

import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { elementIconMap } from './iconMap';
import { extraCategoryMap, antDesignMap } from './iconMapExtra';

// 合并所有映射和 Lucide 原生图标
const iconMap: Record<string, LucideIcon> = {
  ...elementIconMap,
  ...extraCategoryMap,
  ...antDesignMap,
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
