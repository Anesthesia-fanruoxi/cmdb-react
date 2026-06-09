/**
 * K8s 服务管理页面
 */

import { useState, useEffect, useMemo } from 'react';
import { getKubeProjects, getNamespaceList, getServiceList } from '../../../services/assets/kubeService';
import type { KubeProject, KubeService } from '../../../services/assets/kubeService';
import toast from '../../../components/Toast';
import './index.css';

// 中间件配置
const middlewareConfig: Record<string, { username: string; password: string; urlPath?: string }> = {
  'mysql': { username: 'root', password: 'SgQHvsy9M7LWKBCz' },
  'mongodb-np': { username: 'admin', password: '123456' },
  'mongo': { username: 'admin', password: '123456' },
  'redis': { username: '-', password: '123456' },
  'rabbitmq-server': { username: 'root', password: '123456', urlPath: '' },
  'nacos': { username: 'nacos', password: 'nacos', urlPath: '/nacos' },
  'kafka-ui': { username: 'admin', password: '123456', urlPath: '' },
  'powerjob': { username: 'ADMIN', password: 'powerjob_admin', urlPath: '' },
  'xxljob': { username: 'admin', password: '123456', urlPath: '/xxl-job-admin' }
};

const KubeServicePage = () => {
  const [loading, setLoading] = useState(false);
  const [projectList, setProjectList] = useState<KubeProject[]>([]);
  const [namespaceList, setNamespaceList] = useState<string[]>([]);
  const [serviceList, setServiceList] = useState<KubeService[]>([]);
  
  const [project, setProject] = useState('');
  const [type, setType] = useState<'service' | 'middleware'>('service');
  const [namespace, setNamespace] = useState('');
  const [nsSearch, setNsSearch] = useState('');

  const filteredNsList = useMemo(() => {
    if (!nsSearch) return namespaceList;
    return namespaceList.filter(ns => ns.toLowerCase().includes(nsSearch.toLowerCase()));
  }, [namespaceList, nsSearch]);

  // 项目包含crm时不需要选择类型
  const isCrm = useMemo(() => project.toLowerCase().includes('crm'), [project]);

  useEffect(() => { fetchProjects(); }, []);

  useEffect(() => {
    if (project && (isCrm || type)) fetchNamespaces();
    else { setNamespaceList([]); setNamespace(''); }
  }, [project, type, isCrm]);

  useEffect(() => {
    if (namespace) fetchServices();
    else setServiceList([]);
  }, [namespace]);

  const fetchProjects = async () => {
    try {
      const res = await getKubeProjects();
      if (res.code === 200 && Array.isArray(res.data)) {
        setProjectList(res.data);
      }
    } catch (err) {
      console.error('获取项目列表失败:', err);
    }
  };

  const fetchNamespaces = async () => {
    try {
      const params = isCrm ? { project } : { project, type };
      const res = await getNamespaceList(params);
      if (res.code === 200 && Array.isArray(res.data)) {
        setNamespaceList(res.data);
        setNamespace('');
      }
    } catch (err) {
      console.error('获取命名空间失败:', err);
    }
  };

  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await getServiceList({ namespace });
      if (res.code === 200 && res.data?.services) {
        setServiceList(res.data.services);
      }
    } catch (err) {
      console.error('获取服务列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyWithIP = (port: number) => {
    const text = `192.168.3.10:${port}`;
    navigator.clipboard.writeText(text).then(() => toast.success(`已复制 ${text}`)).catch(() => toast.error('复制失败'));
  };

  const copyText = (text: string) => {
    if (!text || text === '-') return;
    navigator.clipboard.writeText(text).then(() => toast.success(`已复制 ${text}`)).catch(() => toast.error('复制失败'));
  };

  const getAccessUrl = (name: string, nodePort?: number) => {
    if (!nodePort) return '-';
    const config = middlewareConfig[name];
    if (!config || config.urlPath === undefined) return '-';
    return `http://192.168.3.10:${nodePort}${config.urlPath || ''}`;
  };

  // 格式化服务数据
  const formattedServices = useMemo(() => {
    return serviceList.map(svc => {
      const debugPort = svc.ports.find(p => p.name === 'debug');
      // CRM 项目定制：服务端口的 name 与服务同名（如 'crm-dev'）而非 'service'
      // 其他项目保持原逻辑，取 name === 'service' 的端口
      const servicePort = isCrm
        ? svc.ports.find(p => p.name === svc.name)
        : svc.ports.find(p => p.name === 'service');
      return {
        ...svc,
        debugPort: debugPort?.port || '-',
        debugNodePort: debugPort?.node_port,
        servicePort: servicePort?.port || '-',
        serviceNodePort: servicePort?.node_port
      };
    });
  }, [serviceList, isCrm]);

  return (
    <div className="kube-service-page">
      <div className="page-card">
        <div className="card-header"><span className="title">Kubernetes 服务列表</span></div>
        <div className="card-body">
          <div className="filter-section">
            {/* 项目选择 */}
            <div className="filter-row">
              <span className="filter-label">选择项目：</span>
              <div className="radio-group">
                {projectList.map(p => (
                  <button key={p.value} className={`radio-item ${project === p.value ? 'active' : ''}`} onClick={() => setProject(p.value)}>{p.label}</button>
                ))}
              </div>
            </div>

            {/* 类型选择（项目包含crm时隐藏） */}
            {!isCrm && (
              <div className="filter-row">
                <span className="filter-label">选择类型：</span>
                <div className="radio-group">
                  <button className={`radio-item ${type === 'service' ? 'active' : ''}`} onClick={() => setType('service')}>服务</button>
                  <button className={`radio-item ${type === 'middleware' ? 'active' : ''}`} onClick={() => setType('middleware')}>中间件</button>
                </div>
                {namespaceList.length > 0 && (
                  <input className="search-input" placeholder="搜索命名空间" value={nsSearch} onChange={e => setNsSearch(e.target.value)} />
                )}
              </div>
            )}
            {isCrm && namespaceList.length > 0 && (
              <div className="filter-row">
                <input className="search-input" placeholder="搜索命名空间" value={nsSearch} onChange={e => setNsSearch(e.target.value)} />
              </div>
            )}

            {/* 命名空间选择 */}
            {namespaceList.length > 0 && (
              <div className="filter-row">
                <span className="filter-label">命名空间：</span>
                <div className="radio-group">
                  {filteredNsList.map(ns => (
                    <button key={ns} className={`radio-item ${namespace === ns ? 'active' : ''}`} onClick={() => setNamespace(ns)}>{ns}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 服务表格（crm项目默认按服务展示） */}
          {namespace && (
            <div className="table-container">
              {(isCrm || type === 'service') ? (
                <table className="data-table">
                  <thead><tr><th>序号</th><th>命名空间</th><th>服务名称</th><th>容器debug端口</th><th>映射debug端口</th><th>容器服务端口</th><th>映射服务端口</th></tr></thead>
                  <tbody>
                    {loading ? <tr><td colSpan={7} className="loading-cell">加载中...</td></tr> :
                     formattedServices.length === 0 ? <tr><td colSpan={7} className="empty-cell">暂无数据</td></tr> :
                     formattedServices.map((svc, i) => (
                      <tr key={svc.name}>
                        <td>{i + 1}</td>
                        <td>{namespace}</td>
                        <td>{svc.name}</td>
                        <td>{svc.debugPort}</td>
                        <td>{svc.debugNodePort ? <span className="port-tag warning" onClick={() => copyWithIP(svc.debugNodePort!)} title={`双击复制: 192.168.3.10:${svc.debugNodePort}`}>{svc.debugNodePort}</span> : '-'}</td>
                        <td>{svc.servicePort}</td>
                        <td>{svc.serviceNodePort ? <span className="port-tag success" onClick={() => copyWithIP(svc.serviceNodePort!)} title={`双击复制: 192.168.3.10:${svc.serviceNodePort}`}>{svc.serviceNodePort}</span> : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="data-table">
                  <thead><tr><th>ID</th><th>命名空间</th><th>中间件名称</th><th>服务端口</th><th>映射端口</th><th>访问地址</th><th>用户名</th><th>密码</th></tr></thead>
                  <tbody>
                    {loading ? <tr><td colSpan={8} className="loading-cell">加载中...</td></tr> :
                     serviceList.length === 0 ? <tr><td colSpan={8} className="empty-cell">暂无数据</td></tr> :
                     serviceList.map((svc, i) => {
                       const config = middlewareConfig[svc.name] || { username: '-', password: '-' };
                       return (
                        <tr key={svc.name}>
                          <td>{i + 1}</td>
                          <td>{namespace}</td>
                          <td>{svc.name}</td>
                          <td>{svc.ports.map((p, j) => <div key={j} className="port-row">{p.port}</div>)}</td>
                          <td>{svc.ports.map((p, j) => <div key={j} className="port-row">{p.node_port ? <span className="port-tag success" onClick={() => copyWithIP(p.node_port!)}>{p.node_port}</span> : '-'}</div>)}</td>
                          <td>{svc.ports.map((p, j) => { const url = getAccessUrl(svc.name, p.node_port); return <div key={j} className="port-row">{url !== '-' ? <a className="access-link" href={url} target="_blank" rel="noreferrer">{url}</a> : '-'}</div>; })}</td>
                          <td><span className="copyable" onClick={() => copyText(config.username)} title={`双击复制: ${config.username}`}>{config.username}</span></td>
                          <td><span className="copyable" onClick={() => copyText(config.password)} title={`双击复制: ${config.password}`}>{config.password}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KubeServicePage;
