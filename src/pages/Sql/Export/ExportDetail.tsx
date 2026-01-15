/**
 * 数据导出申请详情组件
 * 包含审批、审核、执行等操作逻辑
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  getExportDetail, updateExport, resendEmail, getDatabases,
  EXPORT_STATUS_MAP, type ExportDetail 
} from '@/services/sql';
import { useAuthStore } from '@/stores';
import { toast } from '@/components/AppNotification';
import { confirm } from '@/components/ConfirmModal';

interface Props {
  visible: boolean;
  exportId: string | null;
  onClose: () => void;
  onRefresh: () => void;
}

const ExportDetailDrawer = ({ visible, exportId, onClose, onRefresh }: Props) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ExportDetail | null>(null);
  const [databases, setDatabases] = useState<string[]>([]);
  
  // 审批表单
  const [approveForm, setApproveForm] = useState({ database: '', sql: '' });
  // 审核表单
  const [reviewForm, setReviewForm] = useState({ rule_check_result: '' });

  // 获取当前用户ID
  const currentUserId = Number(user?.id) || 0;

  // 角色判断
  const isSubmitterActionable = useMemo(() => {
    if (!detail) return false;
    return currentUserId === Number(detail.submitter_id) && detail.submitter_status === 1;
  }, [detail, currentUserId]);

  const isApproverActionable = useMemo(() => {
    if (!detail) return false;
    const applyId = Number(detail.apply_id) || 0;
    const applyStatus = Number(detail.apply_status) || 0;
    return currentUserId === applyId && applyStatus === 1;
  }, [detail, currentUserId]);

  const isReviewerActionable = useMemo(() => {
    if (!detail) return false;
    return currentUserId === Number(detail.reviewer_id) && detail.reviewer_status === 1;
  }, [detail, currentUserId]);

  const isExecutorActionable = useMemo(() => {
    if (!detail) return false;
    const executorId = Number(detail.executor_id) || 0;
    const executorStatus = Number(detail.executor_status) || 0;
    return currentUserId === executorId && executorStatus === 1;
  }, [detail, currentUserId]);

  const isResendEmailActionable = useMemo(() => {
    if (!detail) return false;
    return currentUserId === Number(detail.executor_id) && detail.status === 11;
  }, [detail, currentUserId]);


  // 获取详情数据
  const fetchDetail = async () => {
    if (!exportId) return;
    setLoading(true);
    try {
      const res = await getExportDetail(exportId);
      if (res.code === 200 && res.data) {
        setDetail(res.data);
        if (res.data.sql_content) {
          setApproveForm(prev => ({ ...prev, sql: res.data.sql_content || '' }));
        }
        // 获取数据库列表
        if (res.data.project) {
          const dbRes = await getDatabases({ agent: res.data.project });
          if (dbRes.code === 200 && dbRes.data?.databases) {
            setDatabases(dbRes.data.databases);
          }
        }
      }
    } catch {
      // 静默处理
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && exportId) {
      fetchDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, exportId]);

  // 撤回申请
  const handleWithdraw = async () => {
    if (!detail) return;
    const confirmed = await confirm({
      title: '撤回确认',
      content: '确定要撤回此导出申请吗？',
      type: 'warning'
    });
    if (!confirmed) return;
    try {
      setLoading(true);
      await updateExport({ id: detail.id, process_type: 0 });
      toast.success('申请已撤回');
      onRefresh();
      onClose();
    } catch {
      toast.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 审批通过（已有SQL）
  const handleApproveWithSql = async () => {
    if (!detail) return;
    try {
      setLoading(true);
      await updateExport({ id: detail.id, process_type: 1 });
      toast.success('审批通过');
      onRefresh();
      onClose();
    } catch {
      toast.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 审批通过（填写SQL）
  const handleApprove = async () => {
    if (!detail) return;
    if (!approveForm.database || !approveForm.sql) {
      toast.warning('请填写数据库和SQL语句');
      return;
    }
    try {
      setLoading(true);
      await updateExport({ 
        id: detail.id, 
        database_name: approveForm.database, 
        sql_content: approveForm.sql 
      });
      toast.success('审批通过');
      onRefresh();
      onClose();
    } catch {
      toast.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 审批拒绝
  const handleApproveReject = async () => {
    if (!detail) return;
    const confirmed = await confirm({
      title: '拒绝确认',
      content: '确定要拒绝此导出申请吗？',
      type: 'danger'
    });
    if (!confirmed) return;
    try {
      setLoading(true);
      await updateExport({ id: detail.id, process_type: 0 });
      toast.success('已拒绝该申请');
      onRefresh();
      onClose();
    } catch {
      toast.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 审核通过
  const handleReviewPass = async () => {
    if (!detail) return;
    try {
      setLoading(true);
      await updateExport({ id: detail.id, process_type: 1 });
      toast.success('审核通过');
      onRefresh();
      onClose();
    } catch {
      toast.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 审核拒绝
  const handleReviewReject = async () => {
    if (!detail) return;
    const confirmed = await confirm({
      title: '审核确认',
      content: '确定审核不通过此申请吗？',
      type: 'danger'
    });
    if (!confirmed) return;
    try {
      setLoading(true);
      await updateExport({ id: detail.id, process_type: 0 });
      toast.success('审核不通过');
      onRefresh();
      onClose();
    } catch {
      toast.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 开始执行
  const handleExecute = async () => {
    if (!detail) return;
    try {
      setLoading(true);
      await updateExport({ id: detail.id, process_type: 1 });
      toast.success('执行完成');
      onRefresh();
      onClose();
    } catch {
      toast.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 重发邮件
  const handleResendEmail = async () => {
    if (!detail) return;
    try {
      setLoading(true);
      await resendEmail({ id: detail.id });
      toast.success('邮件重新发送请求已提交');
      onRefresh();
      onClose();
    } catch {
      toast.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status: number) => EXPORT_STATUS_MAP[status] || { text: '未知', type: 'default' };

  if (!visible) return null;


  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer drawer-lg" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <h4>数据导出申请详情</h4>
          {detail && <span className={`tag tag-${getStatusInfo(detail.status).type}`}>{getStatusInfo(detail.status).text}</span>}
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="drawer-body">
          {loading && <div className="loading">加载中...</div>}
          
          {!loading && detail && (
            <>
              {/* 基本信息 */}
              <div className="detail-card">
                <h5>基本信息</h5>
                <div className="detail-grid">
                  <div><span>所属项目：</span>{detail.project_name || '-'}</div>
                  <div><span>申请人：</span>{detail.submitter_name || '-'}</div>
                  <div><span>审批人：</span>{detail.apply_name || '-'}</div>
                  <div><span>审核人：</span>{detail.reviewer_name || '-'}</div>
                  <div><span>执行人：</span>{detail.executor_name || '-'}</div>
                  <div><span>申请时间：</span>{detail.created_at?.replace('T', ' ').substring(0, 19) || '-'}</div>
                  {detail.database_name && <div><span>数据库：</span>{detail.database_name}</div>}
                  <div><span>当前操作人：</span>{detail.current_operator ? <span className="highlight-text">{detail.current_operator}</span> : '-'}</div>
                </div>
              </div>

              {/* 申请说明 */}
              {detail.submitter_remark && (
                <div className="detail-card">
                  <h5>申请说明</h5>
                  <pre>{detail.submitter_remark}</pre>
                </div>
              )}

              {/* SQL内容 */}
              {detail.sql_content && (
                <div className="detail-card">
                  <h5>SQL查询内容</h5>
                  <pre>{detail.sql_content}</pre>
                </div>
              )}

              {/* 提交人操作 */}
              {isSubmitterActionable && (
                <div className="detail-card">
                  <h5>提交人操作</h5>
                  <div className="action-buttons">
                    <button className="btn btn-danger" onClick={handleWithdraw}>撤回申请</button>
                    <button className="btn btn-default" onClick={onClose}>取消</button>
                  </div>
                </div>
              )}

              {/* 审批人操作 */}
              {isApproverActionable && (
                <div className="detail-card">
                  <h5>审批人操作</h5>
                  {detail.sql_content ? (
                    <>
                      <p className="tip-text">提交人已提交SQL内容，您可以直接审批通过或拒绝</p>
                      <div className="action-buttons">
                        <button className="btn btn-primary" onClick={handleApproveWithSql}>审批通过</button>
                        <button className="btn btn-danger" onClick={handleApproveReject}>审批拒绝</button>
                        <button className="btn btn-default" onClick={onClose}>取消</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="form-item">
                        <label>选择数据库</label>
                        <select value={approveForm.database} onChange={e => setApproveForm(p => ({ ...p, database: e.target.value }))}>
                          <option value="">请选择数据库</option>
                          {databases.map(db => <option key={db} value={db}>{db}</option>)}
                        </select>
                      </div>
                      <div className="form-item">
                        <label>SQL语句</label>
                        <textarea rows={5} value={approveForm.sql} onChange={e => setApproveForm(p => ({ ...p, sql: e.target.value }))} placeholder="请输入SQL语句" />
                      </div>
                      <div className="action-buttons">
                        <button className="btn btn-primary" onClick={handleApprove}>审批通过</button>
                        <button className="btn btn-danger" onClick={handleApproveReject}>审批拒绝</button>
                        <button className="btn btn-default" onClick={onClose}>取消</button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 审核人操作 */}
              {isReviewerActionable && (
                <div className="detail-card">
                  <h5>审核人操作</h5>
                  <div className="form-item">
                    <label>审核结果</label>
                    <textarea rows={3} value={reviewForm.rule_check_result} onChange={e => setReviewForm({ rule_check_result: e.target.value })} placeholder="请输入审核结果" />
                  </div>
                  <div className="action-buttons">
                    <button className="btn btn-primary" onClick={handleReviewPass}>审核通过</button>
                    <button className="btn btn-danger" onClick={handleReviewReject}>审核不通过</button>
                    <button className="btn btn-default" onClick={onClose}>取消</button>
                  </div>
                </div>
              )}

              {/* 执行人操作 */}
              {isExecutorActionable && (
                <div className="detail-card">
                  <h5>执行人操作</h5>
                  <div className="action-buttons">
                    <button className="btn btn-success" onClick={handleExecute}>开始执行</button>
                    <button className="btn btn-default" onClick={onClose}>取消</button>
                  </div>
                </div>
              )}

              {/* 邮件重发 */}
              {isResendEmailActionable && (
                <div className="detail-card">
                  <h5>邮件发送异常处理</h5>
                  <div className="action-buttons">
                    <button className="btn btn-primary" onClick={handleResendEmail}>重新发送邮件</button>
                    <button className="btn btn-default" onClick={onClose}>关闭</button>
                  </div>
                </div>
              )}

              {/* 错误信息 */}
              {detail.error_message && (
                <div className="detail-card">
                  <h5>错误信息</h5>
                  <p className="error-text">{detail.error_message}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportDetailDrawer;
