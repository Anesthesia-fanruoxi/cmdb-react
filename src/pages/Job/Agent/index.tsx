/**
 * Agent 管理页面
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { getJobAgentProjects, getProjectTasks, getTaskExecList, Project, Task, ExecRecord } from '../../../services/job/agent';
import toast from '../../../components/Toast';
import ProjectDetailDrawer from './components/ProjectDetailDrawer';
import TaskExecDialog from './components/TaskExecDialog';
import TaskConfigDialog from './components/TaskConfigDialog';
import ExecDetailDrawer from './components/ExecDetailDrawer';
import './index.css';

const AgentManagement = () => {
  const [loading, setLoading] = useState(false);
  const [projectList, setProjectList] = useState<Project[]>([]);
  
  // 项目详情抽屉
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [taskLoading, setTaskLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // 任务执行记录对话框
  const [execDialogVisible, setExecDialogVisible] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [execLoading, setExecLoading] = useState(false);
  const [execList, setExecList] = useState<ExecRecord[]>([]);
  
  // 任务配置对话框
  const [configDialogVisible, setConfigDialogVisible] = useState(false);
  
  // 执行详情抽屉
  const [execDetailVisible, setExecDetailVisible] = useState(false);
  const [currentExecId, setCurrentExecId] = useState<number | null>(null);

  // 加载项目列表
  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getJobAgentProjects();
      if (res.code === 200) setProjectList((res.data || []) as Project[]);
    } catch (err) {
      toast.error('加载项目列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载项目任务
  const loadProjectTasks = useCallback(async (project: string) => {
    setTaskLoading(true);
    try {
      const res = await getProjectTasks(project);
      if (res.code === 200) setTasks((res.data || []) as Task[]);
    } catch (err) {
      toast.error('获取项目任务失败');
      setTasks([]);
    } finally {
      setTaskLoading(false);
    }
  }, []);

  // 加载执行记录
  const loadExecList = useCallback(async (project: string, taskName: string) => {
    setExecLoading(true);
    try {
      const res = await getTaskExecList({ project, task_name: taskName });
      if (res.code === 200) setExecList(((res.data as any)?.list || []) as ExecRecord[]);
    } catch (err) {
      toast.error('获取执行记录失败');
      setExecList([]);
    } finally {
      setExecLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // 点击项目卡片
  const handleSelectProject = async (project: Project) => {
    setCurrentProject(project);
    setDrawerVisible(true);
    await loadProjectTasks(project.project);
  };

  // 查看任务执行记录
  const handleViewTaskExec = async (task: Task) => {
    setCurrentTask(task);
    setExecDialogVisible(true);
    if (currentProject) {
      await loadExecList(currentProject.project, task.name);
    }
  };

  // 配置任务
  const handleConfigTask = (task: Task) => {
    setCurrentTask(task);
    setConfigDialogVisible(true);
  };

  // 查看执行详情
  const handleViewExecDetail = (record: ExecRecord) => {
    setCurrentExecId(record.id);
    setExecDetailVisible(true);
  };

  // 配置成功回调
  const handleConfigSuccess = () => {
    if (currentProject) loadProjectTasks(currentProject.project);
  };

  return (
    <div className="agent-page">
      <div className="page-header">
        <div className="header-left">
          <h2>项目Agent管理</h2>
          <span className="subtitle">点击项目卡片查看已安装Agent的详情</span>
        </div>
        <button className="btn-refresh" onClick={loadProjects} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> 刷新
        </button>
      </div>

      <div className="project-grid" data-loading={loading}>
        {loading ? (
          <div className="loading-state"><Loader2 size={24} className="spin" /> 加载中...</div>
        ) : projectList.length === 0 ? (
          <div className="empty-state">暂无项目</div>
        ) : (
          projectList.map(project => (
            <div key={project.project} className="project-card" onClick={() => handleSelectProject(project)}>
              <div className="project-name">{project.project_name || project.project}</div>
              <div className="project-code">{project.project}</div>
            </div>
          ))
        )}
      </div>

      <ProjectDetailDrawer
        visible={drawerVisible}
        project={currentProject}
        tasks={tasks}
        taskLoading={taskLoading}
        onClose={() => setDrawerVisible(false)}
        onRefresh={() => currentProject && loadProjectTasks(currentProject.project)}
        onViewExec={handleViewTaskExec}
        onConfigTask={handleConfigTask}
      />

      <TaskExecDialog
        visible={execDialogVisible}
        task={currentTask}
        project={currentProject?.project}
        execList={execList}
        loading={execLoading}
        onClose={() => setExecDialogVisible(false)}
        onViewDetail={handleViewExecDetail}
      />

      <TaskConfigDialog
        visible={configDialogVisible}
        task={currentTask}
        project={currentProject}
        onClose={() => setConfigDialogVisible(false)}
        onSuccess={handleConfigSuccess}
      />

      <ExecDetailDrawer
        visible={execDetailVisible}
        execId={currentExecId}
        onClose={() => setExecDetailVisible(false)}
      />
    </div>
  );
};

export default AgentManagement;
