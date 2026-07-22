/**
 * 任务执行记录对话框
 */

import { X, Loader2 } from 'lucide-react';
import type { Task, ExecRecord } from '../../../../services/job/agent';

interface Props {
  visible: boolean;
  task: Task | null;
  project?: string;
  execList: ExecRecord[];
  loading: boolean;
  onClose: () => void;
  onViewDetail: (record: ExecRecord) => void;
}

const TaskExecDialog = ({ visible, task, project, execList, loading, onClose, onViewDetail }: Props) => {
  if (!visible || !task) return null;

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

  return (
    <>
      <div className="dialog-overlay exec-dialog-overlay" onClick={onClose} />
      <div className="dialog-container exec-dialog">
        <div className="dialog-header">
          <h3>{task.name} - 执行记录</h3>
          <button className="dialog-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="dialog-body">
          <div className="task-info-grid">
            <div className="info-item"><span className="label">任务ID</span><span>{task.job_id}</span></div>
            <div className="info-item"><span className="label">任务名称</span><span>{task.name}</span></div>
            <div className="info-item"><span className="label">项目</span><span>{project || '-'}</span></div>
            <div className="info-item"><span className="label">状态</span><span className={`status-tag ${task.status === 1 ? 'success' : 'default'}`}>{task.status === 1 ? '运行中' : '已停止'}</span></div>
            <div className="info-item"><span className="label">下次执行</span><span>{task.next_run_time || '-'}</span></div>
            <div className="info-item"><span className="label">创建时间</span><span>{task.created_at || '-'}</span></div>
          </div>

          <div className="exec-section">
            <h4>执行记录</h4>
            {loading ? (
              <div className="loading-state"><Loader2 size={20} className="spin" /> 加载中...</div>
            ) : execList.length === 0 ? (
              <div className="empty-state">暂无执行记录</div>
            ) : (
              <div className="exec-table-wrapper">
                <table className="exec-table">
                  <thead>
                    <tr><th>记录ID</th><th>执行状态</th><th>开始时间</th><th>结束时间</th><th>执行时长</th><th>操作</th></tr>
                  </thead>
                  <tbody>
                    {execList.map(record => (
                      <tr key={record.id}>
                        <td>{record.id}</td>
                        <td><span className={`status-tag ${getStatusClass(record.exec_status)}`}>{getStatusText(record.exec_status)}</span></td>
                        <td>{record.start_time || '-'}</td>
                        <td>{record.end_time || '-'}</td>
                        <td>{formatDuration(record.duration)}</td>
                        <td><button className="btn-link" onClick={() => onViewDetail(record)}>详情</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        .exec-dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1100; }
        .exec-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 700px; max-width: 90%; max-height: 80vh; background: var(--bg-color); border-radius: 8px; z-index: 1101; display: flex; flex-direction: column; box-shadow: 0 6px 30px rgba(0,0,0,0.2); }
        .exec-dialog .dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
        .exec-dialog .dialog-header h3 { margin: 0; font-size: 16px; color: var(--text-color); }
        .exec-dialog .dialog-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); }
        .exec-dialog .dialog-body { flex: 1; overflow: auto; padding: 20px; }
        .exec-dialog .task-info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 16px; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 20px; }
        .exec-dialog .info-item { display: flex; flex-direction: column; gap: 4px; }
        .exec-dialog .info-item .label { font-size: 12px; color: var(--text-secondary); }
        .exec-dialog .exec-section h4 { margin: 0 0 12px; font-size: 15px; color: var(--text-color); }
        .exec-dialog .loading-state, .exec-dialog .empty-state { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 30px; color: var(--text-secondary); }
        .exec-dialog .exec-table-wrapper { overflow: auto; border: 1px solid var(--border-color); border-radius: 6px; max-height: 300px; }
        .exec-dialog .exec-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .exec-dialog .exec-table th, .exec-dialog .exec-table td { padding: 10px 12px; border-bottom: 1px solid var(--border-color); text-align: center; }
        .exec-dialog .exec-table th { background: var(--bg-secondary); font-weight: 600; color: var(--text-color); position: sticky; top: 0; z-index: 1; }
        .exec-dialog .status-tag { display: inline-block; padding: 2px 8px; font-size: 12px; }
        .exec-dialog .status-tag.success { color: #52c41a; }
        .exec-dialog .status-tag.danger { color: #ff4d4f; }
        .exec-dialog .status-tag.warning { color: #faad14; }
        .exec-dialog .status-tag.default { color: var(--text-secondary); }
        .exec-dialog .btn-link { background: none; border: none; color: var(--primary-color); cursor: pointer; font-size: 12px; }
        .exec-dialog .btn-link:hover { text-decoration: underline; }
        .exec-dialog .spin { animation: exec-dialog-spin 1s linear infinite; }
        @keyframes exec-dialog-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
};

export default TaskExecDialog;
