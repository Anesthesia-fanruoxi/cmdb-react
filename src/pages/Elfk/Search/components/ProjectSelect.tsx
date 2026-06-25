/**
 * 项目选择面板 - 两步选择：先项目后分类
 */

import { useState, useEffect } from 'react';
import { getElfkSearchProjects } from '../../../../services/elfk/search';
import { getDictDetail } from '../../../../services/system/dict';

interface ProjectInfo {
  project: string;
  projectName: string;
  category: string;
  categoryName: string;
}

interface ProjectSelectProps {
  onConfirm: (info: ProjectInfo) => void;
}

interface Option {
  key: string;
  value: string;
}

interface ProjectItem {
  project: string;
  project_name: string;
}

const ProjectSelect = ({ onConfirm }: ProjectSelectProps) => {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projectRes, categoryRes] = await Promise.all([
        getElfkSearchProjects(),
        getDictDetail('view')
      ]);

      if (projectRes.code === 200 && projectRes.data) {
        setProjects(projectRes.data);
      }

      if (categoryRes.code === 200 && categoryRes.data) {
        setCategories(categoryRes.data.items || []);
      }
    } catch (err) {
      console.error('获取数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 选择项目
  const handleProjectClick = (project: ProjectItem) => {
    setSelectedProject(project);
  };

  // 选择分类 - 直接进入
  const handleCategoryClick = (category: Option) => {
    if (!selectedProject) return;
    onConfirm({
      project: selectedProject.project,
      projectName: selectedProject.project_name,
      category: category.key,
      categoryName: category.value
    });
  };

  if (loading) {
    return (
      <div className="project-select-panel">
        <div className="loading-state">加载中...</div>
      </div>
    );
  }

  return (
    <div className="project-select-panel">
      <div className="select-container">
        <div className="select-header">
          <h3>选择项目和分类</h3>
          <p>请先选择要查询日志的项目及分类</p>
        </div>

        {/* 业务项目 */}
        <div className="project-group">
          <div className="group-title">
            <span className="group-icon">📁</span>
            <span>业务项目</span>
          </div>
          <div className="card-grid">
            {projects.map(item => (
              <div
                key={item.project}
                className={`select-card ${selectedProject?.project === item.project ? 'active' : ''}`}
                onClick={() => handleProjectClick(item)}
              >
                <div className="card-icon">📦</div>
                <div className="card-name">{item.project_name}</div>
                <div className="card-key">{item.project}</div>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="empty-tip">暂无项目</div>
            )}
          </div>
        </div>

        {/* 运维分类 - 未选择项目时置灰 */}
        <div className={`project-group ${!selectedProject ? 'disabled' : ''}`}>
          <div className="group-title">
            <span className="group-icon">🏷️</span>
            <span>运维分类</span>
            {!selectedProject && <span className="group-tip">请先选择项目</span>}
          </div>
          <div className="card-grid">
            {categories.map(cat => (
              <div
                key={cat.key}
                className={`select-card category-card ${!selectedProject ? 'disabled' : ''}`}
                onClick={() => handleCategoryClick(cat)}
              >
                <div className="card-icon">📂</div>
                <div className="card-name">{cat.value}</div>
                <div className="card-key">{cat.key}</div>
              </div>
            ))}
            {categories.length === 0 && (
              <div className="empty-tip">暂无分类</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectSelect;
