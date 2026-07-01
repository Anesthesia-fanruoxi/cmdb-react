/**
 * 任务中心抽屉组件
 * 支持任务类型切换、搜索、SSE实时更新
 */

import { useState, useEffect, useRef } from 'react';
import { X, Search, BarChart3, FileText, Database } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useTaskCenterStore } from '../../stores/taskCenterStore';
import { dialogStackManager } from '../../utils/dialogStack';
import { previewTaskData } from '../../services/task';
import { toast } from '../Toast';
import TaskList from './TaskList';
import PreviewModal from './PreviewModal';
import type { Task, PreviewData } from '../../services/task';
import './style.css';

// 任务类型配置
const TASK_TABS = [
  { type: 'analysis' as const, name: '数据分析', icon: BarChart3, color: '#409EFF' },
  { type: 'es_export' as const, name: '日志导出', icon: FileText, color: '#E6A23C' },
  { type: 'sql_export' as const, name: 'SQL导出', icon: Database, color: '#F56C6C' },
];

interface TaskCenterProps {
  visible: boolean;
  onClose: () => void;
}

const TaskCenter = ({ visible, onClose }: TaskCenterProps) => {
  const { user } = useAuthStore();
  const {
    activeType,
    searchKeyword,
    taskList,
    loading,
    setActiveType,
    setSearchKeyword,
    refreshTaskList,
  } = useTaskCenterStore();

  // 预览相关
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData>({
    items: [],
    columns: [],
    rows: [],
    total: 0,
    total_rows: 0,
    page: 1,
    page_size: 20,
  });
  const [currentPreviewTask, setCurrentPreviewTask] = useState<Task | null>(null);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 按 activeType 和 searchKeyword 过滤任务列表
  const filteredTaskList = taskList.filter(t => {
    if (t.type !== activeType) return false;
    if (!searchKeyword) return true;
    const keyword = searchKeyword.toLowerCase();
    return (
      (t.type_text && t.type_text.toLowerCase().includes(keyword)) ||
      (t.nick_name && t.nick_name.toLowerCase().includes(keyword)) ||
      (t.error_message && t.error_message.toLowerCase().includes(keyword))
    );
  });

  // 是否显示搜索框（管理员或有多个用户的任务）
  const showSearch = String(user?.role_id) === '1' || taskList.some(t => t.nick_name);

  // visible 变化时刷新任务列表
  useEffect(() => {
    if (visible) {
      refreshTaskList();
    }
  }, [visible, refreshTaskList]);

  // 切换任务类型
  const handleTabSwitch = (type: typeof activeType) => {
    setActiveType(type);
  };

  // 搜索防抖（客户端过滤，无需重新订阅）
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
  };

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
    console.log('[TaskCenter] 点击预览的任务:', task);
    setCurrentPreviewTask(task);
    setPreviewVisible(true);
    setPreviewLoading(true);

    try {
      console.log('[TaskCenter] 预览请求:', { id: task.id, type: task.type, page });
      const res = await previewTaskData({ id: task.id, type: task.type, page });
      console.log('[TaskCenter] 预览返回:', res);
      if (res.code === 200) {
        setPreviewData(res.data);
      } else {
        toast.error(res.message || '获取预览数据失败');
      }
    } catch (e: any) {
      console.error('[TaskCenter] 预览异常:', e);
      toast.error(e?.message || '获取预览数据失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  // 预览分页
  const handlePreviewPageChange = (task: Task, page: number) => {
    handlePreview(task, page);
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

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
            tasks={filteredTaskList}
            loading={loading}
            onPreview={handlePreview}
            onRefresh={refreshTaskList}
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
