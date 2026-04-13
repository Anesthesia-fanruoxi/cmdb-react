/**
 * 插件管理页面
 */

import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Plus, Loader2 } from 'lucide-react';
import { getPluginsList, createPlugin, updatePlugin, deletePlugin, PluginItem, PluginFormData } from '../../../services/agent/plugins';
import toast from '../../../components/Toast';
import { confirm } from '../../../components/ConfirmModal';
import PluginFormDialog from './components/PluginFormDialog';
import './index.css';

const AgentPlugins = () => {
  const [loading, setLoading] = useState(false);
  const [plugins, setPlugins] = useState<PluginItem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [pluginType, setPluginType] = useState('');

  // 表单弹框
  const [formVisible, setFormVisible] = useState(false);
  const [editingPlugin, setEditingPlugin] = useState<PluginItem | null>(null);

  const fetchPlugins = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (keyword) params.keyword = keyword;
      if (pluginType) params.type = pluginType;
      const res = await getPluginsList(params);
      if (res.code === 200) {
        setPlugins(Array.isArray(res.data) ? res.data : []);
      }
    } catch { toast.error('获取插件列表失败'); }
    finally { setLoading(false); }
  }, [keyword, pluginType]);

  useEffect(() => { fetchPlugins(); }, []);

  const handleSearch = () => fetchPlugins();
  const handleReset = () => { setKeyword(''); setPluginType(''); fetchPlugins(); };
  const handleCreate = () => { setEditingPlugin(null); setFormVisible(true); };
  const handleEdit = (plugin: PluginItem) => { setEditingPlugin(plugin); setFormVisible(true); };

  const handleDelete = async (plugin: PluginItem) => {
    if (!await confirm({ content: `确定要删除插件 ${plugin.display_name}（${plugin.name} v${plugin.version}）吗？`, type: 'danger' })) return;
    try {
      const res = await deletePlugin(plugin.id);
      if (res.code === 200) { toast.success('删除成功'); fetchPlugins(); }
      else { toast.error(res.message || '删除失败'); }
    } catch { toast.error('删除失败'); }
  };

  const handleFormSubmit = async (data: PluginFormData, isEdit: boolean, id?: number, original?: PluginItem) => {
    try {
      let res;
      if (isEdit && id !== undefined) {
        // 编辑模式：只传修改的字段，与 Vue 端保持一致
        const payload: Record<string, unknown> = { id };
        if (data.version !== original?.version) payload.version = data.version;
        if (data.display_name !== original?.display_name) payload.display_name = data.display_name;
        if (data.description !== original?.description) payload.description = data.description;
        const newPort = data.port && data.port > 0 ? data.port : null;
        const oldPort = original?.port && original.port > 0 ? original.port : null;
        if (newPort !== oldPort) payload.port = newPort;
        console.log('[plugins] updatePlugin payload:', payload);
        res = await updatePlugin(payload as Parameters<typeof updatePlugin>[0]);
      } else {
        const payload: Record<string, unknown> = {
          name: data.name,
          version: data.version,
          display_name: data.display_name,
          plugin_type: data.plugin_type,
        };
        if (data.description) payload.description = data.description;
        if (data.port && data.port > 0) payload.port = data.port;
        console.log('[plugins] createPlugin payload:', payload);
        res = await createPlugin(payload as unknown as PluginFormData);
      }
      console.log('[plugins] response:', res);
      if (res.code === 200) {
        toast.success(isEdit ? '更新成功' : '创建成功');
        setFormVisible(false);
        fetchPlugins();
        return true;
      } else {
        console.error('[plugins] 业务失败 code:', res.code, 'message:', res.message);
        toast.error(res.message || '操作失败');
        return false;
      }
    } catch (e) {
      console.error('[plugins] 操作失败 error:', e);
      if (e instanceof Error) {
        console.error('[plugins] error.message:', e.message);
        console.error('[plugins] error.name:', e.name);
        // RequestError 有 code 和 details 字段
        const re = e as Error & { code?: number; details?: string };
        if (re.code !== undefined) console.error('[plugins] error.code:', re.code);
        if (re.details) console.error('[plugins] error.details:', re.details);
      }
      toast.error('操作失败');
      return false;
    }
  };

  return (
    <div className="agent-plugins-page">
      <div className="page-card">
        <div className="search-bar">
          <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="搜索插件名称或显示名称" className="search-input" />
          <select value={pluginType} onChange={e => setPluginType(e.target.value)} className="search-select">
            <option value="">插件类型</option>
            <option value="container">容器类型</option>
            <option value="binary">二进制</option>
          </select>
          <button className="btn-default" onClick={handleSearch}><Search size={14} /> 搜索</button>
          <button className="btn-default" onClick={handleReset}><RefreshCw size={14} /> 重置</button>
          <button className="btn-primary" onClick={handleCreate}><Plus size={14} /> 新增插件</button>
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div className="loading-state"><Loader2 size={24} className="spin" /> 加载中...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>插件名称</th><th>显示名称</th><th>版本</th><th>类型</th>
                  <th>服务端口</th><th>描述</th><th>镜像/下载地址</th><th>创建时间</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {plugins.map(plugin => (
                  <tr key={plugin.id}>
                    <td><span className="tag">{plugin.name}</span></td>
                    <td>{plugin.display_name}</td>
                    <td>{plugin.version}</td>
                    <td><span className={`type-tag ${plugin.plugin_type}`}>{plugin.plugin_type === 'container' ? '容器' : '二进制'}</span></td>
                    <td>{plugin.port || '-'}</td>
                    <td title={plugin.description}>{plugin.description || '-'}</td>
                    <td title={plugin.image || plugin.download_url}>{plugin.image || plugin.download_url || '-'}</td>
                    <td>{plugin.created_at?.slice(0, 19).replace('T', ' ') || '-'}</td>
                    <td className="action-cell">
                      <button className="btn-link" onClick={() => handleEdit(plugin)}>编辑</button>
                      <button className="btn-link danger" onClick={() => handleDelete(plugin)}>删除</button>
                    </td>
                  </tr>
                ))}
                {plugins.length === 0 && <tr><td colSpan={9} className="empty-cell">暂无插件</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <PluginFormDialog visible={formVisible} plugin={editingPlugin} onClose={() => setFormVisible(false)} onSubmit={(data, isEdit, id) => handleFormSubmit(data, isEdit, id, editingPlugin ?? undefined)} />
    </div>
  );
};

export default AgentPlugins;
