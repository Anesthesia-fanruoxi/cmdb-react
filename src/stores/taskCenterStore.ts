/**
 * 任务中心状态管理
 * 管理任务中心显示状态、运行中任务、SSE 连接
 */

import { create } from 'zustand';
import { getToken } from '../services/storage/tokenStorage';
import { useMessageStore } from './messageStore';
import { useAuthStore } from './authStore';
import { createGatewayConnection } from '../services/sse/compat';
import type { Task } from '../services/task';

// 任务类型名称映射
const TASK_TYPE_NAMES: Record<string, string> = {
  analysis: '数据分析',
  es_export: '日志导出',
  sql_export: 'SQL导出',
};

interface TaskCenterState {
  // 弹框显示状态
  visible: boolean;
  // 当前激活的任务类型
  activeType: 'analysis' | 'es_export' | 'sql_export';
  // 搜索关键词
  searchKeyword: string;
  // 任务列表
  taskList: Task[];
  // 加载状态
  loading: boolean;
  // 运行中的任务 ID 集合（用于判断是否需要保持 SSE）
  runningTaskIds: Set<string>;
  // 上次任务状态（用于检测状态变化）
  prevTaskStatus: Map<string, string>;
  // SSE 连接实例
  eventSource: { close: () => void } | null;

  // Actions
  open: () => void;
  close: () => void;
  toggle: () => void;
  setActiveType: (type: 'analysis' | 'es_export' | 'sql_export') => void;
  setSearchKeyword: (keyword: string) => void;
  
  // SSE 管理
  startSSE: () => void;
  stopSSE: () => void;
  
  // 任务管理
  addRunningTask: (taskId: string, taskType: string) => void;
  refreshTaskList: () => void;
}

