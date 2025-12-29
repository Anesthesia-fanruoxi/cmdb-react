/**
 * 发版记录详情弹框 - 使用 SSE 订阅实时数据
 */

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Square, FileText } from 'lucide-react';
import { cancelTask } from '../../../../services/assets/proUpdate';
import type { ReleaseRecord } from '../../../../services/assets/proUpdate';
import LogViewerDialog from './LogViewerDialog';

interface StepDetail {
  step: number;
  step_name: string;
  step_type?: string;
  step_status: string;
  step_started_at: string;
  step_finished_at: string;
  duration: number;
  logs?: string;
}

interface RecordDetailData extends ReleaseRecord {
  finished_at?: string;
  step?: string;
  description?: string;
  category?: string;
  step_detail?: StepDetail[];
}

interface Props {
  visible: boolean;
  record: ReleaseRecord | null;
  projectDetail?: { project?: string; type?: string } | null;
  onClose: () => void;
  onRefresh?: () => void;
}

const RecordDetailDialog = ({ visible, record, projectDetail, onClose, onRefresh }: Props) => {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<RecordDetailData | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const sseRef = useRef<{ close: () => void } | null>(null);
  
  // 日志查看器状态
  const [logDialogVisible, setLogDialogVisible] = useState(false);
  const [currentLogStep, setCurrentLogStep] = useState<StepDetail | null>(null);

  useEffect(() => {
    if (visible && record) {
      connectSSE();
    } else {
      closeSSE();
    }
    return () => closeSSE();
  }, [visible, record]);

  const closeSSE = () => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  };

  const connectSSE = () => {
    if (!record) return;
    const taskId = record.task_id || String(record.id);
    if (!taskId) {
      setDetail(record as RecordDetailData);
      return;
    }

    setLoading(true);
    closeSSE();

    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const url = `${baseUrl}/assets/proUpdate/records-detail?id=${taskId}`;
    const eventSource = new EventSource(url);

    eventSource.addEventListener('data', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        setLoading(false);
        setDetail({ ...record, ...data } as RecordDetailData);
        if (data.finished_at) closeSSE();
      } catch (e) {
        console.error('SSE 解析错误:', e);
      }
    });

    eventSource.onerror = () => {
      setLoading(false);
      setDetail(record as RecordDetailData);
      eventSource.close();
    };

    sseRef.current = { close: () => eventSource.close() };
  };

  const handleCancel = async () => {
    if (!detail) return;
    const taskId = detail.task_id || String(detail.id);
    if (!taskId || !confirm('确定要停止当前任务吗？')) return;

    setCancelLoading(true);
    try {
      await cancelTask(taskId);
      connectSSE();
      onRefresh?.();
    } catch (err) {
      console.error('取消失败:', err);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleShowLogs = (step: StepDetail) => {
    setCurrentLogStep(step);
    setLogDialogVisible(true);
  };

  const getStatusClass = (status: string) => {
    if (status === 'success' || status === 'completed') return 'success';
    if (status === 'failed' || status === 'error') return 'danger';
    if (status === 'running' || status === 'pending') return 'warning';
    return 'default';
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = { success: '成功', completed: '成功', failed: '失败', error: '失败', running: '进行中', pending: '等待中', cancel: '已取消' };
    return map[status] || status || '-';
  };

  if (!visible) return null;

  return (
    <>
      <div className="dialog-overlay" onClick={onClose} />
      <div className="dialog-container record-detail-dialog">
        <div className="dialog-header">
          <h3>发版记录详情</h3>
          <button className="dialog-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="dialog-body">
          {loading ? (
            <div className="dialog-loading"><Loader2 size={24} className="spin" /> 加载中...</div>
          ) : detail ? (
            <>
              <div className="detail-grid">
                <div className="detail-item span-2"><span className="label">任务ID</span><span className="mono">{detail.task_id || detail.id}</span></div>
                <div className="detail-item"><span className="label">状态</span><span className={`status-tag ${getStatusClass(detail.status)}`}>{getStatusText(detail.status)}</span></div>
                <div className="detail-item"><span className="label">开始时间</span><span>{detail.started_at || '-'}</span></div>
                <div className="detail-item"><span className="label">完成时间</span><span>{detail.finished_at || '-'}</span></div>
                <div className="detail-item"><span className="label">当前步骤</span><span>{detail.step || '-'}</span></div>
                {detail.type && <div className="detail-item"><span className="label">发版类型</span><span className="tag warning">{detail.type === 'web' ? '前端' : '后端'}</span></div>}
                {detail.category && <div className="detail-item"><span className="label">额外参数</span><span className="tag info">{detail.category}</span></div>}
              </div>

              {detail.step_detail && detail.step_detail.length > 0 && (
                <div className="step-section">
                  <h4>步骤详情</h4>
                  <div className="step-table">
                    <table>
                      <thead><tr><th>步骤</th><th>步骤名称</th><th>状态</th><th>开始时间</th><th>完成时间</th><th>耗时(ms)</th><th>操作</th></tr></thead>
                      <tbody>
                        {[...detail.step_detail].reverse().map((s, i) => (
                          <tr key={i}>
                            <td>{s.step}</td>
                            <td>{s.step_name}</td>
                            <td><span className={`status-tag ${getStatusClass(s.step_status)}`}>{getStatusText(s.step_status)}</span></td>
                            <td>{s.step_started_at || '-'}</td>
                            <td>{s.step_finished_at || '-'}</td>
                            <td>{s.duration === 0 ? 0 : (s.duration || '-')}</td>
                            <td>{s.step > 1 && <button className="btn-logs" onClick={() => handleShowLogs(s)}><FileText size={12} /> 日志</button>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
        <div className="dialog-footer">
          {detail?.status === 'running' && (
            <button className="btn-danger" onClick={handleCancel} disabled={cancelLoading}>
              {cancelLoading ? <Loader2 size={14} className="spin" /> : <Square size={14} />} 停止任务
            </button>
          )}
          <button className="btn-default" onClick={onClose}>关闭</button>
        </div>
      </div>
      <style>{`
        .dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1100; }
        .record-detail-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 700px; max-width: 90%; max-height: 85vh; background: var(--bg-color, #fff); border-radius: 8px; z-index: 1101; display: flex; flex-direction: column; box-shadow: 0 6px 30px rgba(0,0,0,0.2); }
        .dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color, #e8e8e8); }
        .dialog-header h3 { margin: 0; font-size: 16px; }
        .dialog-close { background: none; border: none; cursor: pointer; color: var(--text-secondary, #666); }
        .dialog-body { flex: 1; overflow: auto; padding: 20px; }
        .dialog-loading { display: flex; align-items: center; justify-content: center; gap: 8px; height: 150px; color: var(--text-secondary, #999); }
        .dialog-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border-color, #e8e8e8); }
        .detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 12px; background: var(--bg-secondary, #fafafa); border-radius: 6px; border: 1px solid var(--border-color, #e8e8e8); }
        .detail-item { display: flex; flex-direction: column; gap: 4px; }
        .detail-item.span-2 { grid-column: span 2; }
        .detail-item .label { font-size: 12px; color: var(--text-secondary, #999); }
        .detail-item .mono { font-family: monospace; font-size: 13px; word-break: break-all; }
        .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
        .tag.warning { background: #fff7e6; color: #fa8c16; }
        .tag.info { background: #e6f7ff; color: #1890ff; }
        .step-section { margin-top: 20px; }
        .step-section h4 { margin: 0 0 12px; font-size: 15px; }
        .step-table { border: 1px solid var(--border-color, #e8e8e8); border-radius: 4px; overflow: auto; max-height: 300px; }
        .step-table table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .step-table th, .step-table td { padding: 8px; border-bottom: 1px solid var(--border-color, #e8e8e8); text-align: center; }
        .step-table th { background: var(--bg-secondary, #fafafa); font-weight: 600; position: sticky; top: 0; }
        .btn-logs { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border: 1px solid var(--border-color, #d9d9d9); background: #fff; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .btn-logs:hover { color: var(--primary-color, #1890ff); border-color: var(--primary-color, #1890ff); }
        .btn-danger { display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: #ff4d4f; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
        .btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-default { padding: 6px 16px; border: 1px solid var(--border-color, #d9d9d9); background: #fff; border-radius: 4px; cursor: pointer; }
        .status-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
        .status-tag.success { background: #f6ffed; color: #52c41a; }
        .status-tag.danger { background: #fff2f0; color: #ff4d4f; }
        .status-tag.warning { background: #fff7e6; color: #fa8c16; }
        .status-tag.default { background: #f0f0f0; color: #666; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <LogViewerDialog
        visible={logDialogVisible}
        logStep={currentLogStep}
        taskInfo={detail}
        projectDetail={projectDetail || null}
        onClose={() => setLogDialogVisible(false)}
      />
    </>
  );
};

export default RecordDetailDialog;