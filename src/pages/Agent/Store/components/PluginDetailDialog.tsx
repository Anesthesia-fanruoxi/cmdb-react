/**
 * 插件详情对话框
 */

import { useState, useEffect } from 'react';
import { Loader2, FileText } from 'lucide-react';
import { StorePlugin } from '../../../../services/agent/store';
import { getPluginDetailApi, updatePlugin } from '../../../../services/agent/plugins';
import toast from '../../../../components/Toast';

interface Props {
  visible: boolean;
  plugin: StorePlugin | null;
  onClose: () => void;
}

const PluginDetailDialog = ({ visible, plugin, onClose }: Props) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<StorePlugin | null>(null);
  const [configTemplate, setConfigTemplate] = useState('');
  const [configVisible, setConfigVisible] = useState(false);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    if (visible && plugin) {
      fetchDetail();
    } else {
      setDetail(null);
      setConfigTemplate('');
      setConfigVisible(false);
    }
  }, [visible, plugin]);

  // ESC 关闭弹框
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (configVisible) setConfigVisible(false);
        else if (visible) onClose();
      }
    };
    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [visible, configVisible, onClose]);

  const fetchDetail = async () => {
    if (!plugin) return;
    setLoading(true);
    try {
      const res = await getPluginDetailApi(plugin.id);
      if (res.code === 200 && res.data) {
        setDetail(res.data as StorePlugin);
        setConfigTemplate((res.data as any).config_template || '');
      } else {
        setDetail(plugin);
      }
    } catch {
      setDetail(plugin);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenConfig = () => {
    setEditContent(configTemplate);
    setConfigVisible(true);
  };

  const handleSaveConfig = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await updatePlugin({ id: detail.id, config_template: editContent });
      if (res.code === 200) {
        setConfigTemplate(editContent);
        toast.success('配置模板保存成功');
        setConfigVisible(false);
      } else {
        toast.error(res.message || '保存失败');
      }
    } catch {
      toast.error('保存配置模板失败');
    } finally {
      setSaving(false);
    }
  };

  const getTypeName = (type: string) => type === 'container' ? '容器插件' : '二进制插件';

  if (!visible) return null;

  const displayPlugin = detail || plugin;

  return (
    <>
      <div className="dialog-overlay" onClick={onClose} />
      <div className="dialog-container detail-dialog">
        <div className="dialog-header"><h3>插件详情</h3></div>
        <div className="dialog-body">
          {loading ? (
            <div className="loading-state"><Loader2 size={24} className="spin" /> 加载中...</div>
          ) : displayPlugin && (
            <>
              <div className="detail-table">
                <div className="detail-row">
                  <span className="detail-label">显示名称</span>
                  <span className="detail-value">{displayPlugin.display_name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">插件标识</span>
                  <span className="detail-value">{displayPlugin.name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">版本号</span>
                  <span className="detail-value">v{displayPlugin.version}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">插件类型</span>
                  <span className="detail-value">{getTypeName(displayPlugin.plugin_type)}</span>
                </div>
                {displayPlugin.port && (
                  <div className="detail-row">
                    <span className="detail-label">服务端口</span>
                    <span className="detail-value">{displayPlugin.port}</span>
                  </div>
                )}
                {displayPlugin.description && (
                  <div className="detail-row">
                    <span className="detail-label">描述</span>
                    <span className="detail-value">{displayPlugin.description}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-label">状态</span>
                  <span className="detail-value"><span className="status-tag latest">最新版本</span></span>
                </div>
              </div>
              {displayPlugin.plugin_type === 'binary' && (
                <div className="config-section">
                  <button className="btn-config" onClick={handleOpenConfig}>
                    <FileText size={14} /> 查看配置文件
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 配置文件编辑弹框 */}
      {configVisible && (
        <>
          <div className="config-dialog-overlay" onClick={() => setConfigVisible(false)} />
          <div className="config-dialog">
            <div className="config-dialog-header"><h3>配置文件管理</h3></div>
            <div className="config-dialog-body">
              <div className="config-tip">
                配置文件中支持使用 {'{{.VAR_NAME}}'} 格式的变量，安装时会自动解析并替换。
                如果配置文件不为空且包含变量，安装时将显示预览对话框
              </div>
              <textarea
                className="config-textarea"
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                placeholder="请输入配置文件内容，支持 {{.VAR_NAME}} 格式变量"
                rows={15}
              />
            </div>
            <div className="config-dialog-footer">
              <button className="btn-default" onClick={() => setConfigVisible(false)}>取消</button>
              <button className="btn-primary" onClick={handleSaveConfig} disabled={saving}>
                {saving && <Loader2 size={14} className="spin" />} 保存配置
              </button>
            </div>
          </div>
        </>
      )}
      <style>{`
        .dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1100; cursor: pointer; }
        .detail-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 600px; max-width: 90%; background: var(--bg-color); border-radius: 8px; z-index: 1101; border: 1px solid var(--border-color); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); }
        .dialog-header { padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
        .dialog-header h3 { margin: 0; font-size: 16px; color: var(--text-color); }
        .dialog-body { padding: 20px; max-height: 60vh; overflow: auto; }
        .loading-state { display: flex; align-items: center; justify-content: center; gap: 8px; height: 150px; color: var(--text-secondary); }
        .detail-table { border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden; }
        .detail-row { display: flex; border-bottom: 1px solid var(--border-color); }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { width: 100px; padding: 12px; background: var(--bg-secondary); color: var(--text-secondary); font-size: 13px; flex-shrink: 0; }
        .detail-value { flex: 1; padding: 12px; color: var(--text-color); font-size: 13px; }
        .status-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
        .status-tag.latest { background: rgba(82, 196, 26, 0.1); color: #52c41a; }
        .config-section { margin-top: 16px; text-align: right; }
        .btn-config { display: inline-flex; align-items: center; gap: 4px; padding: 8px 16px; background: var(--primary-color); border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 13px; }
        .config-dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 1200; cursor: pointer; }
        .config-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 800px; max-width: 90%; background: var(--bg-color); border-radius: 8px; z-index: 1201; border: 1px solid var(--border-color); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); }
        .config-dialog-header { padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
        .config-dialog-header h3 { margin: 0; font-size: 16px; color: var(--text-color); }
        .config-dialog-body { padding: 20px; }
        .config-dialog-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border-color); }
        .config-tip { padding: 12px; background: rgba(64, 158, 255, 0.1); border: 1px solid rgba(64, 158, 255, 0.3); border-radius: 4px; color: var(--text-color); font-size: 13px; margin-bottom: 16px; }
        .config-textarea { width: 100%; padding: 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 13px; font-family: 'Courier New', monospace; color: var(--text-color); resize: vertical; }
        .btn-default, .btn-primary { display: inline-flex; align-items: center; gap: 4px; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; }
        .btn-default { background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-color); }
        .btn-primary { background: var(--primary-color); border: none; color: #fff; }
        .btn-primary:disabled { opacity: 0.6; }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </>
  );
};

export default PluginDetailDialog;
