/**
 * 域名解析管理 Hook
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getDomainMapProjects,
  getDomainMapOptions,
  getDomainMapList,
  addDomainMap,
  deleteDomainMap,
  type DomainMapProject,
  type DomainOption,
  type DomainMapFile,
  type ReloadResult,
  type AddDomainMapResult,
  type DeleteDomainMapResult,
} from '../../../services/assets/domainMap';
import toast from '../../../components/Toast';
import { confirm } from '../../../components/ConfirmModal';

export const useDomainMap = () => {
  const [projects, setProjects] = useState<DomainMapProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<DomainMapProject | null>(null);
  const [domains, setDomains] = useState<DomainOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<DomainMapFile[]>([]);

  const [reloadVisible, setReloadVisible] = useState(false);
  const [reloadTitle, setReloadTitle] = useState('');
  const [reloadResults, setReloadResults] = useState<ReloadResult[]>([]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await getDomainMapProjects();
      if (res.code === 200 && Array.isArray(res.data)) {
        setProjects(res.data);
      }
    } catch (e) {
      console.error('获取项目列表失败:', e);
    }
  }, []);

  const fetchOptions = useCallback(async (project: string) => {
    if (!project) return;
    try {
      const res = await getDomainMapOptions(project);
      if (res.code === 200 && res.data) {
        setDomains(res.data.domains || []);
      } else {
        setDomains([]);
      }
    } catch (e) {
      console.error('获取主域名列表失败:', e);
      setDomains([]);
    }
  }, []);

  const fetchList = useCallback(async (project: string) => {
    if (!project) return;
    setLoading(true);
    try {
      const res = await getDomainMapList(project);
      setFiles(res.code === 200 && res.data ? (res.data.files || []) : []);
    } catch (e) {
      console.error('获取配置列表失败:', e);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const showReloadResults = (title: string, results: ReloadResult[]) => {
    if (results?.length > 0) {
      setReloadTitle(title);
      setReloadResults(results);
      setReloadVisible(true);
    }
  };

  const handleSelectProject = useCallback(async (project: DomainMapProject) => {
    setSelectedProject(project);
    await fetchOptions(project.project);
    await fetchList(project.project);
  }, [fetchOptions, fetchList]);

  const handleAdd = async (subDomain: string, domain: string) => {
    if (!selectedProject) { toast.warning('请先选择项目'); return; }

    const fullDomain = `${subDomain}.${domain}`;
    const confirmed = await confirm({
      content: `确认添加域名解析 ${fullDomain}？\n\n将执行以下操作：\n1. 添加阿里云 DNS 记录\n2. 生成 nginx 配置文件\n3. SSH 远程 reload nginx`,
      type: 'info',
    });
    if (!confirmed) return;

    try {
      const res = await addDomainMap({ project: selectedProject.project, sub_domain: subDomain, domain });
      if (res.code === 200 && res.data) {
        const data = res.data as AddDomainMapResult;
        toast.success(`添加成功: ${data.server_name}`);
        fetchList(selectedProject.project);
        showReloadResults(`添加成功: ${data.server_name}`, data.reload_results);
      } else {
        toast.error(res.message || '添加失败');
      }
    } catch (e) {
      toast.error('添加失败');
      console.error(e);
    }
  };

  const handleDelete = async (serverName: string) => {
    if (!selectedProject) return;
    if (!await confirm({ content: `确定删除域名解析 ${serverName}？将同时移除阿里云 DNS、nginx 配置并 reload`, type: 'danger' })) return;
    try {
      const res = await deleteDomainMap(selectedProject.project, serverName);
      if (res.code === 200 && res.data) {
        const data = res.data as DeleteDomainMapResult;
        toast.success(`已删除: ${data.server_name}`);
        fetchList(selectedProject.project);
        showReloadResults(`删除成功: ${data.server_name}`, data.reload_results);
      } else {
        toast.error(res.message || '删除失败');
      }
    } catch (e) {
      toast.error('删除失败');
      console.error(e);
    }
  };

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  return {
    projects, selectedProject, setSelectedProject,
    domains,
    loading, files,
    reloadVisible, setReloadVisible, reloadTitle, reloadResults,
    handleSelectProject, handleAdd, handleDelete, fetchList,
  };
};
