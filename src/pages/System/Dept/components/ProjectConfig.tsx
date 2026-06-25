/**
 * 部门项目配置组件（可独立窗口使用）
 */

import { useState, useEffect } from 'react';
import { getDeptProject, updateDeptProject, getDeptProjects } from '../../../../services/system/dept';
import { closeCurrentWindow } from '../../../../utils/window';
import './ProjectConfig.css';

interface Props {
  deptId: string;
  deptName: string;
  onClose?: () => void;
  onSave?: () => void;
}

const ProjectConfig = ({ deptId, deptName, onClose, onSave }: Props) => {
  const [loading, setLoading] = useState(true);
  const [projectOptions, setProjectOptions] = useState<{ key: string; value: string }[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [projectsRes, deptProjectRes] = await Promise.all([
          getDeptProjects(),
          getDeptProject(deptId)
        ]);
        if (projectsRes.code === 200 && projectsRes.data) {
          const items: any[] = Array.isArray(projectsRes.data) ? projectsRes.data : (projectsRes.data as any).items || [];
          setProjectOptions(items.map(item => ({ key: item.project || item.key || '', value: item.project_name || item.value || '' })));
        }
        if (deptProjectRes.code === 200 && deptProjectRes.data) {
          const projects = deptProjectRes.data.project;
          setSelectedProjects(Array.isArray(projects) ? projects : []);
        }
      } catch (error) {
        console.error('获取项目配置失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [deptId]);

  const handleBind = (key: string) => setSelectedProjects(prev => [...prev, key]);
  const handleUnbind = (key: string) => setSelectedProjects(prev => prev.filter(k => k !== key));

  const boundProjects = projectOptions.filter(p => selectedProjects.includes(p.key));
  const unboundProjects = projectOptions.filter(p => !selectedProjects.includes(p.key));

  const handleSubmit = async () => {
    try {
      await updateDeptProject({ dept_id: deptId, project: [...selectedProjects] });
      onSave?.();
      if (onClose) onClose();
      else closeCurrentWindow();
    } catch (error) {
      console.error('更新项目配置失败:', error);
    }
  };

  return (
    <div className="project-config-container">
      <div className="config-header">
        <h4>{deptName} - 项目配置</h4>
        {onClose ? <button className="close-btn" onClick={onClose}>×</button> : <button className="close-btn" onClick={closeCurrentWindow}>×</button>}
      </div>
      {loading ? (
        <div className="config-loading">加载中...</div>
      ) : (
        <div className="config-body">
          <div className="config-section">
            <div className="section-title">已绑定项目 ({boundProjects.length})</div>
            <div className="project-list">
              {boundProjects.length === 0 ? (
                <div className="empty-tip">暂无绑定项目</div>
              ) : boundProjects.map(p => (
                <div key={p.key} className="project-tag bound">
                  <span>{p.value}</span>
                  <button className="tag-remove" onClick={() => handleUnbind(p.key)}>×</button>
                </div>
              ))}
            </div>
          </div>
          <div className="config-section">
            <div className="section-title">未绑定项目 ({unboundProjects.length})</div>
            <div className="project-list">
              {unboundProjects.length === 0 ? (
                <div className="empty-tip">所有项目已绑定</div>
              ) : unboundProjects.map(p => (
                <div key={p.key} className="project-tag unbound" onClick={() => handleBind(p.key)}>
                  <span>{p.value}</span>
                  <span className="tag-add">+</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="config-footer">
        <button className="btn btn-default" onClick={onClose || closeCurrentWindow}>取消</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>确定</button>
      </div>
    </div>
  );
};

export default ProjectConfig;
