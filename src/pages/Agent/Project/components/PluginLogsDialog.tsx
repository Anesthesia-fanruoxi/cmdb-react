/**
 * 插件日志对话框
 * 使用全局 modal 样式
 */

import { useState, useEffect, useRef } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { Project, Plugin } from '@/services/agent/project';

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

  // ESC 关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) handleClose();
    };
    if (visible) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [visible]);

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
      <div className="modal-overlay" onClick={handleClose} style={{ zIndex: 1200 }}>
        <div className="modal-content modal-xl" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>日志 - {plugin?.name}</h3>
            <button className="close-btn" onClick={handleClose}><X size={18} /></button>
          </div>
          <div className="modal-body" style={{ padding: 0 }}>
            <div className="pl-logs-container" ref={logRef}>
              {loading ? (
                <div className="pl-logs-state">连接中...</div>
              ) : logs.length > 0 ? (
                <div className="pl-logs-content">
                  {logs.map((line, index) => (
                    <div key={index} className="pl-log-line">{line}</div>
                  ))}
                </div>
              ) : (
                <div className="pl-logs-state">暂无日志信息</div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn-default" onClick={handleClose}>关闭</button>
            <button className="btn-primary" onClick={handleRefresh}><RefreshCw size={14} /> 刷新</button>
          </div>
        </div>
      </div>
      <style>{`
        .pl-logs-container { height: 65vh; overflow-y: auto; background: #1e2a2a; color: #008B45; font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; padding: 15px; }
        .pl-logs-state { color: var(--text-secondary); text-align: center; padding: 50px 0; font-size: 14px; }
        .pl-logs-content { height: 100%; }
        .pl-log-line { color: #008B45; line-height: 1.5; margin: 2px 0; white-space: pre-wrap; word-wrap: break-word; padding: 1px 4px; border-radius: 2px; }
        .pl-log-line:hover { background: rgba(0, 139, 69, 0.1); }
      `}</style>
    </>
  );
};

export default PluginLogsDialog;
