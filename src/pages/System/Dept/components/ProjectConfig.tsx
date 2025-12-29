/**
 * 部门项目配置组件（可独立窗口使用）
 */

import { useState, useEffect } from 'react';
import { getDeptProject, updateDeptProject } from '../../../../services/system/dept';
import { apiClient } from '../../../../services/request';
import { closeCurrentWindow } from '../../../../utils/window';
import type { ApiResponse } from '../../../../types/api';
import './ProjectConfig.css';

interface DictItem {
  key: string;
  value: string;
}

interface DictDetail {
  items: DictItem[];
}

interface Props {
  deptId: string;
  deptName: string;
  onClose?: () => void;
  onSave?: () => void;
}

function getDictDetail(targetTable: string): Promise<ApiResponse<DictDetail>> {
  return apiClient.get<DictDetail>('/system/dict/detail', { target_table: targetTable });
}

const ProjectConfig = ({ deptId, deptName, onClose, onSave }: Props) => {
  const [loading, setLoading] = useState(true);
  const [projectOptions, setProjectOptions] = useState<DictItem[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [dictRes, deptProjectRes] = await Promise.all([
          getDictDetail('sys_project_dict'),
          getDeptProject(deptId)
        ]);
        if (dictRes.code === 200 && dictRes.data?.items) {
          setProjectOptions(dictRes.data.items.map(item => ({
            key: item.key,
            value: item.value
          })));
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
