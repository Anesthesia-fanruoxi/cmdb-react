/**
 * 插件市场页面
 */

import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Loader2, Package, Download, Info } from 'lucide-react';
import { getPluginStoreList, getAgentStoreProjects, StorePlugin, StoreProject } from '../../../services/agent/store';
import toast from '../../../components/Toast';
import InstallDrawer from './components/InstallDrawer';
import PluginDetailDialog from './components/PluginDetailDialog';
import './index.css';

const AgentStore = () => {
  const [loading, setLoading] = useState(false);
  const [plugins, setPlugins] = useState<StorePlugin[]>([]);
  const [projects, setProjects] = useState<StoreProject[]>([]);
  const [keyword, setKeyword] = useState('');
  const [pluginType, setPluginType] = useState('');

  // 安装抽屉
  const [installVisible, setInstallVisible] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<StorePlugin | null>(null);

  // 详情对话框
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailPlugin, setDetailPlugin] = useState<StorePlugin | null>(null);

  const fetchPlugins = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (keyword) params.keyword = keyword;
      if (pluginType) params.plugin_type = pluginType;
      const res = await getPluginStoreList(params);
      if (res.code === 200) {
        setPlugins(Array.isArray(res.data) ? res.data : []);
      }
    } catch { toast.error('获取插件列表失败'); }
    finally { setLoading(false); }
  }, [keyword, pluginType]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await getAgentStoreProjects();
      if (res.code === 200) {
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.list || [];
        setProjects(list);
      }
    } catch { console.error('获取项目列表失败'); }
  }, []);

  useEffect(() => { fetchPlugins(); fetchProjects(); }, []);

  const handleSearch = () => fetchPlugins();
  const handleReset = () => { setKeyword(''); setPluginType(''); fetchPlugins(); };

  const handleInstall = (plugin: StorePlugin) => {
    setSelectedPlugin(plugin);
    setInstallVisible(true);
  };

  const handleViewDetail = (plugin: StorePlugin) => {
    setDetailPlugin(plugin);
    setDetailVisible(true);
  };

  const getTypeClass = (type: string) => type === 'container' ? 'container' : 'binary';
  const getTypeName = (type: string) => type === 'container' ? '容器插件' : '二进制插件';

  return (
    <div className="agent-store-page">
      <div className="page-card">
        <div className="search-bar">
          <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="支持模糊搜索" className="search-input" />
          <select value={pluginType} onChange={e => setPluginType(e.target.value)} className="search-select">
            <option value="">插件类型</option>
            <option value="container">容器插件</option>
            <option value="binary">二进制插件</option>
          </select>
          <button className="btn-default" onClick={handleSearch}><Search size={14} /> 搜索</button>
          <button className="btn-default" onClick={handleReset}><RefreshCw size={14} /> 重置</button>
        </div>

        <div className="plugin-container">
          {loading ? (
            <div className="loading-state"><Loader2 size={24} className="spin" /> 加载中...</div>
          ) : plugins.length === 0 ? (
            <div className="empty-state">暂无插件</div>
          ) : (
            <div className="plugin-grid">
              {plugins.map(plugin => (
                <div key={plugin.id} className="plugin-card">
                  <div className="plugin-header">
                    <div className="plugin-icon"><Package size={32} /></div>
                    <div className="plugin-info">
                      <div className="plugin-name">{plugin.display_name}</div>
                      <div className="plugin-meta">
                        <span className={`type-tag ${getTypeClass(plugin.plugin_type)}`}>{getTypeName(plugin.plugin_type)}</span>
                        <span className="version">v{plugin.version}</span>
                      </div>
                    </div>
                  </div>
                  <div className="plugin-desc">{plugin.description || '暂无描述'}</div>
                  <div className="plugin-footer">
                    <button className="btn-install" onClick={() => handleInstall(plugin)}>
                      <Download size={14} /> 安装
                    </button>
                    <button className="btn-detail" onClick={() => handleViewDetail(plugin)}>
                      <Info size={14} /> 详情
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <InstallDrawer
        visible={installVisible}
        plugin={selectedPlugin}
        projects={projects}
        onClose={() => setInstallVisible(false)}
        onSuccess={() => { setInstallVisible(false); toast.success('安装成功'); }}
      />

      <PluginDetailDialog
        visible={detailVisible}
        plugin={detailPlugin}
        onClose={() => setDetailVisible(false)}
      />
    </div>
  );
};

export default AgentStore;
