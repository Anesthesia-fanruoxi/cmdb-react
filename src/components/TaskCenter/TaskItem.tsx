/**
 * 任务项组件
 */

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getTaskDetail, cancelTask, exportTaskData, type Task } from '../../services/task';
import { toast } from '../Toast';
import { useMessageStore } from '../../stores/messageStore';
import TaskDetailPanel from './TaskDetailPanel';

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
  const addMessage = useMessageStore(state => state.addMessage);
  const [taskDetail, setTaskDetail] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
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
        // 重新获取详情
        setTaskDetail(null);
        onRefresh();
      }
    } catch {
      toast.error('取消任务失败');
    }
  };

  // 导出数据
  const handleExport = async () => {
    try {
      // 检查是否在 Tauri 环境
      const isTauri = '__TAURI__' in window;
      
      if (isTauri) {
        // Tauri 环境：使用文件保存对话框
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        
        const fileName = `${task.type}_${task.id.slice(0, 8)}_${Date.now()}.xlsx`;
        const filePath = await save({
          defaultPath: fileName,
          filters: [{
            name: 'Excel 文件',
            extensions: ['xlsx']
          }]
        });
        
        if (!filePath) {
          // 用户取消了保存
          return;
        }
        
        // 获取数据并保存
        const blob = await exportTaskData({ id: task.id, type: task.type });
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        await writeFile(filePath, uint8Array);
        
        toast.success('导出成功');
        addMessage({
          type: 'success',
          title: '任务导出成功',
          content: `文件已保存到：${filePath}`,
        });
      } else {
        // Web 环境：使用浏览器下载
        const blob = await exportTaskData({ id: task.id, type: task.type });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        const fileName = `${task.type}_${task.id.slice(0, 8)}_${Date.now()}.xlsx`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(link.href);
        
        toast.success('导出成功');
        addMessage({
          type: 'success',
          title: '任务导出成功',
          content: `文件 ${fileName} 已下载到浏览器默认下载目录`,
        });
      }
    } catch {
      toast.error('导出失败');
    }
  };

  return (
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
                onClick={(e) => { e.stopPropagation(); handleExport(); }}
              >
                下载
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
  );
};

export default TaskItem;
