/**
 * 插件表单对话框
 */

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { toast } from '../../../../components/AppNotification';
import { PluginItem, PluginFormData } from '../../../../services/agent/plugins';

interface Props {
  visible: boolean;
  plugin: PluginItem | null;
  onClose: () => void;
  onSubmit: (data: PluginFormData, isEdit: boolean, id?: number) => Promise<boolean>;
}

const PluginFormDialog = ({ visible, plugin, onClose, onSubmit }: Props) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<PluginFormData>({
    name: '', version: '', display_name: '', plugin_type: 'container', description: '', port: undefined
  });

  const isEdit = !!plugin;

  useEffect(() => {
    if (visible && plugin) {
      setForm({
        name: plugin.name,
        version: plugin.version,
        display_name: plugin.display_name,
        plugin_type: plugin.plugin_type,
        description: plugin.description || '',
        port: plugin.port || undefined
      });
    } else if (visible) {
      setForm({ name: '', version: '', display_name: '', plugin_type: 'container', description: '', port: undefined });
    }
  }, [visible, plugin]);

  const handleSubmit = async () => {
    console.log('[PluginFormDialog] handleSubmit called, isEdit:', isEdit, 'form:', form);
    if (!form.name?.trim()) { console.warn('[PluginFormDialog] 验证失败: name 为空'); toast.warning('请输入插件名称'); return; }
    if (!isEdit && !/^[a-z0-9-]+$/.test(form.name)) { console.warn('[PluginFormDialog] 验证失败: name 格式不对', form.name); toast.warning('插件名称只能包含小写字母、数字和连字符'); return; }
    if (!form.version?.trim()) { console.warn('[PluginFormDialog] 验证失败: version 为空'); toast.warning('请输入版本号'); return; }
    if (!form.display_name?.trim()) { console.warn('[PluginFormDialog] 验证失败: display_name 为空'); toast.warning('请输入显示名称'); return; }

    console.log('[PluginFormDialog] 验证通过，调用 onSubmit');
    setLoading(true);
    const success = await onSubmit(form, isEdit, plugin?.id);
    console.log('[PluginFormDialog] onSubmit 返回:', success);
    setLoading(false);
    if (success) onClose();
  };

  if (!visible) return null;

  return (
    <>
      <div className="dialog-overlay" onClick={onClose} />
      <div className="dialog-container plugin-form-dialog">
        <div className="dialog-header">
          <h3>{isEdit ? '编辑插件' : '新增插件'}</h3>
          <button className="dialog-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="dialog-body">
          <div className="form-item">
            <label>插件名称 <span className="required">*</span></label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="唯一标识，如: redis, mysql" disabled={isEdit} />
            <span className="form-tip">英文标识，创建后不可修改</span>
          </div>
          <div className="form-item">
            <label>版本号 <span className="required">*</span></label>
            <input type="text" value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="如: 7.0.0, 1.0" />
            <span className="form-tip">修改版本号会更新插件版本</span>
          </div>
          <div className="form-item">
            <label>显示名称 <span className="required">*</span></label>
            <input type="text" value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="用户看到的名称" />
          </div>
          <div className="form-item">
            <label>插件类型 <span className="required">*</span></label>
            <div className="radio-group">
              <label className="radio-item">
                <input type="radio" name="plugin_type" value="container" checked={form.plugin_type === 'container'} onChange={e => setForm(f => ({ ...f, plugin_type: e.target.value }))} disabled={isEdit} />
                容器类型
              </label>
              <label className="radio-item">
                <input type="radio" name="plugin_type" value="binary" checked={form.plugin_type === 'binary'} onChange={e => setForm(f => ({ ...f, plugin_type: e.target.value }))} disabled={isEdit} />
                二进制
              </label>
            </div>
          </div>
          <div className="form-item">
            <label>服务端口</label>
            <div className="port-input-group">
              <button type="button" className="port-btn" onClick={() => setForm(f => ({ ...f, port: Math.max(1, (f.port || 0) - 1) }))}>−</button>
              <input type="number" value={form.port || ''} onChange={e => setForm(f => ({ ...f, port: Number(e.target.value) || undefined }))} placeholder="8080" min={1} max={65535} />
              <button type="button" className="port-btn" onClick={() => setForm(f => ({ ...f, port: Math.min(65535, (f.port || 0) + 1) }))}>+</button>
              <span className="port-tip">{form.plugin_type === 'container' ? '插件服务监听的端口（容器内端口）（可选，不填则不指定端口）' : '插件服务监听的端口（可选）'}</span>
            </div>
          </div>
          <div className="form-item">
            <label>插件描述</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="插件功能说明" rows={3} />
          </div>
        </div>
        <div className="dialog-footer">
          <button className="btn-default" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 size={14} className="spin" />} {isEdit ? '保存' : '创建'}
          </button>
        </div>
      </div>
      <style>{`
        .plugin-form-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 600px; max-width: 90%; background: var(--bg-color); border-radius: 8px; z-index: 1101; border: 1px solid var(--border-color); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); }
        .dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
        .dialog-header h3 { margin: 0; font-size: 16px; color: var(--text-color); }
        .dialog-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); }
        .dialog-body { padding: 20px; max-height: 60vh; overflow: auto; }
        .dialog-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border-color); }
        .form-item { margin-bottom: 16px; }
        .form-item label { display: block; margin-bottom: 8px; font-size: 14px; color: var(--text-color); }
        .form-item .required { color: #ff4d4f; }
        .form-item input[type="text"], .form-item input[type="number"], .form-item textarea { width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); color: var(--text-color); font-size: 13px; }
        .form-item input:disabled { opacity: 0.6; cursor: not-allowed; }
        .form-item textarea { resize: vertical; }
        .form-tip { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
        .port-input-group { display: flex; align-items: center; gap: 0; }
        .port-input-group input { width: 80px; text-align: center; border-radius: 0; border-left: none; border-right: none; height: 32px; }
        .port-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: var(--bg-secondary); border: 1px solid var(--border-color); cursor: pointer; font-size: 16px; color: var(--text-color); flex-shrink: 0; }
        .port-btn:first-child { border-radius: 4px 0 0 4px; border-right: none; }
        .port-btn:nth-child(3) { border-radius: 0 4px 4px 0; border-left: none; }
        .port-btn:hover { background: var(--bg-hover); }
        .port-tip { font-size: 12px; color: var(--text-secondary); margin-left: 12px; }
        .radio-group { display: flex; gap: 20px; }
        .radio-item { display: flex; align-items: center; gap: 6px; font-size: 14px; color: var(--text-color); cursor: pointer; }
        .radio-item input[type="radio"] { appearance: none; -webkit-appearance: none; width: 16px; height: 16px; border: 2px solid var(--border-color); border-radius: 50%; margin: 0; cursor: pointer; position: relative; background: var(--bg-secondary); }
        .radio-item input[type="radio"]:checked { border-color: var(--primary-color); }
        .radio-item input[type="radio"]:checked::after { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 8px; height: 8px; background: var(--primary-color); border-radius: 50%; }
        .radio-item input[type="radio"]:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-default, .btn-primary { display: flex; align-items: center; gap: 4px; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; }
        .btn-default { background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-color); }
        .btn-primary { background: var(--primary-color); border: none; color: #fff; }
        .btn-primary:disabled { opacity: 0.6; }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </>
  );
};

export default PluginFormDialog;
