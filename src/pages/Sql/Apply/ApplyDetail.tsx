/**
 * SQL变更申请详情抽屉
 */

import { useState } from 'react';
import { 
  updateApply, checkSql, APPLY_STATUS_MAP, FINISHED_STATUS,
  type ApplyDetail as ApplyDetailType, type ApplyItem, type SqlCheckResult
} from '../../../services/sql/apply';
import { useAuthStore } from '../../../stores/authStore';
import { toast } from '../../../components/AppNotification';
import { confirm } from '../../../components/ConfirmModal';
import SqlAnalysisDialog from './SqlAnalysisDialog';

interface Props {
  detail: ApplyDetailType;
  onClose: () => void;
  onRefresh: () => void;
  onResubmit: (data: Partial<ApplyItem>) => void;
}

const ApplyDetailDrawer = ({ detail, onClose, onRefresh, onResubmit }: Props) => {
  const { userId } = useAuthStore();
  const [executing, setExecuting] = useState(false);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<SqlCheckResult[]>([]);

  // 判断当前用户角色
  const currentUserId = Number(userId);
  const isCreator = detail.submitter_id === currentUserId || detail.apply_role === 'submit';
  const isApprover = !isCreator && (detail.apply_id === currentUserId || detail.apply_role === 'apply');
  const isExecutor = detail.executor_id === currentUserId || detail.apply_role === 'executor';
  const isFlowFinished = FINISHED_STATUS.includes(detail.status);

  // 状态判断
  const isPending = detail.status === 0 || detail.status === '0';
  const isWaitExecute = detail.status === 1 || detail.status === '1';

  const getStatusInfo = (status: number | string) => {
    const key = String(status);
    return APPLY_STATUS_MAP[key] || APPLY_STATUS_MAP[Number(status)] || { text: status, type: 'info' };
  };

  // 执行操作
  const doAction = async (processType: number, successMsg: string) => {
    try {
      const res = await updateApply({ id: detail.id, process_type: processType });
      if (res.code === 200) {
        toast.success(successMsg);
        onClose();
        onRefresh();
      } else {
        toast.error(res.message || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      toast.error('操作失败');
    }
  };

  // 驳回
  const handleReject = async () => {
    if (!await confirm({ content: '确定要驳回该申请吗？', type: 'warning' })) return;
    doAction(0, '已驳回');
  };

  // 审批通过
  const handleApprove = async () => {
    if (!await confirm({ content: '确定要通过该申请吗？' })) return;
    doAction(1, '审批通过');
  };

  // 撤销
  const handleCancel = async () => {
    if (!await confirm({ content: '确定要撤销该申请吗？', type: 'warning' })) return;
    doAction(0, '已撤销');
  };

  // 执行
  const handleExecute = async () => {
    if (!await confirm({ content: '确定要执行该SQL吗？', type: 'danger' })) return;
    setExecuting(true);
    try {
      await doAction(1, '执行成功');
    } finally {
      setExecuting(false);
    }
  };

  // 再次提交
  const handleResubmit = () => {
    onResubmit({
      project: detail.project,
      database_name: detail.database_name,
      sql_content: detail.sql_content,
      remark: detail.remark || detail.description || ''
    });
  };

  // 查看分析结果
  const handleViewAnalysis = async () => {
    if (detail.rule_check_result && detail.rule_check_result.length > 0) {
      setAnalysisResults(detail.rule_check_result);
      setAnalysisVisible(true);
      return;
    }

    if (!detail.sql_content) {
      toast.warning('SQL内容为空');
      return;
    }

    try {
      const res = await checkSql({
        sql: detail.sql_content,
        project: detail.project,
        database: detail.database_name
      });
      if (res.code === 200 && res.data?.sql_results) {
        setAnalysisResults(res.data.sql_results);
        setAnalysisVisible(true);
      } else {
        toast.error(res.message || '获取分析结果失败');
      }
    } catch (error) {
      console.error('获取分析结果失败:', error);
      toast.error('获取分析结果失败');
    }
  };

  const statusInfo = getStatusInfo(detail.status);

  return (
    <>
      <div className="drawer-overlay" onClick={onClose}>
        <div className="drawer drawer-wide" onClick={e => e.stopPropagation()}>
          <div className="drawer-header">
            <h4>变更申请详情 #{detail.id}</h4>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>

          <div className="drawer-body detail-content">
            {/* 基本信息 */}
            <div className="detail-card">
              <div className="card-header">
                <span>基本信息</span>
                <span className={`tag tag-${statusInfo.type}`}>{statusInfo.text}</span>
              </div>
              <div className="info-grid">
                <div className="info-item">
                  <span className="label">所属项目：</span>
                  <span className="value">{detail.project}</span>
                </div>
                <div className="info-item">
                  <span className="label">目标数据库：</span>
                  <span className="value">{detail.database_name}</span>
                </div>
                <div className="info-item">
                  <span className="label">创建人：</span>
                  <span className="value">{detail.submitter_name}</span>
                </div>
                <div className="info-item">
                  <span className="label">审批人：</span>
                  <span className="value">{detail.apply_name}</span>
                </div>
                <div className="info-item">
                  <span className="label">执行人：</span>
                  <span className="value">{detail.executor_name}</span>
                </div>
                <div className="info-item">
                  <span className="label">创建时间：</span>
                  <span className="value">{detail.created_at}</span>
                </div>
                <div className="info-item">
                  <span className="label">执行时间：</span>
                  <span className="value">{detail.execution_time || '立即执行'}</span>
                </div>
                <div className="info-item full-width">
                  <span className="label">变更说明：</span>
                  <span className="value">{detail.remark || detail.description || '-'}</span>
                </div>
              </div>
            </div>

            {/* SQL内容 */}
            <div className="detail-card">
              <div className="card-header">
                <span>SQL内容</span>
              </div>
              <pre className="sql-content">{detail.sql_content}</pre>
            </div>

            {/* 检查结果摘要 */}
            {detail.rule_check_result && detail.rule_check_result.length > 0 && (
              <div className="detail-card">
                <div className="card-header">
                  <span>SQL语法检查结果</span>
                  <span className={`tag tag-${detail.has_blocker ? 'danger' : detail.has_violation ? 'warning' : 'success'}`}>
                    {detail.has_blocker ? '有阻断' : detail.has_violation ? '有违规' : '通过'}
                  </span>
                </div>
                <div className="check-summary">
                  <span>检查SQL总数：{detail.rule_check_result.length}</span>
                  <button className="btn btn-link" onClick={handleViewAnalysis}>查看详情</button>
                </div>
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="drawer-footer">
            <button className="btn btn-default" onClick={onClose}>关闭</button>
            
            {/* 审批人 - 待审批状态 */}
            {isApprover && isPending && (
              <>
                <button className="btn btn-danger" onClick={handleReject}>驳回</button>
                <button className="btn btn-primary" onClick={handleApprove}>审批通过</button>
                <button className="btn btn-default" onClick={handleViewAnalysis}>查看分析结果</button>
              </>
            )}

            {/* 创建人 - 待审批或待执行状态 */}
            {isCreator && (isPending || isWaitExecute) && (
              <>
                <button className="btn btn-warning" onClick={handleCancel}>撤销申请</button>
                <button className="btn btn-default" onClick={handleViewAnalysis}>查看分析结果</button>
              </>
            )}

            {/* 执行人 - 待执行状态 */}
            {isExecutor && isWaitExecute && (
              <>
                <button className="btn btn-danger" onClick={handleReject}>驳回</button>
                <button className="btn btn-primary" disabled={executing} onClick={handleExecute}>
                  {executing ? '执行中...' : '执行'}
                </button>
              </>
            )}

            {/* 创建人 - 流程完成后可再次提交 */}
            {isCreator && isFlowFinished && (
              <>
                <button className="btn btn-primary" onClick={handleResubmit}>再次提交</button>
                <button className="btn btn-default" onClick={handleViewAnalysis}>查看分析结果</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* SQL分析结果对话框 */}
      {analysisVisible && (
        <SqlAnalysisDialog
          sqlList={analysisResults}
          mode="view"
          onCancel={() => setAnalysisVisible(false)}
        />
      )}
    </>
  );
};

export default ApplyDetailDrawer;
