/**
 * SQL变更申请页面 - 参考Vue版本
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  type ApplyItem, type ApplyDetail, getApplyDetail,
  APPLY_STATUS_MAP
} from '../../../services/sql/apply';
import { SSEGateway, CHANNELS } from '../../../services/sse';
import { useSSESubscription } from '../../../services/sse/hooks/useSSESubscription';
import type { SSEConnectionState } from '../../../services/sse/types';
import ApplyDetailDrawer from './ApplyDetail';
import ApplyCreateDrawer from './ApplyCreate';
import { openDesktopNotifyWindow } from '@/utils/window';
import { useAuthStore } from '@/stores';
import { useMessageStore } from '@/stores/messageStore';
import './index.css';

const SqlApply = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [applyList, setApplyList] = useState<ApplyItem[]>([]);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [sseStatus, setSseStatus] = useState<SSEConnectionState>('closed');
  const connectedAtRef = useRef<number>(0);
  const [sseDuration, setSseDuration] = useState('');
  const [sseTooltipVisible, setSseTooltipVisible] = useState(false);
  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const trackedIdsRef = useRef<Set<string>>(new Set());

  // 筛选状态
  const [filterSubmitter, setFilterSubmitter] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  // 实际应用的筛选条件
  const [appliedSubmitter, setAppliedSubmitter] = useState<string>('');
  const [appliedStatus, setAppliedStatus] = useState<string>('');

  const [createVisible, setCreateVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentDetail, setCurrentDetail] = useState<ApplyDetail | null>(null);
  const [prefillData, setPrefillData] = useState<Partial<ApplyItem> | null>(null);

  const currentUser = useAuthStore(s => s.user);
  const myName = currentUser?.nick_name || currentUser?.user_name || '';

  // 格式化连接时长
  const formatDuration = (ms: number) => {
    if (ms < 1000) return '刚刚连接';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s} 秒`;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    if (m < 60) return `${m} 分 ${sec} 秒`;
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${h} 时 ${min} 分`;
  };

  // SSEGateway 连接状态监听
  useEffect(() => {
    const gateway = SSEGateway.getInstance();
    if (!gateway) return;

    const updateState = () => {
      const st = gateway.getState();
      setSseStatus(st);
      if (st === 'open') {
        if (!connectedAtRef.current) connectedAtRef.current = Date.now();
      } else {
        connectedAtRef.current = 0;
      }
    };

    const unsub = gateway.on('stateChange', updateState);
    updateState();
    return unsub;
  }, []);

  // 连接时长计时
  useEffect(() => {
    const timer = setInterval(() => {
      if (sseStatus === 'open' && connectedAtRef.current) {
        setSseDuration(formatDuration(Date.now() - connectedAtRef.current));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [sseStatus]);

  // 通知逻辑（数据去重 + 桌面通知）
  const handleSSEData = useCallback((data: { apply?: ApplyItem[]; total_count?: number }) => {
    const items = data.apply || [];
    if (items.length === 0) return;

    const currentIds = new Set(items.map(item => item.id));
    items.forEach(item => {
      const st = String(item.status);
      const isNew = !prevIdsRef.current.has(item.id);
      const isMyJob = st === '1' && item.executor_name === myName;

      if (isNew) {
        if (isMyJob && !notifiedIdsRef.current.has(item.id)) {
          notifiedIdsRef.current.add(item.id);
          trackedIdsRef.current.add(item.id);
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
              payload: JSON.stringify({ applyId: item.id, project: item.project, description: item.description || item.remark || '' }),
            },
            extra: { applyId: item.id },
          });
        }
      } else {
        if (isMyJob && !notifiedIdsRef.current.has(item.id)) {
          notifiedIdsRef.current.add(item.id);
          trackedIdsRef.current.add(item.id);
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
              payload: JSON.stringify({ applyId: item.id, project: item.project, description: item.description || item.remark || '' }),
            },
            extra: { applyId: item.id },
          });
        } else if (trackedIdsRef.current.has(item.id) && !isMyJob) {
          trackedIdsRef.current.delete(item.id);
          useMessageStore.getState().messages.forEach(msg => {
            if (msg.extra?.applyId === item.id && !msg.read) {
              useMessageStore.getState().markAsRead(msg.id);
            }
          });
        }
      }
    });
    prevIdsRef.current = currentIds;
    setApplyList(items);
    setLoading(false);
  }, [myName]);

  // 通过全局网关订阅数据
  useSSESubscription({
    channel: CHANNELS.SQL_APPLY_LIST,
    params: { submitter_name: appliedSubmitter, status: appliedStatus },
    onData: handleSSEData,
    onError: () => setLoading(false),
    onComplete: () => setLoading(false),
    enabled: true,
  });

  const handleViewDetail = async (item: ApplyItem) => {
    try {
      const res = await getApplyDetail(item.id);
      if (res.code === 200 && res.data) {
        setCurrentDetail(res.data);
        setDetailVisible(true);
      }
    } catch (error) {
      console.error('获取详情失败:', error);
    }
  };

  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    prevIdsRef.current = new Set();
    notifiedIdsRef.current = new Set();
    setLoading(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, [refreshing]);

  const handleResubmit = (data: Partial<ApplyItem>) => {
    setPrefillData(data);
    setDetailVisible(false);
    setCreateVisible(true);
  };

  const getStatusInfo = (status: number | string) => {
    const key = String(status);
    return APPLY_STATUS_MAP[key] || APPLY_STATUS_MAP[Number(status)] || { text: status, type: 'info' };
  };

  // 执行搜索
  const handleSearch = () => {
    setAppliedSubmitter(filterSubmitter);
    setAppliedStatus(filterStatus);
  };

  // 处理回车键
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 重置筛选
  const handleResetFilter = () => {
    setFilterSubmitter('');
    setFilterStatus('');
    setAppliedSubmitter('');
    setAppliedStatus('');
  };

  // 参数变化时 useSSESubscription 自动重新订阅

  return (
    <div className="sql-apply-page">
      <div className="apply-card">
        <div className="card-header">
          <span className="card-title">
            SQL变更申请
            <span
              className="sse-dot-wrap"
              onMouseEnter={() => setSseTooltipVisible(true)}
              onMouseLeave={() => setSseTooltipVisible(false)}
            >
              <span className={`sse-dot sse-dot--${sseStatus === 'reconnecting' ? 'connecting' : sseStatus}`} />
              {sseTooltipVisible && (
                <span className="sse-tooltip">
                  {sseStatus === 'open' ? `SSE 已连接 · ${sseDuration}` : sseStatus === 'connecting' || sseStatus === 'reconnecting' ? 'SSE 重连中...' : 'SSE 已断开'}
                </span>
              )}
            </span>
          </span>
          <div className="card-actions">
            <input
              type="text"
              className="filter-input"
              placeholder="搜索创建人"
              value={filterSubmitter}
              onChange={e => setFilterSubmitter(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <select 
              className="filter-select"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="">全部状态</option>
              <option value="0">待审批</option>
              <option value="1">待执行</option>
              <option value="2">执行中</option>
              <option value="3">执行完成</option>
              <option value="4">执行失败</option>
              <option value="5">已驳回</option>
              <option value="6">已撤销</option>
            </select>
            <button className="btn btn-primary" onClick={handleSearch}>
              搜索
            </button>
            {(appliedSubmitter || appliedStatus) && (
              <button className="btn btn-default" onClick={handleResetFilter}>
                重置
              </button>
            )}
            <button className="btn btn-default" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? '刷新中...' : '刷新'}
            </button>
            <button className="btn btn-primary" onClick={() => { setPrefillData(null); setCreateVisible(true); }}>
              + 新建申请
            </button>
          </div>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="loading-state">加载中...</div>
          ) : (
            <table className="apply-table">
              <thead>
                <tr>
                  <th>申请ID</th>
                  <th>所属项目</th>
                  <th>创建人</th>
                  <th>审批人</th>
                  <th>执行人</th>
                  <th>当前操作人</th>
                  <th>申请说明</th>
                  <th>执行时间</th>
                  <th>申请时间</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {applyList.length === 0 ? (
                  <tr><td colSpan={11} className="empty-row">暂无数据</td></tr>
                ) : applyList.map(item => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.project}</td>
                    <td>{item.submitter_name}</td>
                    <td>{item.apply_name || '-'}</td>
                    <td>{item.executor_name || '-'}</td>
                    <td>{item.current_operator || '-'}</td>
                    <td title={item.description}>{item.description || '-'}</td>
                    <td>{item.execution_time || '立即执行'}</td>
                    <td>{item.created_at || '-'}</td>
                    <td>
                      <span className={`status-tag status-${getStatusInfo(item.status).type}`}>
                        {getStatusInfo(item.status).text}
                      </span>
                    </td>
                    <td>
                      <button className="link-btn" onClick={() => handleViewDetail(item)}>详情</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {createVisible && (
        <ApplyCreateDrawer
          prefillData={prefillData}
          onClose={() => setCreateVisible(false)}
          onSuccess={() => setCreateVisible(false)}
        />
      )}

      {detailVisible && currentDetail && (
        <ApplyDetailDrawer
          detail={currentDetail}
          onClose={() => setDetailVisible(false)}
          onRefresh={() => { prevIdsRef.current = new Set(); setLoading(true); }}
          onResubmit={handleResubmit}
        />
      )}

    </div>
  );
};

export default SqlApply;