export const useTaskCenterStore = create<TaskCenterState>((set, get) => ({
  visible: false,
  activeType: 'analysis',
  searchKeyword: '',
  taskList: [],
  loading: false,
  runningTaskIds: new Set(),
  prevTaskStatus: new Map(),
  eventSource: null,

  open: () => {
    set({ visible: true });
    // SSE 由组件的 useEffect 触发，避免重复调用
  },

  close: () => {
    set({ visible: false });
    // 关闭时检查是否需要断开 SSE
    const { runningTaskIds } = get();
    if (runningTaskIds.size === 0) {
      get().stopSSE();
    }
  },

  toggle: () => {
    const { visible } = get();
    if (visible) {
      get().close();
    } else {
      get().open();
    }
  },

  setActiveType: (type) => {
    set({ activeType: type, searchKeyword: '' });
    get().startSSE();
  },

  setSearchKeyword: (keyword) => {
    set({ searchKeyword: keyword });
  },

  // 启动 SSE 连接
  startSSE: () => {
    const { eventSource: existingES, activeType, searchKeyword } = get();
    
    // 关闭现有连接
    if (existingES) {
      existingES.close();
    }

    set({ loading: true });

    // 网关模式
    const gatewayResult = createGatewayConnection<{ tasks?: Task[] }>(
      'tasks.list',
      { type: activeType, keyword: searchKeyword || '' },
      (data) => {
        const tasks: Task[] = (data.tasks || []).sort((a: Task, b: Task) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        const { prevTaskStatus, visible } = get();
        const addMessage = useMessageStore.getState().addMessage;
        const currentUser = useAuthStore.getState().user;
        const currentNickName = currentUser?.nick_name;
        const newRunningIds = new Set<string>();

        tasks.forEach((task: Task) => {
          const prevStatus = prevTaskStatus.get(task.id);
          
          // 更新运行中任务集合
          if (task.status === 'pending' || task.status === 'running') {
            newRunningIds.add(task.id);
          }

          // 检测状态变化，判断是否需要发送消息通知
          const isOwnTask = !task.nick_name || task.nick_name === currentNickName;
          
          if (prevStatus && prevStatus !== task.status && isOwnTask) {
            if (task.status === 'success') {
              addMessage({
                type: 'success',
                title: `${TASK_TYPE_NAMES[task.type] || '任务'}完成`,
                content: task.type_text || '任务执行成功',
                action: { type: 'task-center' },
              });
            } else if (task.status === 'failed') {
              addMessage({
                type: 'error',
                title: `${TASK_TYPE_NAMES[task.type] || '任务'}失败`,
                content: task.error_message || '任务执行失败',
                action: { type: 'task-center' },
              });
            }
          }

          prevTaskStatus.set(task.id, task.status);
        });

        set({
          taskList: tasks,
          loading: false,
          runningTaskIds: newRunningIds,
          prevTaskStatus: new Map(prevTaskStatus),
        });

        // 如果没有运行中的任务且弹框已关闭，断开 SSE
        if (newRunningIds.size === 0 && !visible) {
          get().stopSSE();
        }
      },
      () => {
        set({ loading: false });
        get().stopSSE();
      },
    );

    if (gatewayResult) {
      set({ eventSource: gatewayResult });
      return;
    }

    // 旧模式
    const token = getToken();
    const baseUrl = import.meta.env.VITE_SSE_BASE_URL || import.meta.env.VITE_API_BASE_URL || '';
    const keyword = searchKeyword ? `&keyword=${encodeURIComponent(searchKeyword)}` : '';
    const url = `${baseUrl}/tasks/list?type=${activeType}${keyword}&token=${token}`;

    const eventSource = new EventSource(url);

    eventSource.addEventListener('data', (event) => {
      try {
        const data = JSON.parse(event.data);
        const tasks: Task[] = (data.tasks || []).sort((a: Task, b: Task) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        const { prevTaskStatus, visible } = get();
        const addMessage = useMessageStore.getState().addMessage;
        const currentUser = useAuthStore.getState().user;
        const currentNickName = currentUser?.nick_name;
        const newRunningIds = new Set<string>();

        tasks.forEach((task: Task) => {
          const prevStatus = prevTaskStatus.get(task.id);
          
          // 更新运行中任务集合
          if (task.status === 'pending' || task.status === 'running') {
            newRunningIds.add(task.id);
          }

          // 检测状态变化，判断是否需要发送消息通知
          const isOwnTask = !task.nick_name || task.nick_name === currentNickName;
          
          if (prevStatus && prevStatus !== task.status && isOwnTask) {
            if (task.status === 'success') {
              addMessage({
                type: 'success',
                title: `${TASK_TYPE_NAMES[task.type] || '任务'}完成`,
                content: task.type_text || '任务执行成功',
                action: { type: 'task-center' },
              });
            } else if (task.status === 'failed') {
              addMessage({
                type: 'error',
                title: `${TASK_TYPE_NAMES[task.type] || '任务'}失败`,
                content: task.error_message || '任务执行失败',
                action: { type: 'task-center' },
              });
            }
          }

          prevTaskStatus.set(task.id, task.status);
        });

        set({
          taskList: tasks,
          loading: false,
          runningTaskIds: newRunningIds,
          prevTaskStatus: new Map(prevTaskStatus),
        });

        // 如果没有运行中的任务且弹框已关闭，断开 SSE
        if (newRunningIds.size === 0 && !visible) {
          get().stopSSE();
        }
      } catch {
        // 静默处理解析错误
      }
    });

    eventSource.onerror = () => {
      set({ loading: false });
      get().stopSSE();
    };

    eventSource.addEventListener('complete', () => {
      get().stopSSE();
    });

    set({ eventSource });
  },

  // 停止 SSE 连接
  stopSSE: () => {
    const { eventSource } = get();
    if (eventSource) {
      eventSource.close();
      set({ eventSource: null });
    }
  },

  // 添加运行中的任务（创建任务时调用）
  addRunningTask: (taskId, taskType) => {
    const { runningTaskIds: currentRunningIds, activeType, eventSource } = get();
    
    // 添加到运行中任务集合
    const newRunningIds = new Set(currentRunningIds);
    newRunningIds.add(taskId);
    set({ runningTaskIds: newRunningIds });

    // 如果当前没有 SSE 连接，或者任务类型与当前激活类型一致，启动/刷新 SSE
    if (!eventSource) {
      // 切换到对应的任务类型
      set({ activeType: taskType as 'analysis' | 'es_export' | 'sql_export' });
      get().startSSE();
    } else if (taskType === activeType) {
      // 刷新当前列表
      get().startSSE();
    }
  },

  // 刷新任务列表
  refreshTaskList: () => {
    get().startSSE();
  },
}));
