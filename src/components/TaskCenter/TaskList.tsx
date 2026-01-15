/**
 * 任务列表组件
 */

import { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import TaskItem from './TaskItem';
import type { Task } from '../../services/task';

interface TaskListProps {
  tasks: Task[];
  loading: boolean;
  onPreview: (task: Task) => void;
  onRefresh: () => void;
}

const TaskList = ({ tasks, loading, onPreview, onRefresh }: TaskListProps) => {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleExpand = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="task-empty">
        <Loader2 size={32} className="spin" />
        <p>加载中...</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="task-empty">
        <AlertCircle size={48} />
        <p>暂无任务</p>
      </div>
    );
  }

  return (
    <div className="task-list">
      {tasks.map(task => (
        <TaskItem
          key={task.id}
          task={task}
          expanded={expandedTasks.has(task.id)}
          onToggle={() => toggleExpand(task.id)}
          onPreview={() => onPreview(task)}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
};

export default TaskList;
