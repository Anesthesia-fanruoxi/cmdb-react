/**
 * 执行记录详情抽屉
 */

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { getExecDetail } from '../../../../services/job/agent';
import toast from '../../../../components/Toast';

interface ExecDetailData {
  id: number;
  task_name: string;
  project: string;
  exec_status: string;
  start_time: string;
  end_time: string;
  duration: number;
  output: string;
  error_msg: string;
}

interface Props {
  visible: boolean;
  execId: number | null;
  onClose: () => void;
}

const ExecDetailDrawer = ({ visible, execId, onClose }: Props) => {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ExecDetailData | null>(null);

  useEffect(() => {
    if (!visible || !execId) return;
    setLoading(true);
    getExecDetail(execId)
      .then(res => {
        if (res.code === 200) setDetail(res.data as ExecDetailData);
      })
      .catch(() => toast.error('获取执行详情失败'))
      .finally(() => setLoading(false));
  }, [visible, execId]);

  const getStatusText = (status: string) => {
    const map: Record<string, string> = { success: '成功', failed: '失败', running: '运行中', pending: '等待中' };
    return map[status] || status;
  };

  const getStatusClass = (status: string) => {
    if (status === 'success') return 'success';
    if (status === 'failed') return 'danger';
    if (status === 'running' || status === 'pending') return 'warning';
    return 'default';
  };

  const formatDuration = (ms: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (!visible) return null;

  return (
    <>
      <div className="drawer-overlay agent-exec-detail-overlay" onClick={onClose} />
      <div className="drawer-container exec-detail-drawer">
        <div className="drawer-header">
          <h3>执行记录详情</h3>
          <button className="drawer-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="drawer-body">
          {loading ? (
            <div className="loading-state"><Loader2 size={24} className="spin" /> 加载中...</div>
          ) : detail ? (
            <>
              <div className="info-grid">
                <div className="info-item"><span className="label">记录ID</span><span>{detail.id}</span></div>
                <div className="info-item"><span className="label">任务名称</span><span>{detail.task_name}</span></div>
                <div className="info-item"><span className="label">项目</span><span>{detail.project}</span></div>
                <div className="info-item">
                  <span className="label">执行状态</span>
                  <span className={`status-tag ${getStatusClass(detail.exec_status)}`}>{getStatusText(detail.exec_status)}</span>
                </div>
                <div className="info-item"><span className="label">开始时间</span><span>{detail.start_time || '-'}</span></div>
                <div className="info-item"><span className="label">结束时间</span><span>{detail.end_time || '-'}</span></div>
                <div className="info-item"><span className="label">执行时长</span><span>{formatDuration(detail.duration)}</span></div>
              </div>

              {detail.output && (
                <div className="output-section">
                  <h4>执行输出</h4>
                  <pre className="output-content">{detail.output}</pre>
                </div>
              )}

              {detail.error_msg && (
                <div className="error-section">
                  <h4>错误信息</h4>
                  <pre className="error-content">{detail.error_msg}</pre>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">暂无详情</div>
          )}
        </div>
      </div>
      <style>{`
        .agent-exec-detail-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1100; }
        .exec-detail-drawer { position: fixed; top: 0; right: 0; width: 50%; min-width: 500px; height: 100vh; background: var(--bg-color); z-index: 1200; display: flex; flex-direction: column; box-shadow: -4px 0 20px rgba(0,0,0,0.15); }
        .exec-detail-drawer .drawer-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
        .exec-detail-drawer .drawer-header h3 { margin: 0; font-size: 16px; color: var(--text-color); }
        .exec-detail-drawer .drawer-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); }
        .exec-detail-drawer .drawer-body { flex: 1; overflow: auto; padding: 20px; }
        .exec-detail-drawer .loading-state, .exec-detail-drawer .empty-state { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-secondary); }
        .exec-detail-drawer .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; padding: 16px; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 20px; }
        .exec-detail-drawer .info-item { display: flex; flex-direction: column; gap: 4px; }
        .exec-detail-drawer .info-item .label { font-size: 12px; color: var(--text-secondary); }
        .exec-detail-drawer .status-tag { display: inline-block; font-size: 13px; }
        .exec-detail-drawer .status-tag.success { color: #52c41a; }
        .exec-detail-drawer .status-tag.danger { color: #ff4d4f; }
        .exec-detail-drawer .status-tag.warning { color: #faad14; }
        .exec-detail-drawer .output-section, .exec-detail-drawer .error-section { margin-bottom: 20px; }
        .exec-detail-drawer .output-section h4, .exec-detail-drawer .error-section h4 { margin: 0 0 12px; font-size: 14px; color: var(--text-color); }
        .exec-detail-drawer .output-content { background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 6px; font-family: monospace; font-size: 13px; line-height: 1.6; white-space: pre-wrap; max-height: 300px; overflow: auto; margin: 0; }
        .exec-detail-drawer .error-content { background: rgba(255, 77, 79, 0.1); color: #ff4d4f; padding: 16px; border-radius: 6px; font-family: monospace; font-size: 13px; line-height: 1.6; white-space: pre-wrap; max-height: 200px; overflow: auto; margin: 0; }
        .exec-detail-drawer .spin { animation: agent-exec-detail-spin 1s linear infinite; }
        @keyframes agent-exec-detail-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
};

export default ExecDetailDrawer;
