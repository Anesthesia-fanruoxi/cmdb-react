/**
 * 日志查看器弹框 - 使用 WebSocket 实时获取日志
 */

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface StepInfo {
  step: number;
  step_name: string;
  step_type?: string;
  step_status: string;
}

interface TaskInfo {
  task_id?: string;
  id?: number;
  type?: string;
  project?: string;
}

interface Props {
  visible: boolean;
  logStep: StepInfo | null;
  taskInfo: TaskInfo | null;
  projectDetail: { project?: string; type?: string } | null;
  onClose: () => void;
}

const LogViewerDialog = ({ visible, logStep, taskInfo, projectDetail, onClose }: Props) => {
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const logContentRef = useRef<HTMLDivElement>(null);
  const maxLogMessages = 500;

  useEffect(() => {
    if (visible && logStep && taskInfo) {
      connectWS();
    } else {
      disconnectWS();
      setLogMessages([]);
    }
    return () => disconnectWS();
  }, [visible, logStep, taskInfo]);

  // ESC 键关闭
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  // 自动滚动到底部
  useEffect(() => {
    if (logContentRef.current) {
      logContentRef.current.scrollTop = logContentRef.current.scrollHeight;
    }
  }, [logMessages]);

  const connectWS = () => {
    if (wsRef.current) disconnectWS();
    if (!logStep || !taskInfo) return;

    const taskId = taskInfo.task_id || String(taskInfo.id);
    // step_type 可能是字符串类型的步骤标识，如果没有则使用 step_name
    const stepType = logStep.step_type || logStep.step_name || '';
    const project = taskInfo.project || projectDetail?.project || '';
    let type = taskInfo.type || projectDetail?.type || '';
    if (type === '前端') type = 'web';
    else if (type === '后端') type = 'default';

    if (!taskId || !stepType) return;

    // 构建 WebSocket URL
    // Tauri 桌面应用中 location.host 不是后端地址，需要从 API URL 提取
    let wsUrl: string;
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    
    if (apiBaseUrl) {
      // 从 API URL 提取主机地址，如 https://cmdb.hzbxhd.com/api -> wss://cmdb.hzbxhd.com
      const apiUrl = new URL(apiBaseUrl);
      const wsProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${wsProtocol}//${apiUrl.host}/ws/assets/proUpdate/logs?task_id=${encodeURIComponent(taskId)}&step_type=${encodeURIComponent(stepType)}&project=${encodeURIComponent(project)}&type=${encodeURIComponent(type)}`;
    } else {
      // 开发环境 fallback
      const wsBase = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080';
      wsUrl = `${wsBase}/ws/assets/proUpdate/logs?task_id=${encodeURIComponent(taskId)}&step_type=${encodeURIComponent(stepType)}&project=${encodeURIComponent(project)}&type=${encodeURIComponent(type)}`;
    }

    try {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => setConnected(true);
      ws.onmessage = (event) => {
        setLogMessages(prev => {
          const newLogs = [...prev, event.data];
          return newLogs.length > maxLogMessages ? newLogs.slice(-maxLogMessages) : newLogs;
        });
      };
      ws.onclose = () => setConnected(false);
      ws.onerror = () => setConnected(false);
      wsRef.current = ws;
    } catch (err) {
      console.error('WebSocket 连接失败:', err);
    }
  };

  const disconnectWS = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  };

  if (!visible) return null;

  return (
    <>
      <div className="log-dialog-overlay" onClick={onClose} />
      <div className="log-dialog-container">
        <div className="log-dialog-header">
          <h3>{logStep?.step_name || ''} - 日志详情</h3>
          <div className="header-right">
            <span className={`ws-status ${connected ? 'connected' : ''}`}>{connected ? '已连接' : '未连接'}</span>
            <button className="dialog-close" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <div className="log-dialog-body">
          <div className="log-content" ref={logContentRef}>
            {logMessages.length > 0 ? (
              logMessages.map((msg, i) => <div key={i} className="log-line">{msg}</div>)
            ) : (
              <div className="no-logs">暂无日志信息</div>
            )}
          </div>
        </div>
        <div className="log-dialog-footer">
          <button className="btn-default" onClick={onClose}>关闭</button>
        </div>
      </div>
      <style>{`
        .log-dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1200; }
        .log-dialog-container { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%; max-width: 1000px; height: 600px; background: var(--bg-color, #fff); border-radius: 8px; z-index: 1201; display: flex; flex-direction: column; box-shadow: 0 8px 40px rgba(0,0,0,0.25); }
        .log-dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-bottom: 1px solid var(--border-color, #e8e8e8); }
        .log-dialog-header h3 { margin: 0; font-size: 16px; }
        .header-right { display: flex; align-items: center; gap: 12px; }
        .ws-status { font-size: 12px; padding: 2px 8px; border-radius: 10px; background: #f0f0f0; color: #999; }
        .ws-status.connected { background: #f6ffed; color: #52c41a; }
        .dialog-close { background: none; border: none; cursor: pointer; color: var(--text-secondary, #666); }
        .log-dialog-body { flex: 1; padding: 16px; overflow: hidden; }
        .log-content { height: 100%; background: #2F4F4F; color: #008B45; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 12px; padding: 15px; border-radius: 4px; overflow-y: auto; border: 1px solid #4a6741; }
        .log-line { margin: 2px 0; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; }
        .no-logs { color: #B0C4DE; text-align: center; padding: 50px 0; font-size: 14px; }
        .log-dialog-footer { display: flex; justify-content: flex-end; padding: 12px 20px; border-top: 1px solid var(--border-color, #e8e8e8); }
        .btn-default { padding: 6px 16px; border: 1px solid var(--border-color, #d9d9d9); background: var(--bg-secondary, #2a2a2a); color: var(--text-color, #e0e0e0); border-radius: 4px; cursor: pointer; }
      `}</style>
    </>
  );
};

export default LogViewerDialog;