/**
 * 项目选择器组件
 */

import { useEffect, useState, useCallback } from 'react';
import { getMetricsProjects, getAlertProjects } from '../../../services/monitor';
import type { ProjectOption } from '../../../services/monitor';
import toast from '../../../components/Toast';
import './ProjectSelector.css';

interface ProjectSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  storageKey?: string;
  apiType?: 'metrics' | 'alert';
}

const ProjectSelector = ({
  value,
  onChange,
  disabled = false,
  storageKey = 'monitor_default_project',
  apiType = 'metrics',
}: ProjectSelectorProps) => {
  const [options, setOptions] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [defaultKey, setDefaultKey] = useState<string>('');

  // 获取项目列表
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const api = apiType === 'alert' ? getAlertProjects : getMetricsProjects;
      const res = await api();
      
      if (res.code === 200 && res.data) {
        const items = Array.isArray(res.data) ? res.data : [];
        const projectList = items.map((item: any) => ({
          key: item.project || item.key,
          value: item.project_name || item.value,
        }));
        setOptions(projectList);
        
        // 读取默认项目
        const savedKey = localStorage.getItem(storageKey) || '';
        setDefaultKey(savedKey);
        
        // 自动选择默认项目
        if (projectList.length > 0 && !value) {
          const defaultProject = savedKey 
            ? projectList.find(p => p.key === savedKey) || projectList[0]
            : projectList[0];
          onChange(defaultProject.key);
        }
      }
    } catch {
      toast.error('获取项目列表失败');
    } finally {
      setLoading(false);
    }
  }, [apiType, value, onChange, storageKey]);

  // 初始化时加载项目列表
  useEffect(() => {
    fetchProjects();
  }, []);

  // 设为默认项目
  const setAsDefault = () => {
    if (!value) return;
    localStorage.setItem(storageKey, value);
    setDefaultKey(value);
    const projectName = options.find(o => o.key === value)?.value || value;
    toast.success(`已将"${projectName}"设置为默认项目`);
  };

  const isDefault = value && defaultKey === value;

  return (
    <div className="project-selector">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled || loading}
        className="project-select"
      >
        {loading ? (
          <option value="">加载中...</option>
        ) : options.length === 0 ? (
          <option value="">暂无项目</option>
        ) : (
          <>
            <option value="">请选择项目</option>
            {options.map(opt => (
              <option key={opt.key} value={opt.key}>
                {opt.value}{opt.key === defaultKey ? ' (默认)' : ''}
              </option>
            ))}
          </>
        )}
      </select>
      
      <button
        className={`default-btn ${isDefault ? 'active' : ''}`}
        onClick={setAsDefault}
        disabled={!value}
        title={isDefault ? '当前项目已设为默认' : '设为默认项目'}
      >
        {isDefault ? '⭐' : '☆'}
      </button>
    </div>
  );
};

export default ProjectSelector;
