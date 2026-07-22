/**
 * 任务详情对话框
 */

import { useState, useEffect } from 'react';
import { X, Loader2, Copy } from 'lucide-react';
import { getTaskDetail } from '../../../../services/job/task';
import toast from '../../../../components/Toast';

interface TaskDetail {
  id: number;
  name: string;
  task_key: string;
  cron: string;
  cron_desc?: string;
  description?: string;
  status: number;
  script_type?: string;
  script_content?: string;
  created_at?: string;
  updated_at?: string;
}

interface Props {
  visible: boolean;
  taskId: number | null;
  onClose: () => void;
}

const TaskDetailDialog = ({ visible, taskId, onClose }: Props) => {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<TaskDetail | null>(null);

  useEffect(() => {
    if (!visible || !taskId) return;
    setLoading(true);
    getTaskDetail(taskId)
      .then(res => {
        if (res.code === 200 && res.data) {
          setDetail(res.data as TaskDetail);
        }
      })
      .catch(() => toast.error('获取任务详情失败'))
      .finally(() => setLoading(false));
  }, [visible, taskId]);

  const handleCopyScript = async () => {
    if (!detail?.script_content) return;
    try {
      await navigator.clipboard.writeText(detail.script_content);
      toast.success('已复制到剪贴板');
    } catch {
      toast.error('复制失败');
    }
  };

  if (!visible) return null;

  return (
    <>
      <div className="drawer-overlay task-detail-overlay" onClick={onClose} />
      <div className="drawer-container detail-drawer">
        <div className="drawer-header">
          <h3>任务详情</h3>
          <button className="drawer-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="drawer-body">
          {loading ? (
            <div className="loading-state"><Loader2 size={24} className="spin" /> 加载中...</div>
          ) : detail ? (
            <>
              <div className="info-section">
                <h4>基本信息</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <label>任务ID</label>
                    <span>{detail.id}</span>
                  </div>
                  <div className="info-item">
                    <label>任务名称</label>
                    <span>{detail.name}</span>
                  </div>
                  <div className="info-item">
                    <label>任务标识</label>
                    <span>{detail.task_key}</span>
                  </div>
                  <div className="info-item">
                    <label>状态</label>
                    <span className={`status-tag ${detail.status === 1 ? 'success' : 'default'}`}>
                      {detail.status === 1 ? '运行中' : '已停止'}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>cron表达式</label>
                    <span><code>{detail.cron}</code></span>
                  </div>
                  <div className="info-item">
                    <label>执行周期</label>
                    <span>{detail.cron_desc || '-'}</span>
                  </div>
                  <div className="info-item">
                    <label>脚本类型</label>
                    <span>{detail.script_type || '-'}</span>
                  </div>
                  <div className="info-item">
                    <label>创建时间</label>
                    <span>{detail.created_at || '-'}</span>
                  </div>
                </div>
              </div>

              {detail.description && (
                <div className="info-section">
                  <h4>任务描述</h4>
                  <p className="description">{detail.description}</p>
                </div>
              )}

              {detail.script_content && (
                <div className="info-section">
                  <div className="section-header">
                    <h4>脚本内容</h4>
                    <button className="btn-copy" onClick={handleCopyScript}>
                      <Copy size={14} /> 复制
                    </button>
                  </div>
                  <pre className="script-content">{detail.script_content}</pre>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">暂无详情</div>
          )}
        </div>
      </div>
      <style>{`
        .task-detail-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1100; }
        .detail-drawer { position: fixed; top: 0; right: 0; width: 600px; height: 100%; background: var(--bg-color); z-index: 1101; display: flex; flex-direction: column; }
        .detail-drawer .drawer-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
        .detail-drawer .drawer-header h3 { margin: 0; font-size: 16px; color: var(--text-color); }
        .detail-drawer .drawer-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); }
        .detail-drawer .drawer-body { flex: 1; overflow: auto; padding: 20px; }
        .detail-drawer .loading-state { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-secondary); }
        .detail-drawer .empty-state { display: flex; align-items: center; justify-content: center; padding: 60px; color: var(--text-secondary); }
        .detail-drawer .info-section { margin-bottom: 24px; }
        .detail-drawer .info-section h4 { margin: 0 0 16px; font-size: 15px; color: var(--text-color); padding-bottom: 8px; border-bottom: 1px solid var(--border-color); }
        .detail-drawer .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color); }
        .detail-drawer .section-header h4 { margin: 0; padding: 0; border: none; }
        .detail-drawer .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .detail-drawer .info-item { display: flex; flex-direction: column; gap: 4px; }
        .detail-drawer .info-item label { font-size: 12px; color: var(--text-secondary); }
        .detail-drawer .info-item span { font-size: 14px; color: var(--text-color); }
        .detail-drawer .info-item code { background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; }
        .detail-drawer .status-tag { display: inline-block; padding: 2px 8px; font-size: 12px; border-radius: 4px; }
        .detail-drawer .status-tag.success { color: #52c41a; background: rgba(82, 196, 26, 0.1); }
        .detail-drawer .status-tag.default { color: var(--text-secondary); background: var(--bg-secondary); }
        .detail-drawer .description { margin: 0; font-size: 14px; color: var(--text-color); line-height: 1.6; }
        .detail-drawer .btn-copy { display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: var(--primary-color); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .detail-drawer .script-content { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; padding: 16px; max-height: 400px; overflow: auto; font-family: monospace; font-size: 13px; line-height: 1.6; white-space: pre-wrap; color: var(--text-color); margin: 0; }
        .detail-drawer .spin { animation: task-detail-spin 1s linear infinite; }
        @keyframes task-detail-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
};

export default TaskDetailDialog;
