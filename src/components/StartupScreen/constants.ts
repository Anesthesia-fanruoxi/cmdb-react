/**
 * 启动动画常量（独立文件，避免 HMR 不兼容）
 */

export type FlowType = 'none' | 'init' | 'token' | 'credential' | 'login' | 'clear' | 'logout';

export const FLOW_STEPS: Record<FlowType, string[]> = {
  none: [],
  init: ['初始化中', '准备就绪'],
  token: ['验证登录', '加载菜单', '恢复工作区', '准备就绪'],
  credential: ['验证凭据', '登录成功', '加载菜单', '恢复工作区', '准备就绪'],
  login: ['登录成功', '加载菜单', '恢复工作区', '准备就绪'],
  clear: ['开始清除缓存', '清除完成', '重新获取权限', '启动中'],
  logout: ['保存工作区', '退出登录', '初始化中'],
};
