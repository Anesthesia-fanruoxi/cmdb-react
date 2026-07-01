/**
 * 特性开关配置
 * 用于控制新旧功能的切换
 */

/** 已迁移到 SSE 网关的通道列表 */
const GATEWAY_CHANNELS: string[] = [
  'sql.apply.list',
  'sql.export.list',
  'tasks.list',
  'tasks.list.analysis',
  'tasks.list.es_export',
  'tasks.list.sql_export',
  'tasks.detail',
  'monitor.metrics',
  'assets.project.detail',
  'assets.record.detail',
];

/** 特性开关 */
export const FEATURE_FLAGS = {
  /** 启用 SSE 网关模式 */
  SSE_GATEWAY_ENABLED: true,

  /** 已迁移到网关的通道 */
  SSE_GATEWAY_CHANNELS: GATEWAY_CHANNELS,
};

/**
 * 检查指定通道是否使用网关模式
 * @param channel 通道名称
 * @returns true 表示使用新网关，false 表示使用旧模式
 */
export function shouldUseGateway(channel: string): boolean {
  if (!FEATURE_FLAGS.SSE_GATEWAY_ENABLED) return false;
  return FEATURE_FLAGS.SSE_GATEWAY_CHANNELS.includes(channel);
}
