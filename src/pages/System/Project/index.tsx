/**
 * 项目管理页面
 */

import { useState, useEffect, useCallback } from 'react';
import { getProjectList, deleteProject, quickUpdateProject, type Project } from '../../../services/system/project';
import { confirm } from '../../../components/ConfirmModal';
import ProjectForm from './components/ProjectForm';
import './style.css';

const ProjectManagement = () => {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [formVisible, setFormVisible] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  // 获取项目列表
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getProjectList();
      if (res.code === 200 && res.data) {
        const data = res.data as { items?: Project[]; list?: Project[] };
        setProjects(data.items || data.list || []);
      }
    } catch (error) {
      console.error('获取项目列表失败:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // 新增
  const handleAdd = () => {
    setCurrentProject(null);
    setFormVisible(true);
  };

  // 编辑
  const handleEdit = (row: Project) => {
    setCurrentProject(row);
    setFormVisible(true);
  };

  // 删除
  const handleDelete = async (row: Project) => {
    if (!await confirm({ content: `确定要删除项目 "${row.project_name}" 吗？`, type: 'danger' })) return;
    // 乐观更新：先从列表移除
    setProjects(prev => prev.filter(p => p.project !== row.project));
    try {
      const res = await deleteProject(row.project);
      if (res.code !== 200) {
        // 失败则恢复
        fetchProjects();
      }
    } catch (error) {
      console.error('删除项目失败:', error);
      fetchProjects();
    }
  };

  // 快速更新字段（乐观更新）
  const handleQuickUpdate = async (project: string, field: string, value: unknown) => {
    // 乐观更新：先更新本地状态
    setProjects(prev => prev.map(p => 
      p.project === project ? { ...p, [field]: value } : p
    ));
    try {
      await quickUpdateProject(project, field, value);
    } catch (error) {
      console.error('更新失败:', error);
      fetchProjects(); // 失败则重新获取
    }
  };

  // 表单提交成功后更新本地数据
  const handleFormSuccess = (updatedData: Partial<Project>, isEdit: boolean) => {
    setFormVisible(false);
    if (isEdit) {
      // 编辑：更新本地数据
      setProjects(prev => prev.map(p => 
        p.project === updatedData.project ? { ...p, ...updatedData } : p
      ));
    } else {
      // 新增：重新获取列表
      fetchProjects();
    }
  };

  // 格式化飞书地址（用于表格显示）
  const formatFeishuUrl = (url?: string) => {
    if (!url) return '-';
    const match = url.match(/hook\/([a-zA-Z0-9-]+)/);
    return match ? match[1].substring(0, 16) + '...' : url.substring(0, 20) + '...';
  };
  void formatFeishuUrl; // 暂时保留，后续可用于显示飞书地址

  // 格式化时间
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  return (
    <div className="project-management">
      <div className="page-header">
        <h3>项目管理</h3>
        <div className="header-actions">
          <button className="btn btn-default" onClick={fetchProjects}>↻ 刷新</button>
          <button className="btn btn-primary" onClick={handleAdd}>+ 新增项目</button>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Logo</th>
                <th>项目简称</th>
                <th>项目名称</th>
                <th>Agent地址</th>
                <th>链路追踪</th>
                <th>前端工具</th>
                <th>后端工具</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr><td colSpan={9} className="empty-cell">暂无数据</td></tr>
              ) : (
                projects.map((row) => (
                  <tr key={row.project}>
                    <td>
                      {row.logo ? (
                        <img src={row.logo} alt={row.project_name} className="project-logo" />
                      ) : (
                        <span className="logo-placeholder">{row.project?.charAt(0).toUpperCase()}</span>
                      )}
                    </td>
                    <td>{row.project}</td>
                    <td>{row.project_name || '-'}</td>
                    <td className="url-cell" title={row.agent_url}>{row.agent_url || '-'}</td>
                    <td>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={row.enable_skywalking || false}
                          onChange={(e) => handleQuickUpdate(row.project, 'enable_skywalking', e.target.checked)}
                        />
                        <span className="slider"></span>
                      </label>
                    </td>
                    <td>
                      <select
                        className="inline-select"
                        value={row.frontend_tool || ''}
                        onChange={(e) => handleQuickUpdate(row.project, 'frontend_tool', e.target.value)}
                      >
                        <option value="">请选择</option>
                        <option value="node14">node14</option>
                        <option value="node16">node16</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className="inline-select"
                        value={row.backend_tool || ''}
                        onChange={(e) => handleQuickUpdate(row.project, 'backend_tool', e.target.value)}
                      >
                        <option value="">请选择</option>
                        <option value="java8">java8</option>
                        <option value="java17">java17</option>
                        <option value="java21">java21</option>
                      </select>
                    </td>
                    <td>{formatDateTime(row.created_at)}</td>
                    <td className="action-cell">
                      <button className="btn-link" onClick={() => handleEdit(row)}>编辑</button>
                      <button className="btn-link btn-danger" onClick={() => handleDelete(row)}>删除</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <ProjectForm
        visible={formVisible}
        data={currentProject}
        onClose={() => setFormVisible(false)}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
};

export default ProjectManagement;
