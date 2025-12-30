/**
 * 插件编辑对话框
 */

import { useState, useEffect } from 'react';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';
import { operatePlugin, Project, Plugin } from '../../../../services/agent/project';
import toast from '../../../../components/Toast';

interface Props {
  visible: boolean;
  plugin: Plugin | null;
  project: Project | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface ConfigItem { key: string; value: string; }

const PluginEditDialog = ({ visible, plugin, project, onClose, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [containerPort, setContainerPort] = useState<number | undefined>();
  const [configList, setConfigList] = useState<ConfigItem[]>([]);

  useEffect(() => {
    if (visible && plugin) {
      setContainerPort(plugin.container_port);
      const configs = plugin.config ? Object.entries(plugin.config).map(([key, value]) => ({ key, value })) : [];
      setConfigList(configs.length > 0 ? configs : [{ key: '', value: '' }]);
    }
  }, [visible, plugin]);

  const handleAddConfig = () => setConfigList(prev => [...prev, { key: '', value: '' }]);
  
  const handleRemoveConfig = (index: number) => setConfigList(prev => prev.filter((_, i) => i !== index));
  
  const handleConfigChange = (index: number, field: 'key' | 'value', value: string) => {
    setConfigList(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const handleSubmit = async () => {
    if (!plugin || !project) return;
    setLoading(true);
    try {
      const config: Record<string, string> = {};
      configList.forEach(item => { if (item.key && item.value) config[item.key] = item.value; });
      
      const res = await operatePlugin({
        project: project.project,
        name: plugin.name,
        action: 'edit',
        container_port: containerPort,
        config
      });
      
      if (res.code === 200) {
        toast.success('保存成功');
        onSuccess();
      } else { toast.error(res.message || '保存失败'); }
    } catch { toast.error('保存失败'); }
    finally { setLoading(false); }
  };

  if (!visible) return null;

  return (
    <>
      <div className="dialog-overlay" onClick={onClose} style={{ zIndex: 1200 }} />
      <div className="dialog-container edit-dialog">
        <div className="dialog-header">
          <h3>编辑插件 - {plugin?.name}</h3>
          <button className="dialog-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="dialog-body">
          {plugin?.plugin_type === 'container' && (
            <div className="form-item">
              <label>容器端口</label>
              <input type="number" value={containerPort || ''} onChange={e => setContainerPort(Number(e.target.value) || undefined)} placeholder="8080" min={1} max={65535} />
            </div>
          )}

          <div className="form-item">
            <label>配置参数</label>
            <div className="config-list">
              {configList.map((item, index) => (
                <div key={index} className="config-row">
                  <input type="text" value={item.key} onChange={e => handleConfigChange(index, 'key', e.target.value)} placeholder="参数名" className="config-key-input" />
                  <span className="config-sep">=</span>
                  <input type="text" value={item.value} onChange={e => handleConfigChange(index, 'value', e.target.value)} placeholder="参数值" className="config-value-input" />
                  <button className="btn-icon danger" onClick={() => handleRemoveConfig(index)}><Trash2 size={14} /></button>
                </div>
              ))}
              <button className="btn-add" onClick={handleAddConfig}><Plus size={14} /> 添加配置</button>
            </div>
          </div>
        </div>
        <div className="dialog-footer">
          <button className="btn-default" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 size={14} className="spin" />} 保存
          </button>
        </div>
      </div>
      <style>{`
        .edit-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 600px; max-width: 90%; background: var(--bg-color); border-radius: 8px; z-index: 1201; }
        .dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
        .dialog-header h3 { margin: 0; font-size: 16px; color: var(--text-color); }
        .dialog-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); }
        .dialog-body { padding: 20px; max-height: 60vh; overflow: auto; }
        .dialog-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border-color); }
        .form-item { margin-bottom: 16px; }
        .form-item label { display: block; margin-bottom: 8px; font-size: 14px; color: var(--text-color); }
        .form-item input[type="number"] { width: 200px; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); color: var(--text-color); font-size: 13px; }
        .config-list { display: flex; flex-direction: column; gap: 12px; }
        .config-row { display: flex; align-items: center; gap: 8px; }
        .config-key-input, .config-value-input { flex: 1; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); color: var(--text-color); font-size: 13px; }
        .config-sep { font-weight: bold; color: var(--text-secondary); }
        .btn-icon { background: none; border: none; cursor: pointer; padding: 4px; color: var(--text-secondary); }
        .btn-icon.danger { color: #ff4d4f; }
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

export default PluginEditDialog;
