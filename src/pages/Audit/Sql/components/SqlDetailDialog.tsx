/**
 * SQL审计详情对话框
 */

import { X } from 'lucide-react';

interface Props {
  visible: boolean;
  data: any;
  operations: any[];
  onClose: () => void;
}

const SqlDetailDialog = ({ visible, data, operations, onClose }: Props) => {
  if (!visible || !data) return null;

  const formatDateTime = (str: string) => str?.slice(0, 19).replace('T', ' ') || '-';
  const formatLocation = (row: any) => row?.city || row?.region || row?.country || '未知';

  return (
    <>
      <div className="dialog-overlay" onClick={onClose} />
      <div className="dialog-container sql-detail-dialog">
        <div className="dialog-header">
          <h3>SQL详情</h3>
          <button className="dialog-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="dialog-body">
          <div className="detail-grid">
            <div className="detail-item"><span className="label">用户昵称</span><span className="value">{data.nick_name || '-'}</span></div>
            <div className="detail-item"><span className="label">客户端IP</span><span className="value">{data.client_ip || '-'}</span></div>
            <div className="detail-item"><span className="label">运营商</span><span className="value">{data.district || '-'}</span></div>
            <div className="detail-item"><span className="label">地区</span><span className="value">{formatLocation(data)}</span></div>
            <div className="detail-item"><span className="label">数据库</span><span className="value">{data.db_name || '-'}</span></div>
            <div className="detail-item"><span className="label">来源</span><span className="value"><span className={`tag ${data.platform === 'desktop' ? 'success' : 'info'}`}>{data.platform === 'desktop' ? '客户端' : '浏览器'}</span></span></div>
            <div className="detail-item"><span className="label">页码</span><span className="value">{data.Page || data.page || '-'}</span></div>
            <div className="detail-item"><span className="label">查询ID</span><span className="value">{data.query_id || '-'}</span></div>
            <div className="detail-item full"><span className="label">SQL语句</span><span className="value sql">{data.query_sql || '-'}</span></div>
            <div className="detail-item"><span className="label">执行耗时</span><span className="value"><span className={`tag ${data.execution_time > 1000 ? 'warning' : 'success'}`}>{data.execution_time || 0}ms</span></span></div>
            <div className="detail-item"><span className="label">影响行数</span><span className="value"><span className="tag info">{data.affected_rows || 0}</span></span></div>
            <div className="detail-item"><span className="label">状态</span><span className="value"><span className={`tag ${data.status === 'success' ? 'success' : 'danger'}`}>{data.status === 'success' ? '成功' : '失败'}</span></span></div>
            <div className="detail-item"><span className="label">操作时间</span><span className="value">{formatDateTime(data.created_at)}</span></div>
            <div className="detail-item full"><span className="label">错误信息</span><span className="value error">{data.error_message || '-'}</span></div>
          </div>

          {operations.length > 0 && (
            <div className="operations-section">
              <h4>关联操作记录 ({operations.length}条)</h4>
              <table className="ops-table">
                <thead>
                  <tr><th>操作类型</th><th>操作用户</th><th>页码</th><th>执行耗时</th><th>影响行数</th><th>状态</th><th>操作时间</th></tr>
                </thead>
                <tbody>
                  {operations.map((op, idx) => (
                    <tr key={idx}>
                      <td><span className={`tag ${op.Operation === 'export' ? 'warning' : 'info'}`}>
                        {op.Operation === 'export' ? '导出' : op.Operation === 'page' ? '翻页' : '查询'}
                      </span></td>
                      <td>{op.nick_name}</td>
                      <td><span className="tag info">{op.Page || 1}</span></td>
                      <td><span className={`tag ${op.execution_time > 1000 ? 'warning' : 'success'}`}>{op.execution_time}ms</span></td>
                      <td><span className="tag info">{op.affected_rows}</span></td>
                      <td><span className={`tag ${op.status === 'success' ? 'success' : 'danger'}`}>{op.status === 'success' ? '成功' : '失败'}</span></td>
                      <td>{formatDateTime(op.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .sql-detail-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 800px; max-width: 90%; max-height: 80vh; background: var(--bg-color); border-radius: 8px; z-index: 1101; display: flex; flex-direction: column; }
        .dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
        .dialog-header h3 { margin: 0; font-size: 16px; color: var(--text-color); }
        .dialog-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); }
        .dialog-body { padding: 20px; overflow: auto; flex: 1; }
        .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid var(--border-color); border-radius: 4px; }
        .detail-item { display: flex; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); }
        .detail-item:nth-child(2n) { border-right: none; }
        .detail-item.full { grid-column: 1 / -1; border-right: none; }
        .detail-item:nth-last-child(1) { border-bottom: none; }
        .detail-item .label { width: 90px; padding: 10px 12px; background: var(--bg-secondary); color: var(--text-secondary); font-size: 13px; flex-shrink: 0; }
        .detail-item .value { flex: 1; padding: 10px 12px; color: var(--text-color); font-size: 13px; word-break: break-all; }
        .detail-item .value.sql { font-family: monospace; background: var(--bg-secondary); white-space: pre-wrap; }
        .detail-item .value.error { color: #ff4d4f; }
        .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
        .tag.success { background: rgba(82, 196, 26, 0.1); color: #52c41a; }
        .tag.warning { background: rgba(250, 173, 20, 0.1); color: #faad14; }
        .tag.danger { background: rgba(255, 77, 79, 0.1); color: #ff4d4f; }
        .tag.info { background: var(--bg-secondary); color: var(--text-secondary); }
        .operations-section { margin-top: 20px; }
        .operations-section h4 { font-size: 14px; font-weight: 500; color: var(--text-color); margin-bottom: 12px; padding-top: 12px; border-top: 1px solid var(--border-color); }
        .ops-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .ops-table th, .ops-table td { padding: 10px 12px; text-align: left; border: 1px solid var(--border-color); }
        .ops-table th { background: var(--bg-secondary); font-weight: 500; color: var(--text-color); }
        .ops-table td { color: var(--text-secondary); }
      `}</style>
    </>
  );
};

export default SqlDetailDialog;
