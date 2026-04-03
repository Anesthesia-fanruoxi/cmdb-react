/**
 * 主题配置
 * 预设主题和主题类型定义
 */

export interface ThemeColors {
  // 背景色
  bgColor: string;
  bgSecondary: string;
  bgHover: string;
  bgPage: string;
  
  // 文字色
  textColor: string;
  textSecondary: string;
  textMuted: string;
  
  // 边框色
  borderColor: string;
  borderColorDark: string;
  
  // 功能色
  primaryColor: string;
  primaryHover: string;
  dangerColor: string;
  dangerHover: string;
  successColor: string;
  warningColor: string;
  infoColor: string;
}

export interface ThemeConfig {
  id: string;
  name: string;
  type: 'light' | 'dark';
  colors: ThemeColors;
  isCustom?: boolean;
}

// 预设主题配置
export const PRESET_THEMES: ThemeConfig[] = [
  {
    id: 'light',
    name: '柔和亮色',
    type: 'light',
    colors: {
      bgColor: '#f8f9fa',
      bgSecondary: '#e9ecef',
      bgHover: '#dee2e6',
      bgPage: '#e9ecef',
      textColor: '#2d3748',
      textSecondary: '#4a5568',
      textMuted: '#718096',
      borderColor: '#dee2e6',
      borderColorDark: '#ced4da',
      primaryColor: '#667eea',
      primaryHover: '#764ba2',
      dangerColor: '#ff4d4f',
      dangerHover: '#ff7875',
      successColor: '#52c41a',
      warningColor: '#faad14',
      infoColor: '#1890ff',
    },
  },
  {
    id: 'dark',
    name: '柔和暗色',
    type: 'dark',
    colors: {
      bgColor: '#2d3748',
      bgSecondary: '#1a202c',
      bgHover: '#4a5568',
      bgPage: '#1a202c',
      textColor: '#e2e8f0',
      textSecondary: '#a0aec0',
      textMuted: '#718096',
      borderColor: '#4a5568',
      borderColorDark: '#2d3748',
      primaryColor: '#818cf8',
      primaryHover: '#a78bfa',
      dangerColor: '#a61d24',
      dangerHover: '#d32029',
      successColor: '#49aa19',
      warningColor: '#d89614',
      infoColor: '#177ddc',
    },
  },
  {
    id: 'pure-light',
    name: '纯净白',
    type: 'light',
    colors: {
      bgColor: '#ffffff',
      bgSecondary: '#fafafa',
      bgHover: '#f5f5f5',
      bgPage: '#f0f2f5',
      textColor: '#333333',
      textSecondary: '#666666',
      textMuted: '#999999',
      borderColor: '#f0f0f0',
      borderColorDark: '#d9d9d9',
      primaryColor: '#1890ff',
      primaryHover: '#40a9ff',
      dangerColor: '#ff4d4f',
      dangerHover: '#ff7875',
      successColor: '#52c41a',
      warningColor: '#faad14',
      infoColor: '#1890ff',
    },
  },
  {
    id: 'pure-dark',
    name: '深邃黑',
    type: 'dark',
    colors: {
      bgColor: '#000000',
      bgSecondary: '#0a0a0a',
      bgHover: '#1a1a1a',
      bgPage: '#000000',
      textColor: '#ffffff',
      textSecondary: '#b0b0b0',
      textMuted: '#808080',
      borderColor: '#1a1a1a',
      borderColorDark: '#2a2a2a',
      primaryColor: '#3b82f6',
      primaryHover: '#60a5fa',
      dangerColor: '#ef4444',
      dangerHover: '#f87171',
      successColor: '#10b981',
      warningColor: '#f59e0b',
      infoColor: '#3b82f6',
    },
  },
  {
    id: 'ocean-blue',
    name: '海洋蓝',
    type: 'dark',
    colors: {
      bgColor: '#1e3a5f',
      bgSecondary: '#152a47',
      bgHover: '#2c4f7c',
      bgPage: '#152a47',
      textColor: '#e0f2fe',
      textSecondary: '#bae6fd',
      textMuted: '#7dd3fc',
      borderColor: '#2c4f7c',
      borderColorDark: '#1e3a5f',
      primaryColor: '#38bdf8',
      primaryHover: '#7dd3fc',
      dangerColor: '#f87171',
      dangerHover: '#fca5a5',
      successColor: '#34d399',
      warningColor: '#fbbf24',
      infoColor: '#60a5fa',
    },
  },
  {
    id: 'forest-green',
    name: '森林绿',
    type: 'dark',
    colors: {
      bgColor: '#1e3a2f',
      bgSecondary: '#152a23',
      bgHover: '#2c4f42',
      bgPage: '#152a23',
      textColor: '#d1fae5',
      textSecondary: '#a7f3d0',
      textMuted: '#6ee7b7',
      borderColor: '#2c4f42',
      borderColorDark: '#1e3a2f',
      primaryColor: '#34d399',
      primaryHover: '#6ee7b7',
      dangerColor: '#f87171',
      dangerHover: '#fca5a5',
      successColor: '#10b981',
      warningColor: '#fbbf24',
      infoColor: '#60a5fa',
    },
  },
  {
    id: 'twilight-purple',
    name: '暮光紫',
    type: 'dark',
    colors: {
      bgColor: '#2e1f47',
      bgSecondary: '#1f1533',
      bgHover: '#3d2a5c',
      bgPage: '#1f1533',
      textColor: '#f3e8ff',
      textSecondary: '#e9d5ff',
      textMuted: '#d8b4fe',
      borderColor: '#3d2a5c',
      borderColorDark: '#2e1f47',
      primaryColor: '#a78bfa',
      primaryHover: '#c4b5fd',
      dangerColor: '#f87171',
      dangerHover: '#fca5a5',
      successColor: '#34d399',
      warningColor: '#fbbf24',
      infoColor: '#818cf8',
    },
  },
  {
    id: 'warm-orange',
    name: '暖阳橙',
    type: 'light',
    colors: {
      bgColor: '#fff7ed',
      bgSecondary: '#ffedd5',
      bgHover: '#fed7aa',
      bgPage: '#ffedd5',
      textColor: '#431407',
      textSecondary: '#7c2d12',
      textMuted: '#9a3412',
      borderColor: '#fed7aa',
      borderColorDark: '#fdba74',
      primaryColor: '#f97316',
      primaryHover: '#fb923c',
      dangerColor: '#dc2626',
      dangerHover: '#ef4444',
      successColor: '#16a34a',
      warningColor: '#eab308',
      infoColor: '#3b82f6',
    },
  },
];

