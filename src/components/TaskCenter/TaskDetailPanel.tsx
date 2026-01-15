/**
 * 任务详情面板组件
 */

import { Loader2, X } from 'lucide-react';
import type { Task } from '../../services/task';

interface TaskDetailPanelProps {
  taskId: string;
  taskDetail: Task | null;
  loading: boolean;
  onCancel: () => void;
}

// 状态映射
const STATUS_MAP: Record<string, string> = {
  pending: '执行中',
  running: '执行中',
  success: '已完成',
  failed: '失败',
  canceled: '已取消',
};

// 步骤状态映射
const STEP_STATUS_MAP: Record<string, string> = {
  waiting: '等待中',
  running: '执行中',
  success: '成功',
  failed: '失败',
  '': '未开始',
};

// 格式化时长
const formatDuration = (duration?: number) => {
  if (duration == null) return '';
  if (duration < 1000) return `${duration}ms`;
  const seconds = Math.floor(duration / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
};

// 获取步骤状态类名
const getStepStatusClass = (status: string) => {
  switch (status) {
    case 'waiting': return 'step-waiting';
    case 'running': return 'step-running';
    case 'success': return 'step-success';
    case 'failed': return 'step-failed';
    default: return 'step-not-started';
  }
};

const TaskDetailPanel = ({ taskDetail, loading, onCancel }: TaskDetailPanelProps) => {
  if (loading) {
    return (
      <div className="detail-loading">
        <Loader2 size={20} className="spin" />
        <span>加载中...</span>
      </div>
    );
  }

  if (!taskDetail) {
    return null;
  }

  // 计算实际进度
  const realProgress = taskDetail.total_count 
    ? Math.round((taskDetail.processed_count || 0) / taskDetail.total_count * 100)
    : 0;

  // 排序步骤
  const sortedSteps = taskDetail.setup 
    ? Object.entries(taskDetail.setup).sort(([a], [b]) => a.localeCompare(b))
    : [];

  return (
    <div className="task-detail-content">
      {/* 状态 */}
      <div className="detail-item">
        <span className="detail-label">状态：</span>
        <span className={`task-status-tag tag-${taskDetail.status === 'success' ? 'success' : taskDetail.status === 'failed' ? 'danger' : 'warning'}`}>
          {taskDetail.status_text || STATUS_MAP[taskDetail.status] || taskDetail.status}
        </span>
      </div>

      {/* 进度信息 */}
      {taskDetail.status === 'running' && (
        <div className="detail-item">
          <span className="detail-label">进度：</span>
          <div className="progress-info">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${realProgress}%` }} />
            </div>
            <span className="progress-text">
              {taskDetail.processed_count} / {taskDetail.total_count}
            </span>
          </div>
        </div>
      )}

      {/* 错误信息 */}
      {taskDetail.error_message && (
        <div className="detail-item">
          <span className="detail-label">错误信息：</span>
          <div className="error-message">{taskDetail.error_message}</div>
        </div>
      )}

      {/* 执行步骤 */}
      {sortedSteps.length > 0 && (
        <div className="detail-item">
          <span className="detail-label">执行步骤：</span>
          <div className="setup-steps">
            {sortedSteps.map(([key, step]) => (
              <div key={key} className="setup-step">
                <span className="step-name">{key}：</span>
                <span className={getStepStatusClass(step.status)}>
                  {STEP_STATUS_MAP[step.status] || step.status}
                </span>
                {step.description && (
                  <span className="step-desc">{step.description}</span>
                )}
                {step.duration != null && (
                  <span className="step-duration">耗时：{formatDuration(step.duration)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 取消按钮 */}
      {(taskDetail.status === 'running' || taskDetail.status === 'pending') && (
        <div className="detail-actions">
          <button className="cancel-btn" onClick={onCancel}>
            <X size={14} />
            取消任务
          </button>
        </div>
      )}
    </div>
  );
};

export default TaskDetailPanel;
