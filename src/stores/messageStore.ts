/**
 * 消息中心 Store
 * 本地存储，支持已读/未读状态，系统通知和托盘闪烁
 */

import { create } from 'zustand';
import { startTrayFlash, stopTrayFlash } from '../services/notification';

export type MessageType = 'success' | 'error' | 'warning' | 'info';

export interface Message {
  id: string;
  type: MessageType;
  title: string;
  content: string;
  time: number;
  read: boolean;
  // 可选：点击跳转动作
  action?: {
    type: 'task-center' | 'link' | 'download' | 'custom' | 'sql_approval';
    payload?: string;
    // 自定义按钮（当type为custom时使用）
    buttons?: Array<{
      text: string;
      onClick: () => void;
    }>;
  };
  // 可选：关联的文件路径等
  extra?: Record<string, unknown> & {
    // 下载相关
    filePath?: string;
    filename?: string;
    downloadDir?: string;
  };
}

interface MessageState {
  messages: Message[];
  unreadCount: number;
  // 添加消息
  addMessage: (msg: Omit<Message, 'id' | 'time' | 'read'>) => void;
  // 更新消息
  updateMessage: (id: string, updates: Partial<Pick<Message, 'title' | 'content' | 'extra'>>) => void;
  // 标记已读
  markAsRead: (id: string) => void;
  // 全部标记已读
  markAllAsRead: () => void;
  // 删除消息
  removeMessage: (id: string) => void;
  // 清空所有消息
  clearAll: () => void;
  // 从本地存储恢复
  rehydrate: () => void;
}

const STORAGE_KEY = 'cmdb_messages';

// 保存到本地
const saveToStorage = (messages: Message[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch (e) {
    console.error('保存消息失败:', e);
  }
};

// 从本地读取
const loadFromStorage = (): Message[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const useMessageStore = create<MessageState>((set) => ({
  messages: [],
  unreadCount: 0,

  addMessage: (msg) => {
    const newMsg: Message = {
      ...msg,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      time: Date.now(),
      read: false,
    };
    set(state => {
      const messages = [newMsg, ...state.messages].slice(0, 100); // 最多保留100条
      saveToStorage(messages);
      const unreadCount = messages.filter(m => !m.read).length;
      
      // 注意：不再自动发送应用内通知，由调用方决定是否需要通知
      // showNotification(msg.title, msg.content, msg.type);
      
      // 有未读消息时启动托盘闪烁
      if (unreadCount > 0) {
        startTrayFlash();
      }
      
      return { messages, unreadCount };
    });
  },

  updateMessage: (id, updates) => {
    set(state => {
      const messages = state.messages.map(m => m.id === id ? { ...m, ...updates, extra: updates.extra !== undefined ? { ...m.extra, ...updates.extra } : m.extra } : m);
      saveToStorage(messages);
      const unreadCount = messages.filter(m => !m.read).length;
      return { messages, unreadCount };
    });
  },

  markAsRead: (id) => {
    set(state => {
      const messages = state.messages.map(m => m.id === id ? { ...m, read: true } : m);
      saveToStorage(messages);
      const unreadCount = messages.filter(m => !m.read).length;
      
      // 没有未读消息时停止托盘闪烁
      if (unreadCount === 0) {
        stopTrayFlash();
      }
      
      return { messages, unreadCount };
    });
  },

  markAllAsRead: () => {
    set(state => {
      const messages = state.messages.map(m => ({ ...m, read: true }));
      saveToStorage(messages);
      
      // 停止托盘闪烁
      stopTrayFlash();
      
      return { messages, unreadCount: 0 };
    });
  },

  removeMessage: (id) => {
    set(state => {
      const messages = state.messages.filter(m => m.id !== id);
      saveToStorage(messages);
      const unreadCount = messages.filter(m => !m.read).length;
      
      // 没有未读消息时停止托盘闪烁
      if (unreadCount === 0) {
        stopTrayFlash();
      }
      
      return { messages, unreadCount };
    });
  },

  clearAll: () => {
    saveToStorage([]);
    stopTrayFlash();
    set({ messages: [], unreadCount: 0 });
  },

  rehydrate: () => {
    const messages = loadFromStorage();
    const unreadCount = messages.filter(m => !m.read).length;
    
    // 恢复时如果有未读消息，启动托盘闪烁
    if (unreadCount > 0) {
      startTrayFlash();
    }
    
    set({ messages, unreadCount });
  },
}));
