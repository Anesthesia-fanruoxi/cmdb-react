/**
 * 消息中心 Store
 * 本地存储，支持已读/未读状态
 */

import { create } from 'zustand';

export type MessageType = 'success' | 'error' | 'warning' | 'info';

export interface Message {
  id: string;
  type: MessageType;
  title: string;
  content: string;
  time: number;
  read: boolean;
  // 可选：关联的文件路径等
  extra?: Record<string, unknown>;
}

interface MessageState {
  messages: Message[];
  unreadCount: number;
  // 添加消息
  addMessage: (msg: Omit<Message, 'id' | 'time' | 'read'>) => void;
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
      return { messages, unreadCount: messages.filter(m => !m.read).length };
    });
  },

  markAsRead: (id) => {
    set(state => {
      const messages = state.messages.map(m => m.id === id ? { ...m, read: true } : m);
      saveToStorage(messages);
      return { messages, unreadCount: messages.filter(m => !m.read).length };
    });
  },

  markAllAsRead: () => {
    set(state => {
      const messages = state.messages.map(m => ({ ...m, read: true }));
      saveToStorage(messages);
      return { messages, unreadCount: 0 };
    });
  },

  removeMessage: (id) => {
    set(state => {
      const messages = state.messages.filter(m => m.id !== id);
      saveToStorage(messages);
      return { messages, unreadCount: messages.filter(m => !m.read).length };
    });
  },

  clearAll: () => {
    saveToStorage([]);
    set({ messages: [], unreadCount: 0 });
  },

  rehydrate: () => {
    const messages = loadFromStorage();
    set({ messages, unreadCount: messages.filter(m => !m.read).length });
  },
}));
