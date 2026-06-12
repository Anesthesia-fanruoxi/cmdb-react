/**
 * 域名解析管理页面
 * 一站式管理：阿里云 DNS + nginx 配置 + SSH reload
 */

import { useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { isTauriEnv } from '../../../services/machine';
import { Globe, Plus, FolderOpen, RefreshCw } from 'lucide-react';
import toast from '../../../components/Toast';
import DomainMapTable from './DomainMapTable';
import PreviewModal from './PreviewModal';
import ReloadResultModal from './ReloadResultModal';
import AddDomainMapModal from './AddDomainMapModal';
import { useDomainMap } from './useDomainMap';
import './index.css';

const DomainMapPage = () => {
  const {
    projects, selectedProject,
    domains,
    loading, files,
    reloadVisible, setReloadVisible, reloadTitle, reloadResults,
    handleSelectProject, handleAdd, handleDelete, fetchList,
  } = useDomainMap();

  const [searchText, setSearchText] = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewServerName, setPreviewServerName] = useState('');

  const filteredProjects = useMemo(() => {
    if (!searchText.trim()) return projects;
    const keyword = searchText.trim().toLowerCase();
    return projects.filter(p =>
      p.project.toLowerCase().includes(keyword) ||
      (p.project_name && p.project_name.toLowerCase().includes(keyword))
    );
  }, [projects, searchText]);

  const handlePreview = (serverName: string) => {
    setPreviewServerName(serverName);
    setPreviewVisible(true);
  };

  const handleTestVisit = async (serverName: string) => {
    const url = `https://${serverName}/ystg/html/xinxiaorong1.html?channelSign=uW4CsYeFoTPYSHwAWE2FH61GuAUVfDu6GHAmjaJt7K`;
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

  const handleAddSubmit = async (subDomain: string, domain: string) => {
    await handleAdd(subDomain, domain);
    setAddModalVisible(false);
  };

  return (
    <div className="domain-map-page">
      <div className="dm-layout">
        <div className="dm-sidebar">
          <div className="dm-sidebar-header">
            <div className="dm-sidebar-title">
              <FolderOpen size={16} />
              <span>项目列表</span>
            </div>
            <span className="dm-sidebar-count">{projects.length}</span>
          </div>
          <div className="dm-sidebar-search">
            <input
              className="dm-search-input"
              type="text"
              placeholder="搜索项目..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
          </div>
          <div className="dm-sidebar-list">
            {filteredProjects.length === 0 ? (
              <div className="dm-sidebar-empty">暂无匹配项目</div>
            ) : (
              filteredProjects.map(p => (
                <div
                  key={p.project}
                  className={`dm-project-card ${selectedProject?.project === p.project ? 'active' : ''}`}
                  onClick={() => handleSelectProject(p)}
                >
                  <div className="dm-project-name">
                    <span>{p.project_name || p.project}</span>
                    {p.project_name && <span className="dm-project-code">{p.project}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="dm-main">
          <div className="dm-main-header">
            <div className="dm-main-title">
              <Globe size={18} />
              <h2>{selectedProject ? `${selectedProject.project_name || selectedProject.project} - 域名解析` : '域名解析管理'}</h2>
            </div>
            {selectedProject && (
              <div className="dm-main-actions">
                <button className="btn-default" onClick={() => fetchList(selectedProject.project)} disabled={loading}>
                  <RefreshCw size={14} /> 刷新
                </button>
                <button className="btn-primary" onClick={() => setAddModalVisible(true)}>
                  <Plus size={14} /> 添加解析
                </button>
              </div>
            )}
          </div>

          <div className="dm-main-content">
            {!selectedProject ? (
              <div className="dm-empty-state">
                <FolderOpen size={48} />
                <p>请从左侧选择一个项目</p>
              </div>
            ) : (
              <DomainMapTable
                loading={loading}
                files={files}
                onPreview={handlePreview}
                onDelete={handleDelete}
                onTestVisit={handleTestVisit}
              />
            )}
          </div>
        </div>
      </div>

      <AddDomainMapModal
        visible={addModalVisible}
        domains={domains}
        onSubmit={handleAddSubmit}
        onClose={() => setAddModalVisible(false)}
      />
      <PreviewModal visible={previewVisible} project={selectedProject?.project || ''} serverName={previewServerName} onClose={() => setPreviewVisible(false)} />
      <ReloadResultModal visible={reloadVisible} title={reloadTitle} results={reloadResults} onClose={() => setReloadVisible(false)} />
    </div>
  );
};

export default DomainMapPage;
