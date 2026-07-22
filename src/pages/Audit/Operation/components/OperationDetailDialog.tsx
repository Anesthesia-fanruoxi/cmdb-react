/**
 * 操作详情弹框
 */

import { useEffect } from 'react';
import { OperationLogItem } from '../../../../services/audit';

interface Props {
  visible: boolean;
  data: OperationLogItem | null;
  onClose: () => void;
}

const formatJson = (str?: string) => {
  if (!str) return '';
  try {
    const obj = typeof str === 'string' ? JSON.parse(str) : str;
    return JSON.stringify(obj, null, 2);
  } catch { return str; }
};

const OperationDetailDialog = ({ visible, data, onClose }: Props) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) onClose();
    };
    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [visible, onClose]);

  if (!visible || !data) return null;

  return (
    <>
      <div className="dialog-overlay operation-detail-overlay" onClick={onClose} />
      <div className="operation-detail-dialog">
        <div className="dialog-header"><h3>操作详情</h3></div>
        <div className="dialog-body">
          <div className="detail-table">
            <div className="detail-row"><span className="label">用户名</span><span>{data.userName}</span></div>
            <div className="detail-row"><span className="label">用户ID</span><span>{data.userId}</span></div>
            <div className="detail-row"><span className="label">操作模块</span><span>{data.module}</span></div>
            <div className="detail-row"><span className="label">操作类型</span><span>{data.action}</span></div>
            <div className="detail-row"><span className="label">请求方法</span><span>{data.method}</span></div>
            <div className="detail-row"><span className="label">请求URL</span><span>{data.url}</span></div>
            <div className="detail-row"><span className="label">操作IP</span><span>{data.ip}</span></div>
            <div className="detail-row"><span className="label">执行时长</span><span>{data.duration}ms</span></div>
            <div className="detail-row"><span className="label">操作时间</span><span>{data.createdAt}</span></div>
          </div>

          <div className="detail-section">
            <div className="section-title">请求参数</div>
            <pre className="code-block">{formatJson(data.request) || '无'}</pre>
          </div>

          <div className="detail-section">
            <div className="section-title">响应结果</div>
            <pre className="code-block">{formatJson(data.response) || '无'}</pre>
          </div>

          {data.errorMsg && (
            <div className="detail-section">
              <div className="section-title">错误信息</div>
              <pre className="code-block error">{data.errorMsg}</pre>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .operation-detail-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1100; cursor: pointer; }
        .operation-detail-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 800px; max-width: 90%; max-height: 80vh; background: var(--bg-color); border-radius: 8px; z-index: 1101; border: 1px solid var(--border-color); box-shadow: 0 8px 24px rgba(0,0,0,0.15); display: flex; flex-direction: column; }
        .operation-detail-dialog .dialog-header { padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
        .operation-detail-dialog .dialog-header h3 { margin: 0; font-size: 16px; color: var(--text-color); }
        .operation-detail-dialog .dialog-body { padding: 20px; overflow: auto; flex: 1; }
        .operation-detail-dialog .detail-table { border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden; margin-bottom: 20px; }
        .operation-detail-dialog .detail-row { display: flex; border-bottom: 1px solid var(--border-color); }
        .operation-detail-dialog .detail-row:last-child { border-bottom: none; }
        .operation-detail-dialog .detail-row .label { width: 100px; padding: 10px 12px; background: var(--bg-secondary); color: var(--text-secondary); font-size: 13px; flex-shrink: 0; }
        .operation-detail-dialog .detail-row span:last-child { flex: 1; padding: 10px 12px; color: var(--text-color); font-size: 13px; word-break: break-all; }
        .operation-detail-dialog .detail-section { margin-bottom: 16px; }
        .operation-detail-dialog .section-title { font-weight: 500; margin-bottom: 8px; color: var(--text-color); font-size: 14px; }
        .operation-detail-dialog .code-block { margin: 0; padding: 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 12px; font-family: 'Courier New', monospace; color: var(--text-color); max-height: 200px; overflow: auto; white-space: pre-wrap; word-break: break-all; }
        .operation-detail-dialog .code-block.error { background: rgba(255, 77, 79, 0.1); border-left: 3px solid #ff4d4f; }
      `}</style>
    </>
  );
};

export default OperationDetailDialog;
