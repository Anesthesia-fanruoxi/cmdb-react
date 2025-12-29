/**
 * 任务中心抽屉组件
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  X, Clock, CheckCircle, XCircle, Loader2, AlertCircle 
} from 'lucide-react';
import { getTaskList, getTaskStatus, cancelTask, previewTaskData, exportTaskData, Task, PreviewData } from '../../services/task';
import { toast } from '../Toast';
import { useMessageStore } from '../../stores/messageStore';
import PreviewModal from './PreviewModal';
import './style.css';

// 状态配置
const STATUS_CONFIG = {
  pending: { text: '等待中', icon: Clock, color: 'var(--color-info)' },
  running: { text: '执行中', icon: Loader2, color: 'var(--color-warning)' },
  success: { text: '已完成', icon: CheckCircle, color: 'var(--color-success)' },
  failed: { text: '失败', icon: XCircle, color: 'var(--color-danger)' },
  canceled: { text: '已取消', icon: AlertCircle, color: 'var(--color-warning)' },
};

const TASK_TYPE_MAP: Record<string, string> = { analysis: '数据分析', export: '数据导出' };
const STEP_NAME_MAP: Record<string, string> = { initialize: '初始化', prepare: '准备', execute: '执行', cleanup: '清理' };

interface TaskCenterProps {
  visible: boolean;
  onClose: () => void;
}

const TaskCenter = ({ visible, onClose }: TaskCenterProps) => {
  const addMessage = useMessageStore(state => state.addMessage);
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [taskDetails, setTaskDetails] = useState<Record<string, Task>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [currentPreviewTask, setCurrentPreviewTask] = useState<Task | null>(null);

  const fetchTaskList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getTaskList();
      if (res.code === 200) {
        const sorted = res.data.items.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setTaskList(sorted);
      }
    } catch {
      toast.error('获取任务列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchTaskList();
      setExpandedTasks(new Set());
      setTaskDetails({});
    }
  }, [visible, fetchTaskList]);

  const fetchTaskDetail = async (taskId: string) => {
    if (loadingDetails[taskId] || taskDetails[taskId]) return;
    setLoadingDetails(prev => ({ ...prev, [taskId]: true }));
    try {
      const res = await getTaskStatus(taskId);
      if (res.code === 200) {
        setTaskDetails(prev => ({ ...prev, [taskId]: res.data }));
        if (res.data.status === 'running' || res.data.status === 'pending') {
          pollTaskStatus(taskId);
        }
      }
    } catch {
      toast.error('获取任务详情失败');
    } finally {
      setLoadingDetails(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const pollTaskStatus = async (taskId: string) => {
    if (!expandedTasks.has(taskId)) return;
    try {
      const res = await getTaskStatus(taskId);
      if (res.code === 200) {
        setTaskDetails(prev => ({ ...prev, [taskId]: res.data }));
        if ((res.data.status === 'running' || res.data.status === 'pending') && expandedTasks.has(taskId)) {
          setTimeout(() => pollTaskStatus(taskId), 3000);
        }
      }
    } catch (e) { console.error('轮询失败:', e); }
  };

  const toggleTaskDetail = (task: Task) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(task.id)) {
      newExpanded.delete(task.id);
    } else {
      newExpanded.add(task.id);
      fetchTaskDetail(task.id);
    }
    setExpandedTasks(newExpanded);
  };

  const handleCancelTask = async (taskId: string) => {
    try {
      const res = await cancelTask(taskId);
      if (res.code === 200) {
        toast.success('任务已取消');
        setTaskDetails(prev => { const n = { ...prev }; delete n[taskId]; return n; });
        fetchTaskDetail(taskId);
      }
    } catch { toast.error('取消任务失败'); }
  };

  const handlePreview = async (task: Task, page = 1) => {
    setPreviewLoading(true);
    setCurrentPreviewTask(task);
    try {
      const res = await previewTaskData({ id: task.id, type: task.type, page });
      if (res.code === 200) { setPreviewData(res.data); setPreviewVisible(true); }
    } catch { toast.error('获取预览数据失败'); }
    finally { setPreviewLoading(false); }
  };

  const handleExport = async (task: Task) => {
    try {
      const res = await exportTaskData({ id: task.id, type: task.type });
      const blob = new Blob([res], { type: 'application/vnd.ms-excel' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      const fileName = `${task.type}_${task.id.slice(0, 8)}_${Date.now()}.xlsx`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(link.href);
      
      // 同时显示 toast 和添加到消息中心
      toast.success('导出成功');
      addMessage({
        type: 'success',
        title: '任务导出成功',
        content: `文件 ${fileName} 已下载`,
      });
    } catch {
      toast.error('导出失败');
    }
  };

  const formatDuration = (d?: number) => {
    if (!d) return '0ms';
    if (d < 1000) return `${d}ms`;
    const s = Math.floor(d / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const renderStatus = (status: Task['status']) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const Icon = cfg.icon;
    return <span className="task-status" style={{ color: cfg.color }}><Icon size={14} className={status === 'running' ? 'spin' : ''} />{cfg.text}</span>;
  };

  if (!visible) return null;

  return (
    <>
      <div className="task-drawer-overlay" onClick={onClose} />
      <div className="task-drawer">
        <div className="drawer-header">
          <h3>任务中心</h3>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="drawer-content">
          {loading && taskList.length === 0 ? (
            <div className="task-empty"><Loader2 size={32} className="spin" /><p>加载中...</p></div>
          ) : taskList.length === 0 ? (
            <div className="task-empty"><AlertCircle size={48} /><p>暂无任务</p></div>
          ) : (
            <div className="task-list">
              {taskList.map(task => (
                <div key={task.id} className={`task-item task-${task.status}`}>
                  <div className="task-header" onClick={() => toggleTaskDetail(task)}>
                    <div className="task-info">
                      <span className="task-id">ID: {task.id.slice(0, 8)}</span>
                      <span className="task-time">{task.created_at}</span>
                      <span className="task-type">{TASK_TYPE_MAP[task.type] || task.type}</span>
                      {renderStatus(task.status)}
                    </div>
                    <div className="task-actions">
                      <button className="link-btn" onClick={(e) => { e.stopPropagation(); handlePreview(task); }}>预览</button>
                      <button className="link-btn" onClick={(e) => { e.stopPropagation(); handleExport(task); }}>导出</button>
                    </div>
                  </div>
                  {expandedTasks.has(task.id) && (
                    <div className="task-detail">
                      {loadingDetails[task.id] ? <div className="detail-loading"><Loader2 size={20} className="spin" /></div> : taskDetails[task.id] ? (
                        <>
                          {taskDetails[task.id].progress !== undefined && (
                            <div className="detail-row"><span className="detail-label">进度：</span><div className="progress-bar"><div className="progress-fill" style={{ width: `${taskDetails[task.id].progress}%` }} /></div><span>{taskDetails[task.id].progress}%</span></div>
                          )}
                          {taskDetails[task.id].error_message && <div className="detail-row error"><span className="detail-label">错误：</span><span className="error-msg">{taskDetails[task.id].error_message}</span></div>}
                          {taskDetails[task.id].setup && (
                            <div className="detail-row"><span className="detail-label">步骤：</span>
                              <div className="setup-steps">{Object.entries(taskDetails[task.id].setup!).sort().map(([k, s]) => (
                                <div key={k} className={`setup-step step-${s.status}`}><span>{STEP_NAME_MAP[k] || k}：{s.status || '未开始'}</span>{s.duration !== undefined && <span className="step-dur">{formatDuration(s.duration)}</span>}</div>
                              ))}</div>
                            </div>
                          )}
                          {(taskDetails[task.id].status === 'running' || taskDetails[task.id].status === 'pending') && (
                            <div className="detail-actions"><button className="cancel-btn" onClick={() => handleCancelTask(task.id)}><X size={14} /> 取消</button></div>
                          )}
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <PreviewModal visible={previewVisible} loading={previewLoading} data={previewData} currentTask={currentPreviewTask} onClose={() => setPreviewVisible(false)} onPageChange={handlePreview} />
    </>
  );
};

export default TaskCenter;
