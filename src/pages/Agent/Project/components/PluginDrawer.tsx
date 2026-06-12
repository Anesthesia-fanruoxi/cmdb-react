/**
 * 插件管理抽屉
 */

import { useState } from 'react';
import { X, RefreshCw, Loader2, Box, Play, Pause, RotateCw, Edit2, FileText, Trash2, Upload, ChevronDown, ChevronRight } from 'lucide-react';
import { controlPlugin, upgradePlugin, Project, Plugin, ProjectDetail } from '@/services/agent/project.ts';
import toast from '../../../../components/Toast';
import { confirm } from '@/components/ConfirmModal';
import PluginEditDialog from './PluginEditDialog';
import PluginLogsDialog from './PluginLogsDialog';
import './PluginDrawer.css';

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
  const [expandedConfigs, setExpandedConfigs] = useState<Record<string, boolean>>({});

  const toggleConfig = (name: string) => {
    setExpandedConfigs(prev => ({ ...prev, [name]: !prev[name] }));
  };

  // 抽屉关闭时重置状态
  const handleClose = () => {
    setEditPlugin(null);
    setLogsPlugin(null);
    onClose();
  };

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

  const handleOperate = async (plugin: Plugin, action: 'start' | 'stop' | 'restart' | 'uninstall') => {
    if (!project) return;
    const actionText: Record<string, string> = { start: '启动', stop: '停止', restart: '重启', uninstall: '卸载' };
    if (action === 'uninstall') {
      const ok = await confirm({ title: '卸载插件', content: `确定要卸载插件 "${plugin.name}" 吗？`, type: 'danger' });
      if (!ok) return;
    }

    setOperating(`${plugin.name}-${action}`);
    try {
      const res = await controlPlugin({ project: project.project, name: plugin.name, action });
      if (res.code === 200) {
        toast.success(`${actionText[action]}成功`);
        onRefresh();
      } else { toast.error(res.message || `${actionText[action]}失败`); }
    } catch (err: any) {
      console.error('操作失败:', err);
      toast.error(err?.message || `${actionText[action]}失败`);
    } finally { setOperating(null); }
  };

  const handleUpgrade = async (plugin: Plugin) => {
    if (!project) return;
    const ok = await confirm({ title: '更新插件', content: `确定要更新插件 "${plugin.name}" 到最新版本吗？`, type: 'info' });
    if (!ok) return;
    setOperating(`${plugin.name}-update`);
    try {
      const res = await upgradePlugin({ project: project.project, name: plugin.name });
      if (res.code === 200) {
        toast.success('更新成功');
        onRefresh();
      } else { toast.error(res.message || '更新失败'); }
    } catch (err: any) {
      console.error('更新失败:', err);
      toast.error(err?.message || '更新失败');
    } finally { setOperating(null); }
  };

  if (!visible) return null;

  const plugins = detail?.plugins || [];

  return (
    <>
      <div className="plugin-drawer-overlay" onClick={handleClose} />
      <div className="plugin-drawer">
        <div className="drawer-header">
          <h3>{project?.project_name || ''} - 插件管理</h3>
          <button className="drawer-close" onClick={handleClose}><X size={18} /></button>
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
                              <button className="btn-update" onClick={() => handleUpgrade(plugin)}>
                                <Upload size={12} /> 更新
                              </button>
                            </>
                          )}
                        </div>
                        <span className={`status-tag ${getStatusClass(plugin.status)}`}>{getStatusText(plugin.status)}</span>
                      </div>
                      <div className="plugin-meta">
                        <span>{getCategoryText(plugin.category)}</span>
                        {plugin.host_port != null && (
                          <><span className="sep">|</span><span>宿主机端口: {plugin.host_port}</span></>
                        )}
                        {plugin.category === 'container' && plugin.container_port != null && (
                          <><span className="sep">|</span><span>容器端口: {plugin.container_port}</span></>
                        )}
                        <span className="sep">|</span><span>运行: {plugin.uptime || '-'}</span>
                        <span className="sep">|</span><span>{formatTime(plugin.installed_at)}</span>
                      </div>
                    </div>
                  </div>

                  {plugin.config && Object.keys(plugin.config).length > 0 && (
                    <div className="plugin-config">
                      <div className="config-header" onClick={() => toggleConfig(plugin.name)}>
                        {expandedConfigs[plugin.name] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span>配置信息 ({Object.keys(plugin.config).length})</span>
                      </div>
                      {expandedConfigs[plugin.name] && (
                        <div className="config-list">
                          {Object.entries(plugin.config).map(([key, value]) => (
                            <div key={key} className="config-item"><span className="config-key">{key}:</span><span className="config-value">{value}</span></div>
                          ))}
                        </div>
                      )}
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
    </>
  );
};

export default PluginDrawer;
