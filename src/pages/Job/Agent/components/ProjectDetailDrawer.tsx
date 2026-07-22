/**
 * 项目详情抽屉 - 显示项目关联的任务列表
 */

import { X, RefreshCw, Loader2 } from 'lucide-react';
import type { Project, Task } from '../../../../services/job/agent';

interface Props {
  visible: boolean;
  project: Project | null;
  tasks: Task[];
  taskLoading: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onViewExec: (task: Task) => void;
  onConfigTask: (task: Task) => void;
}

const ProjectDetailDrawer = ({ visible, project, tasks, taskLoading, onClose, onRefresh, onViewExec, onConfigTask }: Props) => {
  if (!visible) return null;

  const getStatusText = (status: number) => status === 1 ? '运行中' : '已停止';
  const getStatusClass = (status: number) => status === 1 ? 'success' : 'default';

  return (
    <>
      <div className="drawer-overlay project-detail-overlay" onClick={onClose} />
      <div className="drawer-container project-detail-drawer">
        <div className="drawer-header">
          <h3>{project?.project_name || ''} - 节点管理</h3>
          <button className="drawer-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="drawer-body">
          <div className="project-info-alert">
            <div className="alert-title">{project?.project_name}</div>
            <div className="alert-desc">项目标识: {project?.project}</div>
          </div>

          <div className="section-header">
            <span className="section-title">关联任务 ({tasks.length})</span>
            <button className="btn-sm" onClick={onRefresh} disabled={taskLoading}>
              <RefreshCw size={14} className={taskLoading ? 'spin' : ''} /> 刷新
            </button>
          </div>

          {taskLoading ? (
            <div className="loading-state"><Loader2 size={20} className="spin" /> 加载中...</div>
          ) : tasks.length === 0 ? (
            <div className="empty-state">暂无关联任务</div>
          ) : (
            <div className="task-table-wrapper">
              <table className="task-table">
                <thead>
                  <tr>
                    <th>任务名称</th>
                    <th>任务标识</th>
                    <th>cron表达式</th>
                    <th>脚本类型</th>
                    <th>下次执行</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(task => (
                    <tr key={task.job_id}>
                      <td title={task.name}>{task.name}</td>
                      <td title={task.task_key}>{task.task_key}</td>
                      <td title={task.cron}>{task.cron || '-'}</td>
                      <td><span className="tag">{task.script_type || '-'}</span></td>
                      <td>{task.next_run_time || '-'}</td>
                      <td><span className={`status-tag ${getStatusClass(task.status)}`}>{getStatusText(task.status)}</span></td>
                      <td>
                        <button className="btn-link" onClick={() => onViewExec(task)}>执行记录</button>
                        <button className="btn-link" onClick={() => onConfigTask(task)}>配置</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .project-detail-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1000; }
        .project-detail-drawer { position: fixed; top: 0; right: 0; width: 55%; min-width: 600px; height: 100vh; background: var(--bg-color); z-index: 1001; display: flex; flex-direction: column; box-shadow: -4px 0 20px rgba(0,0,0,0.15); }
        .project-detail-drawer .drawer-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
        .project-detail-drawer .drawer-header h3 { margin: 0; font-size: 16px; color: var(--text-color); }
        .project-detail-drawer .drawer-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); }
        .project-detail-drawer .drawer-body { flex: 1; overflow: auto; padding: 20px; }
        .project-detail-drawer .project-info-alert { padding: 12px 16px; background: rgba(24, 144, 255, 0.1); border: 1px solid rgba(24, 144, 255, 0.3); border-radius: 6px; margin-bottom: 20px; }
        .project-detail-drawer .alert-title { font-size: 15px; font-weight: 500; color: var(--text-color); margin-bottom: 4px; }
        .project-detail-drawer .alert-desc { font-size: 13px; color: var(--text-secondary); }
        .project-detail-drawer .section-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 16px; }
        .project-detail-drawer .section-title { font-size: 15px; font-weight: 500; color: var(--text-color); }
        .project-detail-drawer .btn-sm { display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: var(--primary-color); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .project-detail-drawer .btn-sm:disabled { opacity: 0.6; }
        .project-detail-drawer .loading-state, .project-detail-drawer .empty-state { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 40px; color: var(--text-secondary); }
        .project-detail-drawer .task-table-wrapper { overflow: auto; border: 1px solid var(--border-color); border-radius: 6px; }
        .project-detail-drawer .task-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .project-detail-drawer .task-table th, .project-detail-drawer .task-table td { padding: 10px 12px; border-bottom: 1px solid var(--border-color); text-align: left; white-space: nowrap; }
        .project-detail-drawer .task-table th { background: var(--bg-secondary); font-weight: 600; color: var(--text-color); position: sticky; top: 0; z-index: 1; }
        .project-detail-drawer .task-table td { color: var(--text-secondary); max-width: 150px; overflow: hidden; text-overflow: ellipsis; }
        .project-detail-drawer .task-table tr:hover td { background: var(--bg-hover); }
        .project-detail-drawer .tag { display: inline-block; padding: 2px 8px; background: var(--bg-secondary); border-radius: 4px; font-size: 12px; }
        .project-detail-drawer .status-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
        .project-detail-drawer .status-tag.success { color: #52c41a; }
        .project-detail-drawer .status-tag.default { color: var(--text-secondary); }
        .project-detail-drawer .btn-link { background: none; border: none; color: var(--primary-color); cursor: pointer; font-size: 12px; padding: 2px 6px; }
        .project-detail-drawer .btn-link:hover { text-decoration: underline; }
        .project-detail-drawer .spin { animation: project-detail-spin 1s linear infinite; }
        @keyframes project-detail-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
};

export default ProjectDetailDrawer;
