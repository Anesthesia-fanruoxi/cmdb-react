/**
 * 同步监控 — 项目列表
 * 打开页面默认使用 ysh
 */

import { useCallback, useState } from 'react';
import { getSqlSyncProjects, type SyncProject } from '@/services/sql/sync';
import { toast } from '@/components/AppNotification';

const DEFAULT_PROJECT = 'ysh';

export function useSyncProjects() {
  const [projectList, setProjectList] = useState<SyncProject[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  // 一进页就用 ysh，SSE 不必等 projects 接口返回
  const [currentProject, setCurrentProject] = useState(DEFAULT_PROJECT);

  const fetchProjects = useCallback(async (): Promise<string | null> => {
    setProjectLoading(true);
    try {
      const res = await getSqlSyncProjects();
      const list = res.data || [];
      setProjectList(list);
      if (list.length === 0) {
        toast.warning('暂无可用项目');
        return DEFAULT_PROJECT;
      }
      const ysh = list.find(
        (p) =>
          p.value === DEFAULT_PROJECT ||
          p.project === DEFAULT_PROJECT ||
          p.project_name === DEFAULT_PROJECT ||
          p.label === DEFAULT_PROJECT,
      );
      const preferred = ysh?.value || list[0].value;
      setCurrentProject((prev) => {
        if (prev && list.some((p) => p.value === prev)) return prev;
        return preferred;
      });
      return preferred;
    } catch (e) {
      console.error('获取同步项目失败:', e);
      toast.error('获取项目列表失败');
      return DEFAULT_PROJECT;
    } finally {
      setProjectLoading(false);
    }
  }, []);

  return {
    projectList,
    projectLoading,
    currentProject,
    setCurrentProject,
    fetchProjects,
  };
}
