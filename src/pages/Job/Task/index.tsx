/**
 * 任务管理页面
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Loader2 } from 'lucide-react';
import { getTaskList, deleteTask, updateTask, Task } from '../../../services/job/task';
import toast from '../../../components/Toast';
import { confirm } from '../../../components/ConfirmModal';
import TaskForm from './components/TaskForm';
import TaskBindDialog from './components/TaskBindDialog';
import TaskDetailDialog from './components/TaskDetailDialog';
import './index.css';

const TaskManagement = () => {
  const [loading, setLoading] = useState(false);
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [keyword, setKeyword] = useState('');
  
  // 表单弹框
  const [formVisible, setFormVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  // 绑定项目弹框
  const [bindVisible, setBindVisible] = useState(false);
  const [bindingTask, setBindingTask] = useState<Task | null>(null);
  
  // 详情弹框
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<number | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTaskList();
      if (res.code === 200) {
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.list || [];
        setTaskList(list as Task[]);
      }
    } catch { toast.error('获取任务列表失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  const filteredList = taskList.filter(t => 
    !keyword || t.name?.includes(keyword) || t.task_key?.includes(keyword)
  );

  const handleAdd = () => { setEditingTask(null); setFormVisible(true); };
  const handleEdit = (task: Task) => { setEditingTask(task); setFormVisible(true); };
  const handleViewDetail = (task: Task) => { setDetailTaskId(task.id); setDetailVisible(true); };
  const handleBind = (task: Task) => { setBindingTask(task); setBindVisible(true); };

  const handleToggleStatus = async (task: Task) => {
    const newStatus = task.status === 1 ? 0 : 1;
    try {
      const res = await updateTask({ id: task.id, status: newStatus });
      if (res.code === 200) {
        toast.success(newStatus === 1 ? '启动成功' : '停止成功');
        // 更新本地状态
        setTaskList(list => list.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
      } else {
        toast.error(res.message || '操作失败');
      }
    } catch { toast.error('操作失败'); }
  };

  const handleDelete = async (task: Task) => {
    if (!await confirm({ content: `确定要删除任务 "${task.name}" 吗？`, type: 'danger' })) return;
    try {
      const res = await deleteTask(task.id);
      if (res.code === 200) { toast.success('删除成功'); fetchList(); }
    } catch { toast.error('删除失败'); }
  };

  const handleFormSuccess = () => { setFormVisible(false); fetchList(); };
  const handleBindSuccess = () => { setBindVisible(false); fetchList(); };

  return (
    <div className="task-page">
      <div className="search-bar">
        <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="搜索任务名称/标识" className="search-input" />
        <button className="btn-refresh" onClick={fetchList}><RefreshCw size={14} /></button>
      </div>

      <div className="table-section">
        <div className="section-header">
          <span className="title">任务列表</span>
          <button className="btn-primary" onClick={handleAdd}><Plus size={14} /> 新建任务</button>
        </div>

        {loading ? (
          <div className="loading-state"><Loader2 size={24} className="spin" /> 加载中...</div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>任务名称</th><th>任务标识</th><th>cron表达式</th><th>执行周期</th><th>描述</th><th>状态</th><th>操作</th></tr>
              </thead>
              <tbody>
                {filteredList.map(task => (
                  <tr key={task.id}>
                    <td title={task.name}>{task.name}</td>
                    <td title={task.task_key}>{task.task_key}</td>
                    <td>{task.cron || '-'}</td>
                    <td title={task.cron}>{task.cron_desc || '-'}</td>
                    <td title={task.description}>{task.description || '-'}</td>
                    <td><span className={`status-tag ${task.status === 1 ? 'success' : 'default'}`}>{task.status === 1 ? '运行中' : '已停止'}</span></td>
                    <td className="action-cell">
                      <button className="btn-link" onClick={() => handleViewDetail(task)}>详情</button>
                      <button className="btn-link" onClick={() => handleEdit(task)}>编辑</button>
                      <button className="btn-link" onClick={() => handleBind(task)}>绑定项目</button>
                      <button className={`btn-link ${task.status === 1 ? 'warning' : 'success'}`} onClick={() => handleToggleStatus(task)}>{task.status === 1 ? '停止' : '启动'}</button>
                      <button className="btn-link danger" onClick={() => handleDelete(task)}>删除</button>
                    </td>
                  </tr>
                ))}
                {filteredList.length === 0 && <tr><td colSpan={7} className="empty-cell">暂无数据</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TaskForm visible={formVisible} task={editingTask} onClose={() => setFormVisible(false)} onSuccess={handleFormSuccess} />
      <TaskBindDialog visible={bindVisible} task={bindingTask} onClose={() => setBindVisible(false)} onSuccess={handleBindSuccess} />
      <TaskDetailDialog visible={detailVisible} taskId={detailTaskId} onClose={() => setDetailVisible(false)} />
    </div>
  );
};

export default TaskManagement;
