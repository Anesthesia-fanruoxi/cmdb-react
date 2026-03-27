/**
 * BI 查询项目管理 Hook
 */

import { useState } from 'react';
import { getDatabiProjects } from '@/services/sql/databi';
import { type Project } from '@/services/sql/search';
import { toast } from '@/components/AppNotification';

export const useDatabiProjects = () => {
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [currentProject, setCurrentProject] = useState('');

  // 获取项目列表
  const fetchProjects = async () => {
    setProjectLoading(true);
    try {
      const res = await getDatabiProjects();
      
      if (res.code === 200 && res.data) {
        let items: any[] = [];
        
        // 处理不同的响应格式
        if (Array.isArray(res.data)) {
          items = res.data;
        } else if (res.data.items) {
          items = res.data.items;
        } else if (res.data.list) {
          items = res.data.list;
        } else if (res.data.projects) {
          items = res.data.projects;
        }
        
        // 转换为标准的项目格式
        const projectList = items.map(item => {
          if (typeof item === 'string') {
            return {
              label: item,
              value: item,
              project: item,
              project_name: item
            };
          }
          
          const project = {
            label: item.project_name || item.label || item.name || item.value || item.project || '',
            value: item.project || item.value || item.key || item.name || '',
            project: item.project || item.value || item.key || item.name || '',
            project_name: item.project_name || item.label || item.name || item.value || item.project || ''
          };
          
          return project;
        });
        
        setProjectList(projectList);
        
        if (projectList.length === 0) {
          toast.warning('暂无可用项目');
        } else {
          // 默认选中 dwd 或第一个项目
          if (!currentProject) {
            const dwdProject = projectList.find(p => p.value === 'dwd');
            const defaultProject = dwdProject || projectList[0];
            setCurrentProject(defaultProject.value);
            return defaultProject.value;
          }
        }
      } else {
        toast.error(res.message || '获取项目列表失败');
      }
    } catch (error) {
      console.error('获取项目列表错误:', error);
      toast.error('获取项目列表失败');
    } finally {
      setProjectLoading(false);
    }
    return null;
  };

  return {
    projectList,
    projectLoading,
    currentProject,
    setCurrentProject,
    fetchProjects
  };
};
