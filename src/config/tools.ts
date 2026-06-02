/**
 * 首页/悬浮球小工具元数据
 * 新增工具时只需在此处添加一项，Dashboard 和 FloatingActions 自动同步
 */
export interface ToolMeta {
  /** 工具 ID，与 Tauri 后端 window.rs / Detached 路由中的标识保持一致 */
  id: string;
  /** Emoji 图标 */
  icon: string;
  /** 完整名称，用于 Dashboard 卡片标题 */
  name: string;
  /** 描述，用于 Dashboard 卡片副标题 */
  desc: string;
  /** 短标签，用于悬浮球（可选，缺省时复用 name） */
  shortLabel?: string;
}

export const TOOLS: ToolMeta[] = [
  { id: 'password', icon: '🔑', name: '随机密码',    desc: '生成高强度随机密码' },
  { id: 'case',     icon: '🐪', name: '驼峰转换',    desc: 'snake_case / camelCase 互转' },
  { id: 'json',     icon: '📋', name: 'JSON格式化',  desc: '美化 / 压缩 / 校验 JSON', shortLabel: 'JSON' },
  { id: 'cron',     icon: '⏰', name: 'Cron表达式',  desc: '可视化生成定时表达式',     shortLabel: 'Cron' },
  { id: 'time',     icon: '🕐', name: '时间戳转换',  desc: '时间戳 ↔ 日期时间互转',   shortLabel: '时间戳' },
  { id: 'qps',      icon: '📊', name: 'QPS计算器',   desc: 'QPS / 时间 / 总量 互算',  shortLabel: 'QPS' },
  { id: 'byte',     icon: '💾', name: '字节转换',    desc: 'B/KB/MB/GB/TB/PB 互转',  shortLabel: '字节' },
];

export type ToolId = typeof TOOLS[number]['id'];
