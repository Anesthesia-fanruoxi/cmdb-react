/**
 * AI调用记录详情对话框
 */

import { X } from 'lucide-react';
import type { AiCallLogItem } from '../../../../services/audit/audit';

interface Props {
  visible: boolean;
  data: AiCallLogItem | null;
  onClose: () => void;
}

const AiDetailDialog = ({ visible, data, onClose }: Props) => {
  if (!visible || !data) return null;

  const formatDateTime = (str: string) => str?.slice(0, 19).replace('T', ' ') || '-';
  const formatDuration = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms || 0}ms`);
  const formatLocation = () => {
    const parts = [data.country, data.region, data.city, data.district].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : '-';
  };
  const tables = (data.tables || '').split(',').map(t => t.trim()).filter(Boolean);

  return (
    <>
      <div className="dialog-overlay ai-detail-overlay" onClick={onClose} />
      <div className="dialog-container ai-detail-dialog">
        <div className="dialog-header">
          <h3>AI调用详情</h3>
          <button className="dialog-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="dialog-body">
          <div className="detail-grid">
            <div className="detail-item"><span className="label">记录ID</span><span className="value">{data.id}</span></div>
            <div className="detail-item"><span className="label">操作人</span><span className="value">{data.userName || '-'}</span></div>
            <div className="detail-item"><span className="label">项目</span><span className="value">{data.project || '-'}</span></div>
            <div className="detail-item"><span className="label">数据库</span><span className="value">{data.dbName || '-'}</span></div>
            <div className="detail-item"><span className="label">模型</span><span className="value"><span className="tag info">{data.model || '-'}</span></span></div>
            <div className="detail-item"><span className="label">状态</span><span className="value"><span className={`tag ${data.status === 'success' ? 'success' : 'danger'}`}>{data.status === 'success' ? '成功' : '失败'}</span></span></div>
            <div className="detail-item"><span className="label">来源</span><span className="value"><span className={`tag ${data.platform === 'desktop' ? 'success' : 'info'}`}>{data.platform === 'desktop' ? '客户端' : '浏览器'}</span></span></div>
            <div className="detail-item"><span className="label">耗时</span><span className="value"><span className={`tag ${data.duration >= 60000 ? 'warning' : 'success'}`}>{formatDuration(data.duration)}</span></span></div>
            <div className="detail-item"><span className="label">Token用量</span><span className="value">输入 {data.promptTokens || 0} / 输出 {data.completionTokens || 0} / 总计 {data.totalTokens || 0}</span></div>
            <div className="detail-item"><span className="label">客户端IP</span><span className="value">{data.clientIp || '-'}</span></div>
            <div className="detail-item"><span className="label">位置</span><span className="value">{formatLocation()}</span></div>
            <div className="detail-item"><span className="label">操作时间</span><span className="value">{formatDateTime(data.createdAt)}</span></div>
            <div className="detail-item full"><span className="label">关联表</span>
              <span className="value">
                {tables.length > 0
                  ? <span className="tag-list">{tables.map(t => <span key={t} className="tag info">{t}</span>)}</span>
                  : '-'}
              </span>
            </div>
            <div className="detail-item full"><span className="label">SQL语句</span><span className="value sql">{data.querySql || '-'}</span></div>
            <div className="detail-item full"><span className="label">错误信息</span><span className="value error">{data.errorMessage || '-'}</span></div>
          </div>
        </div>
      </div>
      <style>{`
        .ai-detail-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.6); z-index: 1100; backdrop-filter: blur(2px); }
        .ai-detail-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 800px; max-width: 90%; max-height: 80vh; background: var(--bg-color); border-radius: 8px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); border: 1px solid var(--border-color); z-index: 1101; display: flex; flex-direction: column; }
        .ai-detail-dialog .dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); background: var(--bg-secondary); }
        .ai-detail-dialog .dialog-header h3 { margin: 0; font-size: 16px; font-weight: 600; color: var(--text-color); }
        .ai-detail-dialog .dialog-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); padding: 4px; border-radius: 4px; transition: all 0.2s; }
        .ai-detail-dialog .dialog-close:hover { background: var(--bg-hover); color: var(--text-color); }
        .ai-detail-dialog .dialog-body { padding: 20px; overflow: auto; flex: 1; }
        .ai-detail-dialog .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid var(--border-color); border-radius: 4px; }
        .ai-detail-dialog .detail-item { display: flex; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); }
        .ai-detail-dialog .detail-item:nth-child(2n) { border-right: none; }
        .ai-detail-dialog .detail-item.full { grid-column: 1 / -1; border-right: none; }
        .ai-detail-dialog .detail-item:nth-last-child(1) { border-bottom: none; }
        .ai-detail-dialog .detail-item .label { width: 90px; padding: 10px 12px; background: var(--bg-secondary); color: var(--text-secondary); font-size: 13px; flex-shrink: 0; }
        .ai-detail-dialog .detail-item .value { flex: 1; padding: 10px 12px; color: var(--text-color); font-size: 13px; word-break: break-all; }
        .ai-detail-dialog .detail-item .value.sql { font-family: monospace; background: var(--bg-secondary); white-space: pre-wrap; }
        .ai-detail-dialog .detail-item .value.error { color: #ff4d4f; }
        .ai-detail-dialog .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
        .ai-detail-dialog .tag.success { background: rgba(82, 196, 26, 0.1); color: #52c41a; }
        .ai-detail-dialog .tag.warning { background: rgba(250, 173, 20, 0.1); color: #faad14; }
        .ai-detail-dialog .tag.danger { background: rgba(255, 77, 79, 0.1); color: #ff4d4f; }
        .ai-detail-dialog .tag.info { background: var(--bg-secondary); color: var(--text-secondary); }
        .ai-detail-dialog .tag-list { display: inline-flex; flex-wrap: wrap; gap: 6px; }
      `}</style>
    </>
  );
};

export default AiDetailDialog;
