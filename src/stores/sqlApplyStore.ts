/**
 * SQL 申请全局 Store
 * - 登录后由 authStore 调用 start() 建立全局订阅 sql.apply.list
 * - 桌面通知 + 消息中心写入由本 store 集中处理，不再依赖 SqlApply 页面
 * - 登出时由 authStore 调用 stop() 清理订阅与状态
 */

import { create } from 'zustand';
import type { ApplyItem } from '@/services/sql/apply';
import { SSEGateway, CHANNELS } from '@/services/sse';
import type { SSEConnectionState, Subscription } from '@/services/sse';
import { openDesktopNotifyWindow } from '@/utils/window';
import { useAuthStore } from './authStore';
import { useMessageStore } from './messageStore';

interface ApplyFilter {
  submitter_name: string;
  status: string;
}

type SSEData = { apply?: ApplyItem[]; total_count?: number };

interface SqlApplyState {
  applyList: ApplyItem[];
  loading: boolean;
  sseStatus: SSEConnectionState;
  /** 0 表示未连接 */
  sseConnectedAt: number;
  filter: ApplyFilter;

  start: () => void;
  stop: () => void;
  setFilter: (filter: Partial<ApplyFilter>) => void;
  /** 重置已见 ID 集合（用于详情抽屉刷新场景） */
  resetSeen: () => void;
}

const SUBSCRIPTION_ID = 'global_sql_apply_list';

// 订阅与状态相关的内部引用（非响应式）
let subscriptionRef: Subscription<SSEData> | null = null;
let gatewayUnsubRef: (() => void) | null = null;
let started = false;

const prevIds = new Set<string>();
const notifiedIds = new Set<string>();
const trackedIds = new Set<string>();

function ensureGateway(): SSEGateway {
  let gateway = SSEGateway.getInstance();
  if (!gateway) {
    const baseUrl = import.meta.env.VITE_SSE_BASE_URL || import.meta.env.VITE_API_BASE_URL || '';
    SSEGateway.getInstance({ url: `${baseUrl}/gateway`, subscribeApiUrl: baseUrl });
    gateway = SSEGateway.getInstance()!;
  }
  return gateway;
}

function handleData(data: SSEData) {
  const items = data.apply || [];
  // 即使为空也要更新 loading（首次推送可能为空）
  useSqlApplyStore.setState({ applyList: items, loading: false });
  if (items.length === 0) {
    prevIds.clear();
    return;
  }

  const currentUser = useAuthStore.getState().user;
  const myName = currentUser?.nick_name || currentUser?.user_name || '';

  const currentIds = new Set(items.map(item => item.id));
  items.forEach(item => {
    const st = String(item.status);
    const isNew = !prevIds.has(item.id);
    const isMyJob = st === '1' && item.executor_name === myName;

    if (isNew) {
      if (isMyJob && !notifiedIds.has(item.id)) {
        notifiedIds.add(item.id);
        trackedIds.add(item.id);
        openDesktopNotifyWindow({
          title: 'SQL 审批通知',
          subtitle: `${item.submitter_name} · ${item.created_at || '刚刚'}`,
          applyId: item.id,
          project: item.project,
          description: item.description || item.remark || '',
        });
        useMessageStore.getState().addMessage({
          type: 'info',
          title: 'SQL 审批通知',
          content: `${item.project} · ${(item.description || item.remark || '').slice(0, 30)}`,
          action: {
            type: 'sql_approval',
            payload: JSON.stringify({
              applyId: item.id,
              project: item.project,
              description: item.description || item.remark || '',
            }),
          },
          extra: { applyId: item.id },
        });
      }
    } else {
      if (isMyJob && !notifiedIds.has(item.id)) {
        notifiedIds.add(item.id);
        trackedIds.add(item.id);
        openDesktopNotifyWindow({
          title: 'SQL 审批通知',
          subtitle: `${item.submitter_name} · ${item.created_at || '刚刚'}`,
          applyId: item.id,
          project: item.project,
          description: item.description || item.remark || '',
        });
        useMessageStore.getState().addMessage({
          type: 'info',
          title: 'SQL 审批通知',
          content: `${item.project} · ${(item.description || item.remark || '').slice(0, 30)}`,
          action: {
            type: 'sql_approval',
            payload: JSON.stringify({
              applyId: item.id,
              project: item.project,
              description: item.description || item.remark || '',
            }),
          },
          extra: { applyId: item.id },
        });
      } else if (trackedIds.has(item.id) && !isMyJob) {
        trackedIds.delete(item.id);
        useMessageStore.getState().messages.forEach(msg => {
          if (msg.extra?.applyId === item.id && !msg.read) {
            useMessageStore.getState().markAsRead(msg.id);
          }
        });
      }
    }
  });

  // 更新 prevIds
  prevIds.clear();
  currentIds.forEach(id => prevIds.add(id));
}

function subscribeOnce(filter: ApplyFilter) {
  const gateway = ensureGateway();
  if (gateway.getState() === 'closed') {
    gateway.connect();
  }
  subscriptionRef = gateway.subscribe<SSEData>({
    id: SUBSCRIPTION_ID,
    channel: CHANNELS.SQL_APPLY_LIST,
    params: { submitter_name: filter.submitter_name, status: filter.status },
    onData: handleData,
    onError: () => {
      useSqlApplyStore.setState({ loading: false });
    },
    onComplete: () => {
      useSqlApplyStore.setState({ loading: false });
    },
  });
}

export const useSqlApplyStore = create<SqlApplyState>()((set, get) => ({
  applyList: [],
  loading: true,
  sseStatus: 'closed',
  sseConnectedAt: 0,
  filter: { submitter_name: '', status: '' },

  start: () => {
    if (started) return;
    started = true;

    const gateway = ensureGateway();

    // 监听连接状态
    const updateState = () => {
      const st = gateway.getState();
      set(state => ({
        sseStatus: st,
        sseConnectedAt: st === 'open'
          ? (state.sseConnectedAt || Date.now())
          : 0,
      }));
    };
    gatewayUnsubRef = gateway.on('stateChange', updateState);
    updateState();

    if (gateway.getState() === 'closed') {
      gateway.connect();
    }

    // 建立全局订阅
    set({ loading: true });
    subscribeOnce(get().filter);
  },

  stop: () => {
    if (!started) return;
    started = false;

    subscriptionRef?.unsubscribe();
    subscriptionRef = null;
    gatewayUnsubRef?.();
    gatewayUnsubRef = null;

    prevIds.clear();
    notifiedIds.clear();
    trackedIds.clear();

    set({
      applyList: [],
      loading: true,
      sseStatus: 'closed',
      sseConnectedAt: 0,
      filter: { submitter_name: '', status: '' },
    });
  },

  setFilter: (filter) => {
    const next: ApplyFilter = { ...get().filter, ...filter };
    set({ filter: next });
    if (!started) return;

    // 取消旧订阅，使用新参数重新订阅（沿用同一稳定 ID）
    subscriptionRef?.unsubscribe();
    subscriptionRef = null;
    prevIds.clear();
    set({ loading: true });
    subscribeOnce(next);
  },

  resetSeen: () => {
    prevIds.clear();
    set({ loading: true });
  },
}));