// 获取主题配置
export function getThemeById(id: string, customThemes: ThemeConfig[] = []): ThemeConfig | undefined {
  // 先从预设主题查找
  const preset = PRESET_THEMES.find(t => t.id === id);
  if (preset) return preset;
  
  // 再从自定义主题查找
  return customThemes.find(t => t.id === id);
}

// 验证主题配置
export function validateTheme(theme: any): theme is ThemeConfig {
  if (!theme || typeof theme !== 'object') return false;
  if (!theme.id || !theme.name || !theme.type) return false;
  if (theme.type !== 'light' && theme.type !== 'dark') return false;
  if (!theme.colors || typeof theme.colors !== 'object') return false;
  
  const requiredColors = [
    'bgColor', 'bgSecondary', 'bgHover', 'bgPage',
    'textColor', 'textSecondary', 'textMuted',
    'borderColor', 'borderColorDark',
    'primaryColor', 'primaryHover',
    'dangerColor', 'dangerHover',
    'successColor', 'warningColor', 'infoColor',
  ];
  
  return requiredColors.every(key => typeof theme.colors[key] === 'string');
}

// 导出主题为JSON
export function exportTheme(theme: ThemeConfig): string {
  return JSON.stringify(theme, null, 2);
}

// 从JSON导入主题
export function importTheme(json: string): ThemeConfig {
  try {
    const theme = JSON.parse(json);
    if (!validateTheme(theme)) {
      throw new Error('主题格式无效');
    }
    theme.isCustom = true;
    return theme;
  } catch (error) {
    throw new Error('解析主题失败: ' + (error as Error).message);
  }
}
