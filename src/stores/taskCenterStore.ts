/**
 * 任务中心全局 Store
 * - 登录后由 authStore 调用 start() 建立全局订阅 tasks.list
 * - 桌面通知 + 消息中心写入由本 store 集中处理
 * - 登出时由 authStore 调用 stop() 清理
 */

import { create } from 'zustand';
import { useMessageStore } from './messageStore';
import { useAuthStore } from './authStore';
import { SSEGateway } from '@/services/sse';
import type { SSEConnectionState, Subscription } from '@/services/sse';
import type { Task } from '../services/task';
import { toast } from '@/components/Toast';

const TASK_TYPE_NAMES: Record<string, string> = {
  analysis: '数据分析',
  es_export: '日志导出',
  sql_export: 'SQL导出',
};

type SSEData = { tasks?: Task[] };

interface TaskCenterState {
  visible: boolean;
  activeType: 'analysis' | 'es_export' | 'sql_export';
  searchKeyword: string;
  /** 全量任务列表（3种类型合并） */
  taskList: Task[];
  loading: boolean;
  runningTaskIds: Set<string>;
  prevTaskStatus: Map<string, string>;
  sseStatus: SSEConnectionState;

  open: () => void;
  close: () => void;
  toggle: () => void;
  setActiveType: (type: 'analysis' | 'es_export' | 'sql_export') => void;
  setSearchKeyword: (keyword: string) => void;
  start: () => void;
  stop: () => void;
  reset: () => void;
  refreshTaskList: () => void;
  addRunningTask: (taskId: string, taskType: string) => void;
}

const SUBSCRIPTION_IDS = ['analysis_list', 'es_export_list', 'sql_export_list'] as const;
const SUBSCRIPTION_CHANNELS = ['tasks.list.analysis', 'tasks.list.es_export', 'tasks.list.sql_export'] as const;

let analysisListRef: Subscription<SSEData> | null = null;
let esExportListRef: Subscription<SSEData> | null = null;
let sqlExportListRef: Subscription<SSEData> | null = null;
let started = false;

const prevTaskStatus = new Map<string, string>();

function ensureGateway(): SSEGateway {
  let gateway = SSEGateway.getInstance();
  if (!gateway) {
    const baseUrl = import.meta.env.VITE_SSE_BASE_URL || import.meta.env.VITE_API_BASE_URL || '';
    SSEGateway.getInstance({ url: `${baseUrl}/gateway`, subscribeApiUrl: baseUrl });
    gateway = SSEGateway.getInstance()!;
  }
  return gateway;
}

/**
 * 创建按类型合并数据的回调
 * 每个订阅推送时，用新数据替换同类型的旧数据，保留其他类型
 */
function createHandleData(taskType: string) {
  return (data: SSEData) => {
    const incoming: Task[] = (data.tasks || []);

    const addMessage = useMessageStore.getState().addMessage;
    const currentUser = useAuthStore.getState().user;
    const currentNickName = currentUser?.nick_name || '';
    const newRunningIds = new Set<string>();

    incoming.forEach((task: Task) => {
      const prevStatus = prevTaskStatus.get(task.id);
      if (task.status === 'pending' || task.status === 'running') {
        newRunningIds.add(task.id);
      }
      const isOwnTask = !task.nick_name || task.nick_name === currentNickName;
      if (prevStatus && prevStatus !== task.status && isOwnTask) {
        if (task.status === 'success') {
          addMessage({
            type: 'success',
            title: `${TASK_TYPE_NAMES[task.type] || '任务'}完成`,
            content: task.type_text || '任务执行成功',
            action: { type: 'task-center' },
          });
          toast.success(`${TASK_TYPE_NAMES[task.type] || '任务'}成功，点击跳转任务中心`, undefined, () => {
            useTaskCenterStore.getState().open();
          });
        } else if (task.status === 'failed') {
          addMessage({
            type: 'error',
            title: `${TASK_TYPE_NAMES[task.type] || '任务'}失败`,
            content: task.error_message || '任务执行失败',
            action: { type: 'task-center' },
          });
          toast.error(`${TASK_TYPE_NAMES[task.type] || '任务'}失败，点击跳转任务中心`, undefined, () => {
            useTaskCenterStore.getState().open();
          });
        }
      }
      prevTaskStatus.set(task.id, task.status);
    });

    // 合并：保留其他类型的任务，用新数据替换当前类型
    const current = useTaskCenterStore.getState().taskList;
    const other = current.filter(t => t.type !== taskType);
    const merged = [...other, ...incoming].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // 收集所有非 pending/running 的 runningTaskIds
    merged.forEach(t => {
      if (t.status === 'pending' || t.status === 'running') {
        newRunningIds.add(t.id);
      }
    });

    useTaskCenterStore.setState({
      taskList: merged,
      loading: false,
      runningTaskIds: newRunningIds,
    });
  };
}

export const useTaskCenterStore = create<TaskCenterState>((set, get) => ({
  visible: false,
  activeType: 'analysis',
  searchKeyword: '',
  taskList: [],
  loading: false,
  runningTaskIds: new Set(),
  prevTaskStatus: new Map(),
  sseStatus: 'closed',

  open: () => set({ visible: true }),
  close: () => set({ visible: false }),
  toggle: () => set(s => ({ visible: !s.visible })),

  setActiveType: (type) => {
    set({ activeType: type, searchKeyword: '' });
  },

  setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),

  // 全局启动（登录时调用）
  start: () => {
    if (started) return;
    started = true;

    const gateway = ensureGateway();
    if (gateway.getState() === 'closed') gateway.connect();

    const taskTypes = ['analysis', 'es_export', 'sql_export'] as const;

    [analysisListRef, esExportListRef, sqlExportListRef] = SUBSCRIPTION_IDS.map((id, i) =>
      gateway.subscribe<SSEData>({
        id,
        channel: SUBSCRIPTION_CHANNELS[i],
        params: {},
        onData: createHandleData(taskTypes[i]),
        onError: () => {
          useTaskCenterStore.setState({ loading: false });
        },
      })
    );

    useTaskCenterStore.setState({ sseStatus: gateway.getState() });
  },

  // 全局停止（登出时调用）
  stop: () => {
    if (analysisListRef) {
      analysisListRef.unsubscribe();
      analysisListRef = null;
    }
    if (esExportListRef) {
      esExportListRef.unsubscribe();
      esExportListRef = null;
    }
    if (sqlExportListRef) {
      sqlExportListRef.unsubscribe();
      sqlExportListRef = null;
    }
    started = false;
    // 注意：不清空 prevTaskStatus，保留状态追踪以避免 refreshTaskList 后丢失通知
    useTaskCenterStore.setState({
      taskList: [],
      runningTaskIds: new Set(),
      loading: false,
      sseStatus: 'closed',
    });
  },

  // 登出时完整重置（清空状态追踪）
  reset: () => {
    get().stop();
    prevTaskStatus.clear();
  },

  // 刷新任务列表（重新订阅）
  refreshTaskList: () => {
    get().stop();
    get().start();
  },

  // 添加运行中的任务（创建任务时调用）
  addRunningTask: (taskId: string, _taskType: string) => {
    const { runningTaskIds: currentRunningIds } = get();
    const newRunningIds = new Set(currentRunningIds);
    newRunningIds.add(taskId);
    set({ runningTaskIds: newRunningIds });

    // 预设初始状态，确保后续 SSE 推送有对比基准（不会因 stop 清空而丢失通知）
    prevTaskStatus.set(taskId, 'pending');
    // 不主动 refreshTaskList，后端 eventbus.Task 会通过 SSE 自然推送任务列表更新
  },
}));
