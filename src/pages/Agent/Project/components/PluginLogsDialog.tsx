/**
 * 插件日志对话框
 */

import { useState, useEffect, useRef } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { Project, Plugin } from '../../../../services/agent/project';

interface Props {
  visible: boolean;
  plugin: Plugin | null;
  project: Project | null;
  onClose: () => void;
}

const PluginLogsDialog = ({ visible, plugin, project, onClose }: Props) => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connectWebSocket = () => {
    if (!project || !plugin) return;
    
    setLoading(true);
    setLogs([]);

    // 构建 WebSocket URL - 从 API URL 提取主机地址
    let wsUrl: string;
    const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL;
    
    if (wsBaseUrl) {
      // 使用配置的 WebSocket 地址
      wsUrl = `${wsBaseUrl}/agent/project/logs?project=${encodeURIComponent(project.project)}&name=${encodeURIComponent(plugin.name)}`;
    } else {
      // Fallback: 从 API URL 提取主机地址
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      if (apiBaseUrl) {
        const apiUrl = new URL(apiBaseUrl);
        const wsProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${wsProtocol}//${apiUrl.host}/ws/agent/project/logs?project=${encodeURIComponent(project.project)}&name=${encodeURIComponent(plugin.name)}`;
      } else {
        // 开发环境 fallback
        wsUrl = `ws://localhost:8080/ws/agent/project/logs?project=${encodeURIComponent(project.project)}&name=${encodeURIComponent(plugin.name)}`;
      }
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setLoading(false);
    ws.onmessage = (event) => {
      setLogs(prev => [...prev, event.data]);
      setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 0);
    };
    ws.onerror = () => setLoading(false);
    ws.onclose = () => setLoading(false);
  };

  const closeWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  useEffect(() => {
    if (visible && project && plugin) {
      connectWebSocket();
    }
    return () => closeWebSocket();
  }, [visible, project, plugin]);

  const handleRefresh = () => {
    closeWebSocket();
    connectWebSocket();
  };

  const handleClose = () => {
    closeWebSocket();
    onClose();
  };

  if (!visible) return null;

  return (
    <>
      <div className="dialog-overlay" onClick={handleClose} style={{ zIndex: 1200 }} />
      <div className="dialog-container logs-dialog">
        <div className="dialog-header">
          <h3>容器日志 - {plugin?.name}</h3>
          <button className="dialog-close" onClick={handleClose}><X size={18} /></button>
        </div>
        <div className="dialog-body">
          <div className="logs-container" ref={logRef}>
            {loading ? (
              <div className="logs-loading">连接中...</div>
            ) : logs.length > 0 ? (
              <div className="logs-content">
                {logs.map((line, index) => (
                  <div key={index} className="log-line">{line}</div>
                ))}
              </div>
            ) : (
              <div className="logs-empty">暂无日志信息</div>
            )}
          </div>
        </div>
        <div className="dialog-footer">
          <button className="btn-default" onClick={handleClose}>关闭</button>
          <button className="btn-primary" onClick={handleRefresh}><RefreshCw size={14} /> 刷新</button>
        </div>
      </div>
      <style>{`
        .logs-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%; max-width: 1000px; background: var(--bg-color); border-radius: 8px; z-index: 1201; }
        .dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
        .dialog-header h3 { margin: 0; font-size: 16px; color: var(--text-color); }
        .dialog-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); }
        .dialog-body { padding: 20px; }
        .dialog-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border-color); }
        .logs-container { height: 500px; overflow-y: auto; background: #2F4F4F; color: #008B45; font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; border-radius: 4px; padding: 15px; border: 1px solid #4a6741; }
        .logs-loading, .logs-empty { color: var(--text-secondary); text-align: center; padding: 50px 0; font-size: 14px; }
        .logs-content { height: 100%; }
        .log-line { color: #008B45; line-height: 1.4; margin: 2px 0; white-space: pre-wrap; word-wrap: break-word; }
        .log-line:hover { background: rgba(0, 139, 69, 0.1); }
        .btn-default, .btn-primary { display: flex; align-items: center; gap: 4px; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; }
        .btn-default { background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-color); }
        .btn-primary { background: var(--primary-color); border: none; color: #fff; }
      `}</style>
    </>
  );
};

export default PluginLogsDialog;
