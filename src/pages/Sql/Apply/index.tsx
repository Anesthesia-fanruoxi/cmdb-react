/**
 * SQL变更申请页面 - 参考Vue版本
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getApplyListSSE, type ApplyItem, type ApplyDetail, getApplyDetail,
  APPLY_STATUS_MAP
} from '../../../services/sql/apply';
import ApplyDetailDrawer from './ApplyDetail';
import ApplyCreateDrawer from './ApplyCreate';
import './index.css';

const SqlApply = () => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [applyList, setApplyList] = useState<ApplyItem[]>([]);
  const sseRef = useRef<EventSource | null>(null);
  
  const [createVisible, setCreateVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentDetail, setCurrentDetail] = useState<ApplyDetail | null>(null);
  const [prefillData, setPrefillData] = useState<Partial<ApplyItem> | null>(null);

  const fetchApplyListSSE = useCallback(() => {
    setLoading(true);
    if (sseRef.current) sseRef.current.close();
    sseRef.current = getApplyListSSE(
      (data) => { setApplyList(data); setLoading(false); },
      () => { setLoading(false); },
      () => setLoading(false)
    );
  }, []);

  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    const startTime = Date.now();
    if (sseRef.current) sseRef.current.close();
    sseRef.current = getApplyListSSE(
      (data) => {
        setApplyList(data);
        const remaining = Math.max(0, 1000 - (Date.now() - startTime));
        setTimeout(() => setRefreshing(false), remaining);
      },
      () => setRefreshing(false),
      () => {}
    );
  }, [refreshing]);

  useEffect(() => {
    fetchApplyListSSE();
    return () => { if (sseRef.current) sseRef.current.close(); };
  }, [fetchApplyListSSE]);

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

  const handleResubmit = (data: Partial<ApplyItem>) => {
    setPrefillData(data);
    setDetailVisible(false);
    setCreateVisible(true);
  };

  const getStatusInfo = (status: number | string) => {
    const key = String(status);
    return APPLY_STATUS_MAP[key] || APPLY_STATUS_MAP[Number(status)] || { text: status, type: 'info' };
  };

  return (
    <div className="sql-apply-page">
      <div className="apply-card">
        <div className="card-header">
          <span className="card-title">SQL变更申请</span>
          <div className="card-actions">
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
                  <th>所属项目</th>
                  <th>创建人</th>
                  <th>申请说明</th>
                  <th>当前操作人</th>
                  <th>执行时间</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {applyList.length === 0 ? (
                  <tr><td colSpan={7} className="empty-row">暂无数据</td></tr>
                ) : applyList.map(item => (
                  <tr key={item.id}>
                    <td>{item.project}</td>
                    <td>{item.submitter_name}</td>
                    <td>{item.description || '-'}</td>
                    <td>{item.current_operator || '-'}</td>
                    <td>{item.execution_time || '立即执行'}</td>
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
          onSuccess={() => { setCreateVisible(false); fetchApplyListSSE(); }}
        />
      )}

      {detailVisible && currentDetail && (
        <ApplyDetailDrawer
          detail={currentDetail}
          onClose={() => setDetailVisible(false)}
          onRefresh={fetchApplyListSSE}
          onResubmit={handleResubmit}
        />
      )}
    </div>
  );
};

export default SqlApply;
