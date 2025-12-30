/**
 * 插件管理抽屉
 */

import { useState } from 'react';
import { X, RefreshCw, Loader2, Box, Play, Pause, RotateCw, Edit2, FileText, Trash2, Upload } from 'lucide-react';
import { operatePlugin, Project, Plugin, ProjectDetail, PluginOperateData } from '../../../../services/agent/project';
import toast from '../../../../components/Toast';
import PluginEditDialog from './PluginEditDialog';
import PluginLogsDialog from './PluginLogsDialog';

interface Props {
  visible: boolean;
  project: Project | null;
  detail: ProjectDetail | null;
  loading: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

const PluginDrawer = ({ visible, project, detail, loading, onClose, onRefresh }: Props) => {
  const [operating, setOperating] = useState<string | null>(null);
  const [editPlugin, setEditPlugin] = useState<Plugin | null>(null);
  const [logsPlugin, setLogsPlugin] = useState<Plugin | null>(null);

  const getStatusText = (status: string) => {
    const map: Record<string, string> = { running: '运行中', stopped: '已停止', error: '异常' };
    return map[status] || status;
  };

  const getStatusClass = (status: string) => {
    const map: Record<string, string> = { running: 'success', stopped: 'default', error: 'danger' };
    return map[status] || 'default';
  };

  const getCategoryText = (category: string) => {
    const map: Record<string, string> = { monitor: '监控', log: '日志', security: '安全', other: '其他' };
    return map[category] || category;
  };

  const formatTime = (time?: string) => time ? time.replace('T', ' ').slice(0, 19) : '-';

  const handleOperate = async (plugin: Plugin, action: PluginOperateData['action']) => {
    if (!project) return;
    const actionText: Record<string, string> = { start: '启动', stop: '停止', restart: '重启', uninstall: '卸载', update: '更新' };
    if (action === 'uninstall' && !confirm(`确定要卸载插件 "${plugin.name}" 吗？`)) return;

    setOperating(`${plugin.name}-${action}`);
    try {
      const res = await operatePlugin({ project: project.project, name: plugin.name, action });
      if (res.code === 200) {
        toast.success(`${actionText[action]}成功`);
        onRefresh();
      } else { toast.error(res.message || `${actionText[action]}失败`); }
    } catch { toast.error(`${actionText[action]}失败`); }
    finally { setOperating(null); }
  };

  if (!visible) return null;

  const plugins = detail?.plugins || [];

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-container plugin-drawer">
        <div className="drawer-header">
          <h3>{project?.project_name || ''} - 插件管理</h3>
          <button className="drawer-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="drawer-body">
          <div className="project-info-alert">
            <div className="alert-title">{project?.project_name}</div>
            <div className="alert-desc">项目标识: {project?.project}</div>
            {detail?.agent_version && <div className="alert-desc">Agent 版本: {detail.agent_version}</div>}
            {detail?.eip && <div className="alert-desc">出口IP: {detail.eip}</div>}
          </div>

          <div className="section-header">
            <span className="section-title">已安装插件 ({plugins.length})</span>
            <button className="btn-sm" onClick={onRefresh} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> 刷新
            </button>
          </div>

          {loading ? (
            <div className="loading-state"><Loader2 size={20} className="spin" /> 加载中...</div>
          ) : plugins.length === 0 ? (
            <div className="empty-state">该项目暂无已安装的插件</div>
          ) : (
            <div className="plugin-list">
              {plugins.map(plugin => (
                <div key={plugin.name} className="plugin-card">
                  <div className="plugin-header">
                    <div className="plugin-icon"><Box size={24} /></div>
                    <div className="plugin-info">
                      <div className="plugin-title-row">
                        <div className="plugin-title">
                          <span className="plugin-name">{plugin.name}</span>
                          <span className="plugin-version">v{plugin.version}</span>
                          {plugin.is_update && (
                            <>
                              <span className="update-tag">NEW</span>
                              <button className="btn-update" onClick={() => handleOperate(plugin, 'update')}>
                                <Upload size={12} /> 更新
                              </button>
                            </>
                          )}
                        </div>
                        <span className={`status-tag ${getStatusClass(plugin.status)}`}>{getStatusText(plugin.status)}</span>
                      </div>
                      <div className="plugin-meta">
                        <span>{getCategoryText(plugin.category)}</span>
                        {plugin.plugin_type === 'container' && (
                          <>
                            <span className="sep">|</span><span>容器端口: {plugin.container_port}</span>
                            <span className="sep">|</span><span>宿主机端口: {plugin.port}</span>
                          </>
                        )}
                        <span className="sep">|</span><span>运行: {plugin.uptime || '-'}</span>
                        <span className="sep">|</span><span>{formatTime(plugin.installed_at)}</span>
                      </div>
                    </div>
                  </div>

                  {plugin.config && Object.keys(plugin.config).length > 0 && (
                    <div className="plugin-config">
                      <div className="config-header">配置信息</div>
                      <div className="config-list">
                        {Object.entries(plugin.config).map(([key, value]) => (
                          <div key={key} className="config-item"><span className="config-key">{key}:</span><span className="config-value">{value}</span></div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="plugin-actions">
                    <button className={`btn-action ${plugin.status === 'running' ? 'warning' : 'success'}`} onClick={() => handleOperate(plugin, plugin.status === 'running' ? 'stop' : 'start')} disabled={!!operating}>
                      {plugin.status === 'running' ? <><Pause size={14} /> 停止</> : <><Play size={14} /> 启动</>}
                    </button>
                    <button className="btn-action" onClick={() => handleOperate(plugin, 'restart')} disabled={!!operating}><RotateCw size={14} /> 重启</button>
                    <button className="btn-action" onClick={() => setEditPlugin(plugin)}><Edit2 size={14} /> 编辑</button>
                    <button className="btn-action info" onClick={() => setLogsPlugin(plugin)}><FileText size={14} /> 日志</button>
                    <button className="btn-action danger" onClick={() => handleOperate(plugin, 'uninstall')} disabled={!!operating}><Trash2 size={14} /> 卸载</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <PluginEditDialog visible={!!editPlugin} plugin={editPlugin} project={project} onClose={() => setEditPlugin(null)} onSuccess={() => { setEditPlugin(null); onRefresh(); }} />
      <PluginLogsDialog visible={!!logsPlugin} plugin={logsPlugin} project={project} onClose={() => setLogsPlugin(null)} />

      <style>{`
        .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1100; }
        .plugin-drawer { position: fixed; top: 0; right: 0; width: 55%; min-width: 600px; height: 100%; background: var(--bg-color); z-index: 1101; display: flex; flex-direction: column; }
        .drawer-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
        .drawer-header h3 { margin: 0; font-size: 16px; color: var(--text-color); }
        .drawer-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); }
        .drawer-body { flex: 1; overflow: auto; padding: 20px; }
        .project-info-alert { padding: 12px 16px; background: rgba(24, 144, 255, 0.1); border: 1px solid rgba(24, 144, 255, 0.3); border-radius: 6px; margin-bottom: 20px; }
        .alert-title { font-size: 15px; font-weight: 500; color: var(--text-color); margin-bottom: 4px; }
        .alert-desc { font-size: 13px; color: var(--text-secondary); }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .section-title { font-size: 15px; font-weight: 500; color: var(--text-color); }
        .btn-sm { display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: var(--primary-color); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .btn-sm:disabled { opacity: 0.6; }
        .loading-state, .empty-state { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 40px; color: var(--text-secondary); }
        .plugin-list { display: flex; flex-direction: column; gap: 16px; }
        .plugin-card { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 20px; }
        .plugin-header { display: flex; gap: 12px; margin-bottom: 16px; }
        .plugin-icon { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: rgba(24, 144, 255, 0.1); border-radius: 8px; color: var(--primary-color); }
        .plugin-info { flex: 1; }
        .plugin-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .plugin-title { display: flex; align-items: center; gap: 8px; }
        .plugin-name { font-size: 16px; font-weight: 600; color: var(--text-color); }
        .plugin-version { font-size: 12px; color: var(--text-secondary); background: var(--bg-color); padding: 2px 8px; border-radius: 4px; }
        .update-tag { font-size: 10px; background: #ff4d4f; color: #fff; padding: 2px 6px; border-radius: 4px; }
        .btn-update { display: flex; align-items: center; gap: 4px; padding: 4px 8px; background: var(--primary-color); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .status-tag { padding: 2px 8px; border-radius: 4px; font-size: 12px; }
        .status-tag.success { color: #52c41a; background: rgba(82, 196, 26, 0.1); }
        .status-tag.default { color: var(--text-secondary); background: var(--bg-color); }
        .status-tag.danger { color: #ff4d4f; background: rgba(255, 77, 79, 0.1); }
        .plugin-meta { display: flex; flex-wrap: wrap; gap: 4px; font-size: 13px; color: var(--text-secondary); }
        .plugin-meta .sep { margin: 0 4px; color: var(--border-color); }
        .plugin-config { background: var(--bg-color); border-radius: 6px; padding: 12px; margin-bottom: 16px; }
        .config-header { font-weight: 600; font-size: 13px; margin-bottom: 12px; color: var(--text-color); }
        .config-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 8px; }
        .config-item { font-size: 12px; }
        .config-key { font-weight: 500; color: var(--text-secondary); margin-right: 4px; }
        .config-value { color: var(--text-color); font-family: monospace; }
        .plugin-actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .btn-action { display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 12px; color: var(--text-color); }
        .btn-action:hover { border-color: var(--primary-color); color: var(--primary-color); }
        .btn-action:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-action.success { color: #52c41a; }
        .btn-action.warning { color: #faad14; }
        .btn-action.info { color: var(--primary-color); }
        .btn-action.danger { color: #ff4d4f; }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </>
  );
};

export default PluginDrawer;
