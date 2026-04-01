/**
 * SQL变更申请页面 - 参考Vue版本
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  
  // 筛选状态
  const [filterSubmitter, setFilterSubmitter] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

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

  // 筛选后的列表
  const filteredList = useMemo(() => {
    return applyList.filter(item => {
      // 按创建人筛选
      if (filterSubmitter && !item.submitter_name?.toLowerCase().includes(filterSubmitter.toLowerCase())) {
        return false;
      }
      // 按状态筛选
      if (filterStatus && String(item.status) !== filterStatus) {
        return false;
      }
      return true;
    });
  }, [applyList, filterSubmitter, filterStatus]);

  // 重置筛选
  const handleResetFilter = () => {
    setFilterSubmitter('');
    setFilterStatus('');
  };

  return (
    <div className="sql-apply-page">
      <div className="apply-card">
        <div className="card-header">
          <span className="card-title">SQL变更申请</span>
          <div className="card-actions">
            <input
              type="text"
              className="filter-input"
              placeholder="搜索创建人"
              value={filterSubmitter}
              onChange={e => setFilterSubmitter(e.target.value)}
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
            {(filterSubmitter || filterStatus) && (
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
                  <th>数据库</th>
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
                {filteredList.length === 0 ? (
                  <tr><td colSpan={12} className="empty-row">暂无数据</td></tr>
                ) : filteredList.map(item => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.project}</td>
                    <td>{item.database_name || '-'}</td>
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
