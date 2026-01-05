/**
 * 项目详情抽屉 - 使用 SSE 订阅实时数据
 */

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Play } from 'lucide-react';
import { subscribeProjectDetail, startRelease, cancelTask } from '../../../../services/assets/proUpdate';
import { confirm } from '../../../../components/ConfirmModal';
import type { ProjectUpdate, ReleaseRecord, ProjectDetailResponse } from '../../../../services/assets/proUpdate';
import RecordDetailDialog from './RecordDetailDialog';
import CategorySelectDialog from './CategorySelectDialog';

interface Props {
  visible: boolean;
  project: (ProjectUpdate & { type?: string }) | null;
  onClose: () => void;
  onRefresh?: () => void;
}

const ProjectDetailDrawer = ({ visible, project, onClose, onRefresh }: Props) => {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ProjectUpdate | null>(null);
  const [records, setRecords] = useState<ReleaseRecord[]>([]);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const sseRef = useRef<{ close: () => void } | null>(null);
  
  // 记录详情弹框
  const [recordDialogVisible, setRecordDialogVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<ReleaseRecord | null>(null);
  
  // 服务选择弹框
  const [categoryDialogVisible, setCategoryDialogVisible] = useState(false);
  const [categoryDialogType, setCategoryDialogType] = useState<'web' | 'backend'>('web');

  useEffect(() => {
    if (visible && project) {
      connectSSE();
    } else {
      closeSSE();
    }
    return () => closeSSE();
  }, [visible, project]);

  const closeSSE = () => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  };

  const connectSSE = () => {
    if (!project) return;
    setLoading(true);
    closeSSE();

    sseRef.current = subscribeProjectDetail(
      project.project,
      project.type,
      (data: ProjectDetailResponse) => {
        setLoading(false);
        if (data) {
          setDetail({ ...data.project_info, ...project, total_updates: data.total_updates || 0, last_update: data.last_update || '' });
          setRecords(data.records || []);
          // 检查是否还有运行中的任务
          const hasRunning = data.records?.some(r => r.status === 'running' || r.status === 'pending');
          if (!hasRunning) closeSSE();
        }
      },
      () => {
        setLoading(false);
        setDetail(project);
        setRecords([]);
      }
    );
  };

  const handleStartRelease = async () => {
    if (!project || !detail) return;
    
    const projectId = project.project;
    
    // 检查是否需要选择发布端
    // SCFQ 前端项目
    if (projectId === 'scfq' && project.type === 'web') {
      setCategoryDialogType('web');
      setCategoryDialogVisible(true);
      return;
    }
    
    // Risk 后端项目
    if (projectId?.includes('risk') && project.type !== 'web') {
      setCategoryDialogType('backend');
      setCategoryDialogVisible(true);
      return;
    }
    
    // 普通项目直接确认发版
    if (!await confirm({ content: `确定要开始发版项目 "${detail.project_name}" 吗？`, type: 'warning' })) return;
    
    await doStartRelease(null);
  };

  const handleCategorySelect = async (category: string) => {
    setCategoryDialogVisible(false);
    await doStartRelease(category === 'all' ? null : category);
  };

  const doStartRelease = async (category: string | null) => {
    if (!project) return;
    
    setReleaseLoading(true);
    try {
      const params: { project: string; type?: string; category?: string } = { project: project.project };
      if (project.type === 'web') params.type = 'web';
      if (category) params.category = category;
      
      const res = await startRelease(params);
      if (res.code === 200) {
        connectSSE();
        onRefresh?.();
      }
    } catch (err) {
      console.error('发版失败:', err);
    } finally {
      setReleaseLoading(false);
    }
  };

  const handleCancelTask = async (taskId: string) => {
    if (!await confirm({ content: '确定要取消该任务吗？', type: 'warning' })) return;
    try {
      await cancelTask(taskId);
      connectSSE();
    } catch (err) {
      console.error('取消失败:', err);
    }
  };

  const handleShowRecordDetail = (record: ReleaseRecord) => {
    setCurrentRecord(record);
    setRecordDialogVisible(true);
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
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-container">
        <div className="drawer-header">
          <h3>{project?.project_name} - 项目更新详情</h3>
          <button className="drawer-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="drawer-body">
          {loading ? (
            <div className="drawer-loading"><Loader2 size={24} className="spin" /> 加载中...</div>
          ) : (
            <>
              <div className="detail-info">
                <div className="info-grid">
                  <div className="info-item full"><span className="label">项目名称</span><span>{detail?.project_name || '-'}</span></div>
                  <div className="info-item"><span className="label">工具</span><span>{detail?.tool || (project?.type === 'web' ? detail?.frontend_tool : detail?.backend_tool) || '-'}</span></div>
                  <div className="info-item"><span className="label">更新总数</span><span>{detail?.total_updates || 0}</span></div>
                  <div className="info-item full"><span className="label">Git 地址</span><span className="link">{detail?.git_url || '-'}</span></div>
                  <div className="info-item full"><span className="label">任务飞书通知</span><span className="link">{detail?.update_feishu || detail?.feishu_url || '-'}</span></div>
                  <div className="info-item full"><span className="label">步骤飞书通知</span><span className="link">{detail?.notify_feishu || '-'}</span></div>
                  <div className="info-item full"><span className="label">最后更新</span><span>{detail?.last_update || '-'}</span></div>
                </div>
              </div>

              <div className="records-section">
                <div className="records-header">
                  <h4>发版记录</h4>
                  <button className="btn-release" onClick={handleStartRelease} disabled={releaseLoading}>
                    {releaseLoading ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
                    开始发版
                  </button>
                </div>
                {records.length === 0 ? (
                  <div className="drawer-empty">暂无发版记录</div>
                ) : (
                  <div className="records-table">
                    <table>
                      <thead><tr><th>ID</th><th>任务ID</th><th>开始时间</th><th>完成时间</th><th>状态</th><th>操作</th></tr></thead>
                      <tbody>
                        {records.map((r, i) => (
                          <tr key={r.id || i}>
                            <td>{r.id || i + 1}</td>
                            <td className="task-id" title={r.task_id}>{r.task_id?.slice(0, 12) || '-'}</td>
                            <td>{r.started_at || r.start_time || '-'}</td>
                            <td>{r.completed_at || r.end_time || '-'}</td>
                            <td><span className={`status-tag ${getStatusClass(r.status)}`}>{getStatusText(r.status)}</span></td>
                            <td>
                              {(r.status === 'running' || r.status === 'pending') && (
                                <button className="btn-cancel" onClick={() => handleCancelTask(r.task_id)}>取消</button>
                              )}
                              <button className="btn-detail" onClick={() => handleShowRecordDetail(r)}>详情</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`
        .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1000; }
        .drawer-container { position: fixed; top: 0; right: 0; width: 42%; min-width: 500px; max-width: 90%; height: 100vh; background: var(--bg-color, #fff); z-index: 1001; display: flex; flex-direction: column; box-shadow: -4px 0 20px rgba(0,0,0,0.15); }
        .drawer-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color, #e8e8e8); flex-shrink: 0; }
        .drawer-header h3 { margin: 0; font-size: 16px; }
        .drawer-close { background: none; border: none; cursor: pointer; color: var(--text-secondary, #666); }
        .drawer-body { flex: 1; overflow: auto; padding: 20px; display: flex; flex-direction: column; }
        .drawer-loading, .drawer-empty { display: flex; align-items: center; justify-content: center; gap: 8px; height: 150px; color: var(--text-secondary, #999); }
        .detail-info { margin-bottom: 24px; flex-shrink: 0; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .info-item { display: flex; flex-direction: column; gap: 4px; padding: 10px; background: var(--bg-secondary, #fafafa); border-radius: 4px; }
        .info-item.full { grid-column: span 2; }
        .info-item .label { font-size: 12px; color: var(--text-secondary, #999); }
        .info-item .link { color: var(--primary-color, #1890ff); word-break: break-all; font-size: 13px; }
        .records-section { flex: 1; display: flex; flex-direction: column; min-height: 0; }
        .records-section h4 { margin: 0; font-size: 15px; color: var(--text-color, #e0e0e0); }
        .records-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-shrink: 0; }
        .btn-release { display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: var(--primary-color, #1890ff); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
        .btn-release:disabled { opacity: 0.6; cursor: not-allowed; }
        .records-table { border: 1px solid var(--border-color, #e8e8e8); border-radius: 4px; overflow: auto; flex: 1; }
        .records-table table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .records-table th, .records-table td { padding: 10px 8px; border-bottom: 1px solid var(--border-color, #e8e8e8); text-align: center; }
        .records-table th { background: var(--bg-secondary, #fafafa); font-weight: 600; position: sticky; top: 0; z-index: 1; }
        .records-table .task-id { max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; }
        .status-tag { display: inline-block; padding: 2px 8px; font-size: 12px; border: none; background: none; }
        .status-tag.success { color: #73d13d; }
        .status-tag.danger { color: #ff7875; }
        .status-tag.warning { color: #ffa940; }
        .status-tag.default { color: var(--text-secondary, #999); }
        .btn-cancel, .btn-detail { padding: 2px 8px; margin: 0 2px; border: 1px solid var(--border-color, #3a3a3a); background: var(--bg-secondary, #2a2a2a); color: var(--text-color, #e0e0e0); border-radius: 4px; cursor: pointer; font-size: 12px; }
        .btn-cancel:hover { color: #ff4d4f; border-color: #ff4d4f; }
        .btn-detail:hover { color: var(--primary-color, #1890ff); border-color: var(--primary-color, #1890ff); }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <RecordDetailDialog
        visible={recordDialogVisible}
        record={currentRecord}
        projectDetail={detail}
        onClose={() => setRecordDialogVisible(false)}
        onRefresh={() => connectSSE()}
      />

      <CategorySelectDialog
        visible={categoryDialogVisible}
        type={categoryDialogType}
        projectName={detail?.project_name || ''}
        onSelect={handleCategorySelect}
        onClose={() => setCategoryDialogVisible(false)}
      />
    </>
  );
};

export default ProjectDetailDrawer;