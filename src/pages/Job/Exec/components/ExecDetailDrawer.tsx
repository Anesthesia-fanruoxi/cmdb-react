/**
 * 执行记录详情抽屉
 */

import { useState, useEffect } from 'react';
import { X, Loader2, Copy } from 'lucide-react';
import { getExecDetail, getJobExecProjects, ProjectOption } from '../../../../services/job/exec';
import toast from '../../../../components/Toast';

interface ExecDetail {
  id: number;
  job_id: number;
  job_name?: string;
  task_key?: string;
  project: string;
  agent_id?: string;
  exec_status: number;
  start_time: string;
  end_time: string;
  duration: number;
  result?: string;
  error_msg?: string;
  exec_log?: string;
  created_at?: string;
}

interface Props {
  visible: boolean;
  execId: number | null;
  onClose: () => void;
}

const ExecDetailDrawer = ({ visible, execId, onClose }: Props) => {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ExecDetail | null>(null);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);

  // 获取项目选项
  useEffect(() => {
    getJobExecProjects().then(res => {
      if (res.code === 200) {
        const items = (res.data as any)?.items || res.data || [];
        setProjectOptions(items.map((item: any) => ({
          key: item.project || item.key,
          value: item.project_name || item.value
        })));
      }
    }).catch(() => {});
  }, []);

  // 获取详情
  useEffect(() => {
    if (!visible || !execId) return;
    setLoading(true);
    getExecDetail(execId)
      .then(res => {
        if (res.code === 200 && res.data) {
          setDetail(res.data as ExecDetail);
        }
      })
      .catch(() => toast.error('获取详情失败'))
      .finally(() => setLoading(false));
  }, [visible, execId]);

  // 获取项目名称
  const getProjectName = (key: string) => projectOptions.find(p => p.key === key)?.value || key || '-';

  // 获取状态样式
  const getStatusClass = (status: number) => {
    const map: Record<number, string> = { 0: 'warning', 1: 'success', 2: 'danger' };
    return map[status] || 'default';
  };

  // 获取状态文本
  const getStatusText = (status: number) => {
    const map: Record<number, string> = { 0: '执行中', 1: '成功', 2: '失败' };
    return map[status] || '未知';
  };

  // 格式化执行时长
  const formatDuration = (seconds: number) => {
    if (!seconds && seconds !== 0) return '-';
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}小时${m}分${seconds % 60}秒`;
  };

  // 复制文本
  const handleCopy = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('复制成功');
    } catch {
      toast.error('复制失败');
    }
  };

  if (!visible) return null;

  return (
    <>
      <div className="drawer-overlay exec-record-overlay" onClick={onClose} />
      <div className="drawer-container exec-record-drawer">
        <div className="drawer-header">
          <h3>执行记录详情</h3>
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
                  <div className="info-item"><label>记录ID</label><span>{detail.id}</span></div>
                  <div className="info-item"><label>任务ID</label><span>{detail.job_id}</span></div>
                  <div className="info-item"><label>任务名称</label><span>{detail.job_name || '-'}</span></div>
                  <div className="info-item"><label>任务标识</label><span>{detail.task_key || '-'}</span></div>
                  <div className="info-item"><label>项目</label><span>{getProjectName(detail.project)}</span></div>
                  <div className="info-item"><label>Agent ID</label><span>{detail.agent_id || '-'}</span></div>
                </div>
              </div>

              <div className="info-section">
                <h4>执行信息</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <label>执行状态</label>
                    <span className={`status-tag ${getStatusClass(detail.exec_status)}`}>{getStatusText(detail.exec_status)}</span>
                  </div>
                  <div className="info-item"><label>执行时长</label><span>{formatDuration(detail.duration)}</span></div>
                  <div className="info-item"><label>开始时间</label><span>{detail.start_time || '-'}</span></div>
                  <div className="info-item"><label>结束时间</label><span>{detail.end_time || '-'}</span></div>
                  <div className="info-item"><label>创建时间</label><span>{detail.created_at || '-'}</span></div>
                </div>
              </div>

              {detail.result && (
                <div className="info-section">
                  <div className="section-header">
                    <h4>执行结果</h4>
                    <button className="btn-copy" onClick={() => handleCopy(detail.result!)}><Copy size={14} /> 复制</button>
                  </div>
                  <div className="result-content">{detail.result}</div>
                </div>
              )}

              {detail.error_msg && (
                <div className="info-section">
                  <div className="section-header">
                    <h4>错误信息</h4>
                    <button className="btn-copy" onClick={() => handleCopy(detail.error_msg!)}><Copy size={14} /> 复制</button>
                  </div>
                  <div className="error-content">{detail.error_msg}</div>
                </div>
              )}

              {detail.exec_log && (
                <div className="info-section">
                  <div className="section-header">
                    <h4>执行日志</h4>
                    <button className="btn-copy" onClick={() => handleCopy(detail.exec_log!)}><Copy size={14} /> 复制</button>
                  </div>
                  <pre className="log-content">{detail.exec_log}</pre>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">暂无详情</div>
          )}
        </div>
      </div>
      <style>{`
        .exec-record-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1100; }
        .exec-record-drawer { position: fixed; top: 0; right: 0; width: 60%; min-width: 600px; height: 100%; background: var(--bg-color); z-index: 1101; display: flex; flex-direction: column; }
        .exec-record-drawer .drawer-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
        .exec-record-drawer .drawer-header h3 { margin: 0; font-size: 16px; color: var(--text-color); }
        .exec-record-drawer .drawer-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); }
        .exec-record-drawer .drawer-body { flex: 1; overflow: auto; padding: 20px; }
        .exec-record-drawer .loading-state, .exec-record-drawer .empty-state { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-secondary); }
        .exec-record-drawer .info-section { margin-bottom: 24px; }
        .exec-record-drawer .info-section h4 { margin: 0 0 16px; font-size: 15px; color: var(--text-color); padding-bottom: 8px; border-bottom: 1px solid var(--border-color); }
        .exec-record-drawer .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color); }
        .exec-record-drawer .section-header h4 { margin: 0; padding: 0; border: none; }
        .exec-record-drawer .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .exec-record-drawer .info-item { display: flex; flex-direction: column; gap: 4px; }
        .exec-record-drawer .info-item label { font-size: 12px; color: var(--text-secondary); }
        .exec-record-drawer .info-item span { font-size: 14px; color: var(--text-color); }
        .exec-record-drawer .status-tag { display: inline-block; padding: 2px 8px; font-size: 12px; border-radius: 4px; }
        .exec-record-drawer .status-tag.success { color: #52c41a; background: rgba(82, 196, 26, 0.1); }
        .exec-record-drawer .status-tag.warning { color: #faad14; background: rgba(250, 173, 20, 0.1); }
        .exec-record-drawer .status-tag.danger { color: #ff4d4f; background: rgba(255, 77, 79, 0.1); }
        .exec-record-drawer .btn-copy { display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: var(--primary-color); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .exec-record-drawer .result-content { padding: 16px; background: rgba(82, 196, 26, 0.1); border-left: 4px solid #52c41a; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word; font-size: 14px; line-height: 1.5; color: var(--text-color); }
        .exec-record-drawer .error-content { padding: 16px; background: rgba(255, 77, 79, 0.1); border-left: 4px solid #ff4d4f; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word; font-size: 14px; line-height: 1.5; color: var(--text-color); }
        .exec-record-drawer .log-content { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; padding: 16px; max-height: 400px; overflow: auto; font-family: monospace; font-size: 13px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; color: var(--text-color); margin: 0; }
        .exec-record-drawer .spin { animation: exec-record-spin 1s linear infinite; }
        @keyframes exec-record-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
};

export default ExecDetailDrawer;
