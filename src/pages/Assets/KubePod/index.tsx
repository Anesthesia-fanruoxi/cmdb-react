/**
 * K8s Pod 管理页面
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, Server, Copy } from 'lucide-react';
import { getKubePodProjects, getK8sList, operatePod } from '../../../services/assets/kubePod';
import type { PodProject, PodStatus } from '../../../services/assets/kubePod';
import toast from '../../../components/Toast';
import { confirm } from '../../../components/ConfirmModal';
import './index.css';

const KubePodPage = () => {
  const [loading, setLoading] = useState(false);
  const [projectList, setProjectList] = useState<PodProject[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [tableData, setTableData] = useState<PodStatus[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // 统计
  const statistics = useMemo(() => {
    const total = tableData.length;
    const running = tableData.filter(d => d.status === 'running').length;
    const stopped = tableData.filter(d => d.status === 'stopped').length;
    return { total, running, stopped };
  }, [tableData]);

  // 过滤并排序后的数据（运行中优先，其次按 namespace 排序）
  const filteredData = useMemo(() => {
    let data = statusFilter ? tableData.filter(d => d.status === statusFilter) : tableData;
    return [...data].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'running' ? -1 : 1;
      }
      return a.namespace.localeCompare(b.namespace);
    });
  }, [tableData, statusFilter]);

  useEffect(() => { fetchProjects(); fetchList(); }, []);

  const fetchProjects = async () => {
    try {
      const res = await getKubePodProjects();
      if (res.code === 200 && res.data) {
        const items = res.data.items || res.data || [];
        setProjectList(Array.isArray(items) ? items : []);
      }
    } catch (err) {
      console.error('获取项目列表失败:', err);
    }
  };

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = selectedProject ? { project: selectedProject } : { project: '*' };
      const res = await getK8sList(params);
      if (res.code === 200 && res.data) {
        // API 返回结构: { result: [...], active_count, inactive_count, count }
        const result = res.data.result || [];
        setTableData(result.map((item: any) => ({
          project: item.project,
          project_name: item.project_name || item.project,
          namespace: item.namespace,
          service_name: item.namespace, // 使用 namespace 作为服务名
          domain: item.domain,
          replicas: item.is_active ? 1 : 0,
          ready_replicas: item.is_active ? 1 : 0,
          available_replicas: item.is_active ? 1 : 0,
          status: item.is_active ? 'running' : 'stopped',
          last_update: ''
        })));
      }
    } catch (err) {
      console.error('获取服务列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleOperate = async (row: PodStatus, action: 'start' | 'stop') => {
    const key = `${row.namespace}`;
    const replicas = action === 'start' ? 1 : 0;
    const actionText = action === 'start' ? '启动' : '停止';
    
    if (!await confirm({ content: `确定要${actionText}服务 ${row.namespace} 吗？`, type: 'warning' })) return;
    
    setActionLoading(prev => ({ ...prev, [key]: true }));
    try {
      const res = await operatePod({
        project: row.project,
        namespace: row.namespace,
        service_name: row.namespace,
        replicas
      });
      if (res.code === 200) {
        toast.success(`${actionText}任务已提交`);
        setTimeout(fetchList, 2000);
      } else {
        toast.error(res.message || `${actionText}失败`);
      }
    } catch (err) {
      toast.error(`${actionText}失败`);
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="kube-pod-page">
      <div className="page-card">
        <div className="card-header">
          <div className="title-section"><Server size={20} /><h2>K8s服务管理中心</h2></div>
          <div className="header-actions">
            <button className="btn-primary" onClick={fetchList} disabled={loading}><RefreshCw size={14} /> 刷新列表</button>
          </div>
        </div>

        <div className="filter-section">
          <div className="project-filter">
            <span className="filter-label">项目筛选：</span>
            <div className="project-radios">
              <label className={`radio-item ${selectedProject === '' ? 'active' : ''}`}>
                <input type="radio" name="project" checked={selectedProject === ''} onChange={() => setSelectedProject('')} />
                全部项目
              </label>
              {projectList.map(p => (
                <label key={p.project} className={`radio-item ${selectedProject === p.project ? 'active' : ''}`}>
                  <input type="radio" name="project" checked={selectedProject === p.project} onChange={() => setSelectedProject(p.project)} />
                  {p.project_name}
                </label>
              ))}
            </div>
          </div>

          <div className="stats-cards">
            <div className={`stat-card ${statusFilter === '' ? 'active' : ''}`} onClick={() => setStatusFilter('')}>
              <span className="stat-value">{statistics.total}</span>
              <span className="stat-label">全部</span>
            </div>
            <div className={`stat-card success ${statusFilter === 'running' ? 'active' : ''}`} onClick={() => setStatusFilter('running')}>
              <span className="stat-value">{statistics.running}</span>
              <span className="stat-label">运行中</span>
            </div>
            <div className={`stat-card ${statusFilter === 'stopped' ? 'active' : ''}`} onClick={() => setStatusFilter('stopped')}>
              <span className="stat-value">{statistics.stopped}</span>
              <span className="stat-label">已停止</span>
            </div>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>项目名称</th><th>命名空间</th><th>域名地址</th><th>运行状态</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={4} className="loading-cell">加载中...</td></tr> :
               filteredData.length === 0 ? <tr><td colSpan={4} className="empty-cell">暂无数据</td></tr> :
               filteredData.map(row => {
                 const key = `${row.namespace}`;
                 const isLoading = actionLoading[key];
                 return (
                  <tr key={key}>
                    <td>{row.project_name}</td>
                    <td><span className="namespace-tag">{row.namespace}</span></td>
                    <td>
                      {row.domain ? (
                        <div className="domain-cell">
                          <a href={`https://${row.domain}`} target="_blank" rel="noopener noreferrer" className="domain-link">
                            {row.domain}
                          </a>
                          <button
                            className="copy-btn"
                            onClick={() => {
                              navigator.clipboard.writeText(`https://${row.domain}`);
                              toast.success('已复制到剪贴板');
                            }}
                            title="复制地址"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="action-cell">
                      <label className={`status-switch ${row.status === 'running' ? 'active' : ''} ${isLoading ? 'loading' : ''}`}>
                        <input
                          type="checkbox"
                          checked={row.status === 'running'}
                          disabled={isLoading}
                          onChange={() => handleOperate(row, row.status === 'running' ? 'stop' : 'start')}
                        />
                        <span className="switch-slider"></span>
                        <span className="switch-text">{isLoading ? '执行中' : (row.status === 'running' ? '运行中' : '已停止')}</span>
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default KubePodPage;
