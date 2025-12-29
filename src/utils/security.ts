/**
 * 安全相关工具
 * 禁用右键菜单、快捷键等
 */

import { isTauriEnv } from '../services/machine';

/**
 * 初始化安全设置（仅在 Tauri 生产环境生效）
 */
export function initSecurity() {
  // 仅在 Tauri 环境且非开发模式下启用
  if (!isTauriEnv() || import.meta.env.DEV) {
    return;
  }

  // 禁用右键菜单
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // 禁用特定快捷键
  document.addEventListener('keydown', (e) => {
    // F5 刷新
    if (e.key === 'F5') {
      e.preventDefault();
    }
    // F12 开发者工具
    if (e.key === 'F12') {
      e.preventDefault();
    }
    // Ctrl+Shift+I 开发者工具
    if (e.ctrlKey && e.shiftKey && e.key === 'I') {
      e.preventDefault();
    }
    // Ctrl+Shift+J 控制台
    if (e.ctrlKey && e.shiftKey && e.key === 'J') {
      e.preventDefault();
    }
    // Ctrl+U 查看源码
    if (e.ctrlKey && e.key === 'u') {
      e.preventDefault();
    }
    // Ctrl+R 刷新
    if (e.ctrlKey && e.key === 'r') {
      e.preventDefault();
    }
    // Ctrl+Shift+R 强制刷新
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
      e.preventDefault();
    }
  });

  console.log('安全设置已启用');
}
