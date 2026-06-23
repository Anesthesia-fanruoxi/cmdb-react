/**
 * ES审计详情对话框
 */

import { useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';

interface Props {
  visible: boolean;
  loading?: boolean;
  data: any;
  operations: any[];
  onClose: () => void;
}

const DetailDialog = ({ visible, loading, data, operations, onClose }: Props) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) onClose();
    };
    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [visible, onClose]);

  if (!visible || (!loading && !data)) return null;

  const formatDateTime = (str: string) => str?.slice(0, 19).replace('T', ' ') || '-';
  const formatLocation = (row: any) => row?.city || row?.region || row?.country || '未知';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>查询详情</h3>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="es-loading"><Loader2 size={24} className="es-spin" /> 加载中...</div>
          ) : (
          <>
          <div className="es-detail-grid">
            <div className="es-detail-item"><span className="es-label">用户昵称</span><span className="es-value">{data.nick_name || '-'}</span></div>
            <div className="es-detail-item"><span className="es-label">客户端IP</span><span className="es-value">{data.client_ip || '-'}</span></div>
            <div className="es-detail-item"><span className="es-label">运营商</span><span className="es-value">{data.district || '-'}</span></div>
            <div className="es-detail-item"><span className="es-label">地区</span><span className="es-value">{formatLocation(data)}</span></div>
            <div className="es-detail-item"><span className="es-label">项目名称</span><span className="es-value">{data.project_name || '-'}</span></div>
            <div className="es-detail-item"><span className="es-label">视图名称</span><span className="es-value">{data.view_name || '-'}</span></div>
            <div className="es-detail-item"><span className="es-label">页码</span><span className="es-value">{data.page || 1}</span></div>
            <div className="es-detail-item"><span className="es-label">索引模式</span><span className="es-value">{data.q_index_pattern || '-'}</span></div>
            <div className="es-detail-item"><span className="es-label">时间字段</span><span className="es-value">{data.q_time_field || '-'}</span></div>
            <div className="es-detail-item"><span className="es-label">开始时间</span><span className="es-value">{formatDateTime(data.q_start_time)}</span></div>
            <div className="es-detail-item"><span className="es-label">结束时间</span><span className="es-value">{formatDateTime(data.q_end_time)}</span></div>
            <div className="es-detail-item"><span className="es-label">关键词</span><span className="es-value">{data.keyword || '-'}</span></div>
            <div className="es-detail-item"><span className="es-label">查询ID</span><span className="es-value">{data.query_id || '-'}</span></div>
            <div className="es-detail-item"><span className="es-label">查询耗时</span><span className="es-value"><span className={`tag ${data.query_time_ms > 1000 ? 'tag-warning' : 'tag-success'}`}>{data.query_time_ms}ms</span></span></div>
            <div className="es-detail-item"><span className="es-label">文档数量</span><span className="es-value"><span className="tag tag-info">{data.doc_count}</span></span></div>
            <div className="es-detail-item"><span className="es-label">状态码</span><span className="es-value"><span className={`tag ${data.response_code === 200 ? 'tag-success' : 'tag-danger'}`}>{data.response_code}</span></span></div>
            <div className="es-detail-item"><span className="es-label">操作时间</span><span className="es-value">{formatDateTime(data.search_time)}</span></div>
            <div className="es-detail-item full"><span className="es-label">错误信息</span><span className="es-value error-text">{data.error_message || '-'}</span></div>
          </div>

          {operations.length > 0 && (
            <div className="es-ops-section">
              <h4>关联操作记录 ({operations.length}条)</h4>
              <table className="es-ops-table">
                <thead>
                  <tr><th>操作类型</th><th>操作用户</th><th>页码</th><th>查询耗时</th><th>文档数量</th><th>操作时间</th></tr>
                </thead>
                <tbody>
                  {operations.map((op, idx) => (
                    <tr key={idx}>
                      <td><span className={`tag ${op.operation === 'export' ? 'tag-warning' : op.operation === 'analysis' ? 'tag-success' : 'tag-info'}`}>
                        {op.operation === 'export' ? '导出' : op.operation === 'page' ? '翻页' : op.operation === 'analysis' ? '分析' : op.operation}
                      </span></td>
                      <td>{op.nick_name}</td>
                      <td><span className="tag tag-info">{op.page}</span></td>
                      <td><span className={`tag ${op.query_time_ms > 1000 ? 'tag-warning' : 'tag-success'}`}>{op.query_time_ms}ms</span></td>
                      <td><span className="tag tag-info">{op.doc_count}</span></td>
                      <td>{formatDateTime(op.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </>
          )}
        </div>
      </div>
      <style>{`
        .es-detail-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden; }
        .es-detail-item { display: flex; border-bottom: 1px solid var(--border-color); }
        .es-detail-item:nth-last-child(-n+2) { border-bottom: none; }
        .es-detail-item.full { grid-column: 1 / -1; }
        .es-detail-item .es-label { width: 100px; padding: 10px 12px; background: var(--bg-secondary); color: var(--text-secondary); font-size: 13px; flex-shrink: 0; }
        .es-detail-item .es-value { flex: 1; padding: 10px 12px; color: var(--text-color); font-size: 13px; word-break: break-all; }
        .es-detail-item .es-value.error-text { color: #ff4d4f; }
        .es-ops-section { margin-top: 20px; }
        .es-ops-section h4 { font-size: 14px; font-weight: 500; color: var(--text-color); margin-bottom: 12px; padding-top: 12px; border-top: 1px solid var(--border-color); }
        .es-ops-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .es-ops-table th, .es-ops-table td { padding: 10px 12px; text-align: left; border: 1px solid var(--border-color); }
        .es-ops-table th { background: var(--bg-secondary); font-weight: 500; color: var(--text-color); }
        .es-ops-table td { color: var(--text-secondary); }
        .es-loading { display: flex; align-items: center; justify-content: center; gap: 8px; height: 200px; color: var(--text-secondary); }
        .es-spin { animation: es-spin 1s linear infinite; }
        @keyframes es-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default DetailDialog;
