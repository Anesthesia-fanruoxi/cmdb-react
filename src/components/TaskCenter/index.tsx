/**
 * 任务中心抽屉组件 - 重构版
 * 支持任务类型切换、搜索、SSE实时更新
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  X, Search, BarChart3, FileText, Database
} from 'lucide-react';
import { getToken } from '../../services/storage/tokenStorage';
import { useAuthStore } from '../../stores/authStore';
import { dialogStackManager } from '../../utils/dialogStack';
import { previewTaskData } from '../../services/task';
import { toast } from '../Toast';
import TaskList from './TaskList';
import PreviewModal from './PreviewModal';
import type { Task, PreviewData } from '../../services/task';
import './style.css';

// 任务类型配置
const TASK_TABS = [
  { type: 'analysis', name: '数据分析', icon: BarChart3, color: '#409EFF' },
  { type: 'es_export', name: '日志导出', icon: FileText, color: '#E6A23C' },
  { type: 'sql_export', name: 'SQL导出', icon: Database, color: '#F56C6C' },
] as const;

type TaskType = typeof TASK_TABS[number]['type'];

interface TaskCenterProps {
  visible: boolean;
  onClose: () => void;
}

const TaskCenter = ({ visible, onClose }: TaskCenterProps) => {
  const { user } = useAuthStore();
  const [activeType, setActiveType] = useState<TaskType>('analysis');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 预览相关
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData>({
    items: [],
    columns: [],
    rows: [],
    total: 0,
    total_rows: 0,
    cache_total: 0,
    page: 1,
    page_size: 20,
  });
  const [currentPreviewTask, setCurrentPreviewTask] = useState<Task | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 是否显示搜索框（管理员或有多个用户的任务）
  const showSearch = String(user?.role_id) === '1' || taskList.some(t => t.nick_name);

  // 关闭 SSE 连接
  const closeSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // 获取任务列表（SSE）
  const fetchTaskList = useCallback(() => {
    closeSSE();
    setLoading(true);

    const token = getToken();
    const baseUrl = import.meta.env.VITE_SSE_BASE_URL || import.meta.env.VITE_API_BASE_URL || '';
    const keyword = searchKeyword ? `&keyword=${encodeURIComponent(searchKeyword)}` : '';
    const url = `${baseUrl}/tasks/list?type=${activeType}${keyword}&token=${token}`;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', () => {
      console.log('[TaskCenter] SSE 连接成功');
    });

    eventSource.addEventListener('data', (event) => {
      try {
        const data = JSON.parse(event.data);
        const tasks = (data.tasks || []).sort((a: Task, b: Task) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setTaskList(tasks);
        setLoading(false);
      } catch (e) {
        console.error('[TaskCenter] SSE 解析错误:', e);
      }
    });

    eventSource.onerror = () => {
      console.error('[TaskCenter] SSE 错误');
      closeSSE();
      setLoading(false);
    };

    eventSource.addEventListener('complete', () => {
      closeSSE();
    });
  }, [activeType, searchKeyword, closeSSE]);

  // 切换任务类型
  const handleTabSwitch = (type: TaskType) => {
    setActiveType(type);
    setSearchKeyword('');
  };

  // 搜索防抖
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      fetchTaskList();
    }, 300);
  };

  // 打开时获取任务列表
  useEffect(() => {
    if (visible) {
      fetchTaskList();
    } else {
      closeSSE();
    }
  }, [visible, activeType, fetchTaskList, closeSSE]);

  // ESC 关闭（只在最顶层时响应）
  useEffect(() => {
    const dialogId = 'task-center';
    
    if (!visible) {
      dialogStackManager.pop(dialogId);
      return;
    }
    
    dialogStackManager.push(dialogId);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dialogStackManager.isTop(dialogId)) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      dialogStackManager.pop(dialogId);
    };
  }, [visible, onClose]);

  // 获取预览数据
  const handlePreview = async (task: Task, page = 1) => {
    setCurrentPreviewTask(task);
    setPreviewVisible(true);
    setPreviewLoading(true);
    
    try {
      const res = await previewTaskData({ id: task.id, type: task.type, page });
      if (res.code === 200) {
        setPreviewData(res.data);
      } else {
        toast.error('获取预览数据失败');
      }
    } catch (error) {
      console.error('[TaskCenter] 预览失败:', error);
      toast.error('获取预览数据失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  // 预览分页
  const handlePreviewPageChange = (task: Task, page: number) => {
    handlePreview(task, page);
  };

  // 组件卸载时关闭 SSE
  useEffect(() => {
    return () => {
      closeSSE();
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [closeSSE]);

  if (!visible) return null;

  return (
    <>
      <div className="task-drawer-overlay" onClick={onClose} />
      <div className="task-drawer">
        <div className="drawer-header">
          <h3>任务中心</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* 任务类型标签 */}
        <div className="task-tabs">
          {TASK_TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <div
                key={tab.type}
                className={`task-tab-card ${activeType === tab.type ? 'active' : ''}`}
                onClick={() => handleTabSwitch(tab.type)}
              >
                <Icon size={20} style={{ color: activeType === tab.type ? '#fff' : tab.color }} />
                <span className="tab-name">{tab.name}</span>
              </div>
            );
          })}
        </div>

        {/* 搜索框 */}
        {showSearch && (
          <div className="task-search">
            <div className="search-input">
              <Search size={16} />
              <input
                type="text"
                placeholder="支持中英文顺序模糊"
                value={searchKeyword}
                onChange={(e) => handleSearch(e.target.value)}
              />
              {searchKeyword && (
                <button className="clear-btn" onClick={() => handleSearch('')}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* 任务列表 */}
        <div className="drawer-content">
          <TaskList
            tasks={taskList}
            loading={loading}
            onPreview={handlePreview}
            onRefresh={fetchTaskList}
          />
        </div>
      </div>

      {/* 预览弹窗 */}
      <PreviewModal
        visible={previewVisible}
        loading={previewLoading}
        data={previewData}
        currentTask={currentPreviewTask}
        onClose={() => {
          setPreviewVisible(false);
          setPreviewData({
            items: [],
            columns: [],
            rows: [],
            total: 0,
            total_rows: 0,
            cache_total: 0,
            page: 1,
            page_size: 20,
          });
        }}
        onPageChange={handlePreviewPageChange}
      />
    </>
  );
};

export default TaskCenter;
