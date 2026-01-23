/**
 * 任务项组件
 */

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Download, Link as LinkIcon } from 'lucide-react';
import { getTaskDetail, cancelTask, generateDownloadLink, type Task } from '../../services/task';
import { toast } from '../Toast';
import TaskDetailPanel from './TaskDetailPanel';
import DownloadDialog from './DownloadDialog';

interface TaskItemProps {
  task: Task;
  expanded: boolean;
  onToggle: () => void;
  onPreview: () => void;
  onRefresh: () => void;
}

// 任务类型映射
const TASK_TYPE_MAP: Record<string, string> = {
  analysis: '数据分析',
  es_export: '日志导出',
  sql_export: 'SQL导出',
};

// 状态映射
const STATUS_MAP: Record<string, string> = {
  pending: '执行中',
  running: '执行中',
  success: '已完成',
  failed: '失败',
  canceled: '已取消',
};

// 状态样式类
const getStatusClass = (status: string) => {
  switch (status) {
    case 'success': return 'task-status-success';
    case 'running': return 'task-status-running';
    case 'canceled': return 'task-status-canceled';
    case 'failed': return 'task-status-failed';
    default: return '';
  }
};

// 状态标签类型
const getStatusType = (status: string) => {
  switch (status) {
    case 'success': return 'success';
    case 'running':
    case 'pending': return 'warning';
    case 'failed': return 'danger';
    default: return 'info';
  }
};

const TaskItem = ({ task, expanded, onToggle, onPreview, onRefresh }: TaskItemProps) => {
  const [taskDetail, setTaskDetail] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [generating, setGenerating] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // 获取任务详情（SSE）
  useEffect(() => {
    if (expanded && !taskDetail) {
      setLoading(true);
      
      const eventSource = getTaskDetail(
        task.id,
        (data) => {
          setTaskDetail(data);
          setLoading(false);
        },
        () => {
          setLoading(false);
          toast.error('获取任务详情失败');
        },
        () => {
          eventSourceRef.current = null;
        }
      );
      
      eventSourceRef.current = eventSource;
    }
    
    // 关闭 SSE
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [expanded, task.id]);

  // 取消任务
  const handleCancel = async () => {
    try {
      const res = await cancelTask(task.id);
      if (res.code === 200) {
        toast.success('任务已取消');
        setTaskDetail(null);
        onRefresh();
      }
    } catch {
      toast.error('取消任务失败');
    }
  };

  // 处理下载
  const handleDownload = async () => {
    // 如果已有下载链接，直接下载
    if (task.download_url) {
      window.open(task.download_url, '_blank');
      return;
    }

    // 否则生成下载链接
    setGenerating(true);
    try {
      const res = await generateDownloadLink(task.id);
      if (res.code === 200) {
        setDownloadUrl(res.data.downloadUrl);
        setShowDownloadDialog(true);
      } else {
        toast.error(res.message || '生成下载链接失败');
      }
    } catch {
      toast.error('生成下载链接失败');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className={`task-item ${task.is_expired ? 'task-expired' : ''}`}>
        <div className={`task-header ${getStatusClass(task.status)}`}>
          <div className="task-basic-info">
            <span className="task-type-name">
              {task.type_text || TASK_TYPE_MAP[task.type] || task.type}
            </span>
            {task.nick_name && (
              <span className="task-nick-name">{task.nick_name}</span>
            )}
            <span className="task-time">{task.created_at}</span>
            <span className={`task-status-tag tag-${getStatusType(task.status)}`}>
              {task.status_text || STATUS_MAP[task.status] || task.status}
            </span>
          </div>
          <div className="task-actions-group">
            {task.status === 'success' && (
              <>
                <button
                  className="link-btn"
                  onClick={(e) => { e.stopPropagation(); onPreview(); }}
                  disabled={task.is_expired}
                >
                  预览
                </button>
                <button
                  className="link-btn"
                  onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                  disabled={generating}
                >
                  {task.download_url ? (
                    <><Download size={14} /> 下载</>
                  ) : (
                    <><LinkIcon size={14} /> {generating ? '生成中...' : '生成链接'}</>
                  )}
                </button>
              </>
            )}
            <button
              className="link-btn"
              onClick={onToggle}
              disabled={task.is_expired}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {expanded ? '收起' : '详情'}
            </button>
          </div>
        </div>
        {expanded && (
          <div className="task-detail">
            <TaskDetailPanel
              taskId={task.id}
              taskDetail={taskDetail}
              loading={loading}
              onCancel={handleCancel}
            />
          </div>
        )}
      </div>

      {/* 下载对话框 */}
      <DownloadDialog
        visible={showDownloadDialog}
        downloadUrl={downloadUrl}
        taskType={task.type}
        taskId={task.id}
        onClose={() => {
          setShowDownloadDialog(false);
          setDownloadUrl('');
          onRefresh(); // 刷新列表，获取新的 download_url
        }}
      />
    </>
  );
};

export default TaskItem;
