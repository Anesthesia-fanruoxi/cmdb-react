/**
 * Tauri 窗口管理工具
 * 支持创建独立窗口，实现弹窗/标签页分离
 */

import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

interface DetachWindowOptions {
  /** 窗口唯一标识 */
  label: string;
  /** 窗口标题 */
  title: string;
  /** 要加载的路由路径 */
  url: string;
  /** 窗口宽度 */
  width?: number;
  /** 窗口高度 */
  height?: number;
  /** 最小宽度 */
  minWidth?: number;
  /** 最小高度 */
  minHeight?: number;
  /** 是否居中 */
  center?: boolean;
}

/** 已创建的窗口缓存 */
const windowCache = new Map<string, WebviewWindow>();

/** 窗口更新事件数据 */
export interface WindowUpdateEvent {
  [key: string]: unknown;
}

/**
 * 创建独立窗口
 * @param updateData 如果窗口已存在，发送此数据通知窗口更新
 */
export async function createDetachedWindow(
  options: DetachWindowOptions, 
  updateData?: WindowUpdateEvent
): Promise<WebviewWindow | null> {
  const {
    label,
    title,
    url,
    width = 800,
    height = 600,
    minWidth = 400,
    minHeight = 300,
    center = true
  } = options;

  const fullLabel = `detached-${label}`;

  // 使用 Rust 命令将已存在的窗口带到前台
  try {
    const exists = await invoke<boolean>('bring_window_to_front', { label: fullLabel });
    if (exists) {
      // 窗口已存在并已带到前台，发送更新事件
      if (updateData) {
        await emit(`window-update-${fullLabel}`, updateData);
      }
      const existing = await WebviewWindow.getByLabel(fullLabel);
      return existing;
    }
  } catch {
    // 命令失败，继续创建新窗口
  }

  // 清理缓存中可能失效的引用
  windowCache.delete(label);

  // 获取当前主题
  const isDark = document.documentElement.classList.contains('dark');

  try {
    const webview = new WebviewWindow(fullLabel, {
      url,
      title,
      width,
      height,
      minWidth,
      minHeight,
      center,
      resizable: true,
      decorations: true,
      focus: true,
      theme: isDark ? 'dark' : 'light',
    });

    webview.once('tauri://destroyed', () => {
      windowCache.delete(label);
    });

    windowCache.set(label, webview);
    return webview;
  } catch (error) {
    console.error('创建窗口失败:', error);
    return null;
  }
}

/** 组件窗口配置 */
interface ComponentWindowOptions {
  /** 组件类型 */
  type: string;
  /** 窗口标识（不传则自动生成） */
  label?: string;
  /** 窗口标题 */
  title: string;
  /** 传给组件的props */
  props?: Record<string, unknown>;
  /** 窗口宽度 */
  width?: number;
  /** 窗口高度 */
  height?: number;
}

/**
 * 打开组件窗口（通用方法）
 * @example
 * openComponentWindow({
 *   type: 'dept-project',
 *   title: '运维部门 - 项目配置',
 *   props: { deptId: '123', deptName: '运维部门' },
 *   width: 560,
 *   height: 500
 * })
 */
export function openComponentWindow(options: ComponentWindowOptions) {
  const { type, label, title, props = {}, width = 600, height = 500 } = options;
  const windowLabel = label || `${type}-${Date.now()}`;
  const data = encodeURIComponent(JSON.stringify(props));
  
  return createDetachedWindow({
    label: windowLabel,
    title,
    url: `/detached?type=${type}&data=${data}`,
    width,
    height,
  }, props); // 传递 props 作为更新数据
}

/**
 * 监听窗口更新事件
 * @param label 窗口标识（不含 detached- 前缀）
 * @param callback 回调函数
 */
export function onWindowUpdate<T = WindowUpdateEvent>(
  label: string, 
  callback: (data: T) => void
): Promise<UnlistenFn> {
  const fullLabel = `detached-${label}`;
  return listen<T>(`window-update-${fullLabel}`, (event) => {
    callback(event.payload);
  });
}

/**
 * 关闭独立窗口
 */
export async function closeDetachedWindow(label: string): Promise<void> {
  const webview = windowCache.get(label);
  if (webview) {
    try {
      await webview.close();
    } catch (error) {
      console.error('关闭窗口失败:', error);
    }
    windowCache.delete(label);
  }
}

/**
 * 检查窗口是否存在
 */
export function isWindowExists(label: string): boolean {
  return windowCache.has(label);
}

/**
 * 获取所有独立窗口
 */
export function getAllDetachedWindows(): Map<string, WebviewWindow> {
  return new Map(windowCache);
}

/**
 * 关闭当前窗口（用于独立窗口内部调用）
 */
export async function closeCurrentWindow(): Promise<void> {
  try {
    const currentWindow = getCurrentWebviewWindow();
    // 先尝试 destroy，再尝试 close
    try {
      await currentWindow.destroy();
    } catch {
      await currentWindow.close();
    }
  } catch (error) {
    console.error('关闭窗口失败:', error);
    // 降级使用 window.close()
    window.close();
  }
}

/** 放回主窗口事件类型 */
export interface ReattachTabEvent {
  type: 'sql' | 'elfk';
  tabData: Record<string, unknown>;
}

/**
 * 发送标签页放回主窗口事件
 */
export async function emitReattachTab(data: ReattachTabEvent): Promise<void> {
  try {
    await emit('reattach-tab', data);
    console.log('[Window] 发送放回事件:', data.type);
  } catch (error) {
    console.error('发送放回事件失败:', error);
  }
}

/**
 * 监听标签页放回事件
 */
export function onReattachTab(callback: (data: ReattachTabEvent) => void): Promise<UnlistenFn> {
  return listen<ReattachTabEvent>('reattach-tab', (event) => {
    console.log('[Window] 收到放回事件:', event.payload);
    callback(event.payload);
  });
}
