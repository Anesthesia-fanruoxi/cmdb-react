/**
 * 域名解析管理页面
 * 一站式管理：阿里云 DNS + nginx 配置 + SSH reload
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { isTauriEnv } from '../../../services/machine';
import { Globe, Plus, RefreshCw, Eye, Trash2, ExternalLink } from 'lucide-react';
import {
  getDomainMapProjects,
  getDomainMapOptions,
  getDomainMapList,
  addDomainMap,
  previewDomainMap,
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
import './index.css';

// 测试访问路径（拼接到完整域名后）
const TEST_PATH = '/ystg/html/xinxiaorong1.html?channelSign=uW4CsYeFoTPYSHwAWE2FH61GuAUVfDu6GHAmjaJt7K';

const DomainMapPage = () => {
  // 项目 / 主域名下拉
  const [projects, setProjects] = useState<DomainMapProject[]>([]);
  const [project, setProject] = useState('');
  const [domains, setDomains] = useState<DomainOption[]>([]);
  const [domain, setDomain] = useState('');
  const [subDomain, setSubDomain] = useState('');

  // 列表
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<DomainMapFile[]>([]);

  // 操作 loading
  const [submitting, setSubmitting] = useState(false);

  // 预览弹框
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{ server_name: string; output_file: string; content: string } | null>(null);

  // reload 结果弹框
  const [reloadVisible, setReloadVisible] = useState(false);
  const [reloadTitle, setReloadTitle] = useState('');
  const [reloadResults, setReloadResults] = useState<ReloadResult[]>([]);

  const fullDomain = useMemo(
    () => (subDomain.trim() && domain ? `${subDomain.trim()}.${domain}` : ''),
    [subDomain, domain]
  );

  // 加载项目下拉
  const fetchProjects = useCallback(async () => {
    try {
      const res = await getDomainMapProjects();
      if (res.code === 200 && Array.isArray(res.data)) {
        setProjects(res.data);
        if (res.data.length > 0 && !project) setProject(res.data[0].project);
      }
    } catch (e) {
      console.error('获取项目列表失败:', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 加载主域名下拉
  const fetchOptions = useCallback(async (p: string) => {
    if (!p) return;
    try {
      const res = await getDomainMapOptions(p);
      if (res.code === 200 && res.data) {
        const list = res.data.domains || [];
        setDomains(list);
        setDomain(prev => (list.find(d => d.name === prev) ? prev : list[0]?.name || ''));
      }
    } catch (e) {
      console.error('获取主域名列表失败:', e);
    }
  }, []);

  // 加载已生成配置列表
  const fetchList = useCallback(async (p: string) => {
    if (!p) return;
    setLoading(true);
    try {
      const res = await getDomainMapList(p);
      if (res.code === 200 && res.data) {
        setFiles(res.data.files || []);
      } else {
        setFiles([]);
      }
    } catch (e) {
      console.error('获取配置列表失败:', e);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);
  useEffect(() => {
    if (!project) return;
    fetchOptions(project);
    fetchList(project);
  }, [project, fetchOptions, fetchList]);

  // 添加
  const handleAdd = async () => {
    if (!project) { toast.warning('请选择项目'); return; }
    if (!subDomain.trim()) { toast.warning('请输入子域名前缀'); return; }
    if (!domain) { toast.warning('请选择主域名'); return; }

    setSubmitting(true);
    try {
      const res = await addDomainMap({ project, sub_domain: subDomain.trim(), domain });
      if (res.code === 200 && res.data) {
        const data = res.data as AddDomainMapResult;
        toast.success(`添加成功: ${data.server_name}`);
        setSubDomain('');
        fetchList(project);
        // 展示 reload 结果
        if (data.reload_results && data.reload_results.length > 0) {
          setReloadTitle(`添加成功: ${data.server_name}`);
          setReloadResults(data.reload_results);
          setReloadVisible(true);
        }
      } else {
        toast.error(res.message || '添加失败');
      }
    } catch (e) {
      toast.error('添加失败');
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  // 预览
  const handlePreview = async (server_name: string) => {
    setPreviewLoading(true);
    setPreviewVisible(true);
    setPreviewData(null);
    try {
      const res = await previewDomainMap(project, server_name);
      if (res.code === 200 && res.data) {
        setPreviewData(res.data);
      } else {
        toast.error(res.message || '预览失败');
        setPreviewVisible(false);
      }
    } catch (e) {
      toast.error('预览失败');
      setPreviewVisible(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  // 测试访问：调用默认浏览器打开
  const handleTestVisit = async (server_name: string) => {
    const url = `https://${server_name}${TEST_PATH}`;
    try {
      if (isTauriEnv()) {
        await invoke('plugin:shell|open', { path: url });
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      console.error('打开默认浏览器失败:', e);
      toast.error('打开浏览器失败');
    }
  };

  // 删除
  const handleDelete = async (server_name: string) => {
    if (!await confirm({ content: `确定删除域名解析 ${server_name}？将同时移除阿里云 DNS、nginx 配置并 reload`, type: 'danger' })) return;
    try {
      const res = await deleteDomainMap(project, server_name);
      if (res.code === 200 && res.data) {
        const data = res.data as DeleteDomainMapResult;
        toast.success(`已删除: ${data.server_name}`);
        fetchList(project);
        if (data.reload_results && data.reload_results.length > 0) {
          setReloadTitle(`删除成功: ${data.server_name}`);
          setReloadResults(data.reload_results);
          setReloadVisible(true);
        }
      } else {
        toast.error(res.message || '删除失败');
      }
    } catch (e) {
      toast.error('删除失败');
      console.error(e);
    }
  };

  return (
    <div className="domain-map-page">
      <div className="page-header">
        <div className="title-section"><Globe size={20} /><h2>域名解析管理</h2></div>

        <div className="action-bar">
          <div className="form-group">
            <label>项目</label>
            <select value={project} onChange={e => setProject(e.target.value)}>
              {projects.map(p => <option key={p.project} value={p.project}>{p.project_name || p.project}</option>)}
            </select>
          </div>
          <div className="form-group sub-group">
            <label>子域名</label>
            <div className="sub-input">
              <input
                placeholder="如: testok"
                value={subDomain}
                onChange={e => setSubDomain(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <span className="dot">.</span>
              <select value={domain} onChange={e => setDomain(e.target.value)}>
                {domains.length === 0 && <option value="">无可选主域名</option>}
                {domains.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
            </div>
            {fullDomain && <span className="full-preview">完整域名：{fullDomain}</span>}
          </div>
          <div className="action-btns">
            <button className="btn-primary" onClick={handleAdd} disabled={submitting}>
              <Plus size={14} /> {submitting ? '添加中...' : '添加解析'}
            </button>
            <button className="btn-default" onClick={() => fetchList(project)} disabled={loading}>
              <RefreshCw size={14} /> 刷新
            </button>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 240 }}>域名</th>
              <th>配置文件路径</th>
              <th style={{ width: 180 }}>创建时间</th>
              <th style={{ width: 130 }}>测试访问</th>
              <th style={{ width: 180 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="loading-cell">加载中...</td></tr>
            ) : files.length === 0 ? (
              <tr><td colSpan={5} className="empty-cell">暂无数据</td></tr>
            ) : (
              files.map(f => (
                <tr key={f.path}>
                  <td title={f.domain}>{f.domain}</td>
                  <td title={f.path} className="path-cell">{f.path}</td>
                  <td>{f.created_at || '--'}</td>
                  <td className="test-cell">
                    <button
                      className="btn-link"
                      title={`https://${f.domain}${TEST_PATH}`}
                      onClick={() => handleTestVisit(f.domain)}
                    >
                      <ExternalLink size={12} /> 测试访问
                    </button>
                  </td>
                  <td className="action-cell">
                    <button className="btn-link" onClick={() => handlePreview(f.domain)}><Eye size={12} /> 预览</button>
                    <button className="btn-link danger" onClick={() => handleDelete(f.domain)}><Trash2 size={12} /> 删除</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 预览弹框 */}
      {previewVisible && (
        <div className="modal-overlay" onClick={() => setPreviewVisible(false)}>
          <div className="modal-content dm-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>nginx 配置预览{previewData ? ` - ${previewData.server_name}` : ''}</h3>
              <button className="modal-close" onClick={() => setPreviewVisible(false)}>×</button>
            </div>
            <div className="modal-body">
              {previewData && <div className="dm-file-path">文件路径：<code>{previewData.output_file}</code></div>}
              <pre className="dm-config-preview">{previewLoading ? '加载中...' : (previewData?.content || '')}</pre>
            </div>
            <div className="modal-footer">
              <button className="btn-default" onClick={() => setPreviewVisible(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* reload 结果弹框 */}
      {reloadVisible && (
        <div className="modal-overlay" onClick={() => setReloadVisible(false)}>
          <div className="modal-content dm-reload-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{reloadTitle}</h3>
              <button className="modal-close" onClick={() => setReloadVisible(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="dm-reload-tip">SSH 远程 reload nginx 节点结果：</div>
              <table className="data-table">
                <thead>
                  <tr><th>节点名称</th><th>主机</th><th>状态</th><th>错误信息</th></tr>
                </thead>
                <tbody>
                  {reloadResults.map((r, i) => (
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td>{r.host}</td>
                      <td>
                        <span className={`status-tag ${r.status === 'success' ? 'success' : 'danger'}`}>
                          {r.status === 'success' ? '成功' : '失败'}
                        </span>
                      </td>
                      <td title={r.error}>{r.error || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setReloadVisible(false)}>知道了</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DomainMapPage;

