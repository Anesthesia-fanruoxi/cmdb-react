/**
 * 插件安装抽屉
 */

import { useState, useEffect } from 'react';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';
import { installPlugin, StorePlugin, StoreProject } from '../../../../services/agent/store';
import toast from '../../../../components/Toast';

interface ConfigItem { key: string; value: string; }

interface Props {
  visible: boolean;
  plugin: StorePlugin | null;
  projects: StoreProject[];
  onClose: () => void;
  onSuccess: () => void;
}

const InstallDrawer = ({ visible, plugin, projects, onClose, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [containerPort, setContainerPort] = useState<number | undefined>();
  const [configList, setConfigList] = useState<ConfigItem[]>([{ key: '', value: '' }]);

  useEffect(() => {
    if (visible) {
      setSelectedProject('');
      setContainerPort(plugin?.port);
      setConfigList([{ key: '', value: '' }]);
    }
  }, [visible, plugin]);

  const handleAddConfig = () => setConfigList(prev => [...prev, { key: '', value: '' }]);
  const handleRemoveConfig = (index: number) => setConfigList(prev => prev.filter((_, i) => i !== index));
  const handleConfigChange = (index: number, field: 'key' | 'value', value: string) => {
    setConfigList(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const handleInstall = async () => {
    if (!plugin) return;
    if (!selectedProject) { toast.error('请选择项目'); return; }

    setLoading(true);
    try {
      const config: Record<string, string> = {};
      configList.forEach(item => { if (item.key && item.value) config[item.key] = item.value; });

      const res = await installPlugin({
        plugin_id: plugin.id,
        project: selectedProject,
        container_port: containerPort,
        config: Object.keys(config).length > 0 ? config : undefined
      });

      if (res.code === 200) {
        onSuccess();
      } else { toast.error(res.message || '安装失败'); }
    } catch { toast.error('安装失败'); }
    finally { setLoading(false); }
  };

  if (!visible) return null;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-container install-drawer">
        <div className="drawer-header">
          <h3>安装插件 - {plugin?.display_name}</h3>
          <button className="drawer-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="drawer-body">
          <div className="plugin-info-card">
            <div className="info-row"><span className="label">插件名称:</span><span>{plugin?.name}</span></div>
            <div className="info-row"><span className="label">版本:</span><span>v{plugin?.version}</span></div>
            <div className="info-row"><span className="label">类型:</span><span>{plugin?.plugin_type === 'container' ? '容器插件' : '二进制插件'}</span></div>
          </div>

          <div className="form-item">
            <label>选择项目 <span className="required">*</span></label>
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
              <option value="">请选择项目</option>
              {projects.map(p => <option key={p.project} value={p.project}>{p.project_name}</option>)}
            </select>
          </div>

          {plugin?.plugin_type === 'container' && (
            <div className="form-item">
              <label>容器端口</label>
              <input type="number" value={containerPort || ''} onChange={e => setContainerPort(Number(e.target.value) || undefined)} placeholder="容器内服务端口" min={1} max={65535} />
            </div>
          )}

          <div className="form-item">
            <label>配置参数</label>
            <div className="config-list">
              {configList.map((item, index) => (
                <div key={index} className="config-row">
                  <input type="text" value={item.key} onChange={e => handleConfigChange(index, 'key', e.target.value)} placeholder="参数名" />
                  <span className="sep">=</span>
                  <input type="text" value={item.value} onChange={e => handleConfigChange(index, 'value', e.target.value)} placeholder="参数值" />
                  <button className="btn-icon" onClick={() => handleRemoveConfig(index)}><Trash2 size={14} /></button>
                </div>
              ))}
              <button className="btn-add" onClick={handleAddConfig}><Plus size={14} /> 添加配置</button>
            </div>
          </div>
        </div>
        <div className="drawer-footer">
          <button className="btn-default" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleInstall} disabled={loading}>
            {loading && <Loader2 size={14} className="spin" />} 确认安装
          </button>
        </div>
      </div>
      <style>{`
        .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1100; }
        .install-drawer { position: fixed; top: 0; right: 0; width: 500px; height: 100%; background: var(--bg-color); z-index: 1101; display: flex; flex-direction: column; }
        .drawer-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
        .drawer-header h3 { margin: 0; font-size: 16px; color: var(--text-color); }
        .drawer-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); }
        .drawer-body { flex: 1; overflow: auto; padding: 20px; }
        .drawer-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border-color); }
        .plugin-info-card { background: var(--bg-secondary); border-radius: 8px; padding: 16px; margin-bottom: 20px; }
        .info-row { display: flex; gap: 8px; margin-bottom: 8px; font-size: 14px; }
        .info-row:last-child { margin-bottom: 0; }
        .info-row .label { color: var(--text-secondary); }
        .info-row span:last-child { color: var(--text-color); }
        .form-item { margin-bottom: 16px; }
        .form-item label { display: block; margin-bottom: 8px; font-size: 14px; color: var(--text-color); }
        .form-item .required { color: #ff4d4f; }
        .form-item select, .form-item input { width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); color: var(--text-color); font-size: 13px; }
        .config-list { display: flex; flex-direction: column; gap: 12px; }
        .config-row { display: flex; align-items: center; gap: 8px; }
        .config-row input { flex: 1; }
        .config-row .sep { color: var(--text-secondary); font-weight: bold; }
        .btn-icon { background: none; border: none; cursor: pointer; color: #ff4d4f; padding: 4px; }
        .btn-add { display: flex; align-items: center; gap: 4px; padding: 8px 12px; background: var(--bg-secondary); border: 1px dashed var(--border-color); border-radius: 4px; cursor: pointer; font-size: 13px; color: var(--primary-color); }
        .btn-default, .btn-primary { display: flex; align-items: center; gap: 4px; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; }
        .btn-default { background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-color); }
        .btn-primary { background: var(--primary-color); border: none; color: #fff; }
        .btn-primary:disabled { opacity: 0.6; }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </>
  );
};

export default InstallDrawer;
