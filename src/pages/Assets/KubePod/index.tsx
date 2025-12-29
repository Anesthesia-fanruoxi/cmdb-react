/**
 * K8s Pod 管理页面
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, Server, Play, Square } from 'lucide-react';
import { getKubePodProjects, getK8sList, operatePod } from '../../../services/assets/kubePod';
import type { PodProject, PodStatus } from '../../../services/assets/kubePod';
import toast from '../../../components/Toast';
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
    const pending = tableData.filter(d => d.status === 'pending').length;
    return { total, running, stopped, pending };
  }, [tableData]);

  // 过滤后的数据
  const filteredData = useMemo(() => {
    if (!statusFilter) return tableData;
    return tableData.filter(d => d.status === statusFilter);
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
      const params = selectedProject ? { projects: [selectedProject] } : {};
      const res = await getK8sList(params);
      if (res.code === 200 && Array.isArray(res.data)) {
        setTableData(res.data);
      }
    } catch (err) {
      console.error('获取服务列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleOperate = async (row: PodStatus, action: 'start' | 'stop') => {
    const key = `${row.project}-${row.service_name}`;
    const replicas = action === 'start' ? 1 : 0;
    const actionText = action === 'start' ? '启动' : '停止';
    
    if (!confirm(`确定要${actionText}服务 ${row.service_name} 吗？`)) return;
    
    setActionLoading(prev => ({ ...prev, [key]: true }));
    try {
      const res = await operatePod({
        project: row.project,
        namespace: row.namespace,
        service_name: row.service_name,
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

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'running': return 'success';
      case 'stopped': return 'default';
      case 'pending': return 'warning';
      case 'error': return 'danger';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running': return '运行中';
      case 'stopped': return '已停止';
      case 'pending': return '启动中';
      case 'error': return '异常';
      default: return status;
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
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
              <option value="">全部项目</option>
              {projectList.map(p => <option key={p.project} value={p.project}>{p.project_name}</option>)}
            </select>
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
            <div className={`stat-card warning ${statusFilter === 'pending' ? 'active' : ''}`} onClick={() => setStatusFilter('pending')}>
              <span className="stat-value">{statistics.pending}</span>
              <span className="stat-label">启动中</span>
            </div>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>项目</th><th>命名空间</th><th>服务名称</th><th>副本数</th><th>就绪数</th><th>状态</th><th>更新时间</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="loading-cell">加载中...</td></tr> :
               filteredData.length === 0 ? <tr><td colSpan={8} className="empty-cell">暂无数据</td></tr> :
               filteredData.map(row => {
                 const key = `${row.project}-${row.service_name}`;
                 const isLoading = actionLoading[key];
                 return (
                  <tr key={key}>
                    <td>{row.project_name}</td>
                    <td>{row.namespace}</td>
                    <td>{row.service_name}</td>
                    <td>{row.replicas}</td>
                    <td>{row.ready_replicas}/{row.replicas}</td>
                    <td><span className={`status-tag ${getStatusClass(row.status)}`}>{getStatusText(row.status)}</span></td>
                    <td>{row.last_update}</td>
                    <td className="action-cell">
                      {row.status === 'stopped' ? (
                        <button className="btn-action success" onClick={() => handleOperate(row, 'start')} disabled={isLoading}>
                          <Play size={12} /> 启动
                        </button>
                      ) : row.status === 'running' ? (
                        <button className="btn-action danger" onClick={() => handleOperate(row, 'stop')} disabled={isLoading}>
                          <Square size={12} /> 停止
                        </button>
                      ) : (
                        <span className="action-disabled">操作中...</span>
                      )}
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
