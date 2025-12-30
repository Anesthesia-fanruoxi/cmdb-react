/**
 * Agent 项目插件管理页面
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { getProjectPluginList, getProjectPluginDetail, Project, Plugin, ProjectDetail } from '../../../services/agent/project';
import toast from '../../../components/Toast';
import PluginDrawer from './components/PluginDrawer';
import './index.css';

// 项目卡片渐变色
const gradients = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
];

const AgentProject = () => {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  
  // 抽屉状态
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [pluginLoading, setPluginLoading] = useState(false);
  const [pluginDetail, setPluginDetail] = useState<ProjectDetail | null>(null);

  // 获取项目列表
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getProjectPluginList();
      if (res.code === 200) {
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.list || [];
        setProjects(list);
      }
    } catch { toast.error('获取项目列表失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // 查看插件
  const handleViewPlugins = async (project: Project) => {
    setCurrentProject(project);
    setDrawerVisible(true);
    setPluginLoading(true);
    try {
      const res = await getProjectPluginDetail(project.project);
      if (res.code === 200 && res.data) {
        setPluginDetail(res.data as ProjectDetail);
      }
    } catch { toast.error('获取插件详情失败'); }
    finally { setPluginLoading(false); }
  };

  // 刷新插件列表
  const handleRefreshPlugins = () => {
    if (currentProject) handleViewPlugins(currentProject);
  };

  return (
    <div className="agent-project-page">
      <div className="page-card">
        <div className="card-header">
          <div className="header-info">
            <span className="title">项目插件管理</span>
            <span className="subtitle">点击项目卡片查看已安装的插件详情</span>
          </div>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="loading-state"><Loader2 size={24} className="spin" /> 加载中...</div>
          ) : projects.length === 0 ? (
            <div className="empty-state">暂无项目</div>
          ) : (
            <div className="project-grid">
              {projects.map((project, index) => (
                <div
                  key={project.project}
                  className="project-card"
                  style={{ background: gradients[index % gradients.length] }}
                  onClick={() => handleViewPlugins(project)}
                >
                  <div className="project-name">{project.project_name || project.project}</div>
                  <div className="project-code">{project.project}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <PluginDrawer
        visible={drawerVisible}
        project={currentProject}
        detail={pluginDetail}
        loading={pluginLoading}
        onClose={() => setDrawerVisible(false)}
        onRefresh={handleRefreshPlugins}
      />
    </div>
  );
};

export default AgentProject;
