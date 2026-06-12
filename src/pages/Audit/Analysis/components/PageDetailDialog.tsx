/**
 * 翻页统计详情弹框
 */

import { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { getSqlDetail, getSearchDetail } from '../../../../services/audit/audit';

interface Props {
  visible: boolean;
  type: 'sql' | 'es';
  queryId: string;
  onClose: () => void;
}

const PageDetailDialog = ({ visible, type, queryId, onClose }: Props) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [operations, setOperations] = useState<any[]>([]);

  useEffect(() => {
    if (visible && queryId) fetchDetail();
  }, [visible, queryId]);

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = type === 'sql' 
        ? await getSqlDetail({ query_id: queryId })
        : await getSearchDetail({ query_id: queryId });
      if (res.code === 200 && res.data) {
        const resData = res.data as { search_detail?: any; page_operations?: any[] };
        setData(resData.search_detail || {});
        setOperations(resData.page_operations || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const formatDateTime = (str: string) => str?.slice(0, 19).replace('T', ' ') || '-';
  const formatLocation = (row: any) => row?.city || row?.region || row?.country || '未知';

  if (!visible) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{type === 'sql' ? 'SQL' : 'ES'} 查询详情</h3>
            <button className="close-btn" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="modal-body">
          {loading ? (
            <div className="pd-loading"><Loader2 size={24} className="pd-spin" /> 加载中...</div>
          ) : type === 'sql' ? (
            /* SQL详情 */
            <>
            <div className="page-detail-grid">
                <div className="page-detail-item"><span className="pd-label">用户昵称</span><span className="pd-value">{data?.nick_name || '-'}</span></div>
                <div className="page-detail-item"><span className="pd-label">客户端IP</span><span className="pd-value">{data?.client_ip || '-'}</span></div>
                <div className="page-detail-item"><span className="pd-label">地区</span><span className="pd-value">{formatLocation(data)}</span></div>
                <div className="page-detail-item"><span className="pd-label">数据库</span><span className="pd-value">{data?.db_name || '-'}</span></div>
                <div className="page-detail-item"><span className="pd-label">页码</span><span className="pd-value">{data?.Page || data?.page || '-'}</span></div>
                <div className="page-detail-item"><span className="pd-label">查询ID</span><span className="pd-value">{data?.query_id || '-'}</span></div>
                <div className="page-detail-item full"><span className="pd-label">SQL语句</span><span className="pd-value sql-text">{data?.query_sql || '-'}</span></div>
                <div className="page-detail-item"><span className="pd-label">执行耗时</span><span className="pd-value"><span className={`page-detail-tag ${data?.execution_time > 1000 ? 'warning' : 'success'}`}>{data?.execution_time || 0}ms</span></span></div>
                <div className="page-detail-item"><span className="pd-label">影响行数</span><span className="pd-value"><span className="page-detail-tag info">{data?.affected_rows || 0}</span></span></div>
                <div className="page-detail-item"><span className="pd-label">状态</span><span className="pd-value"><span className={`page-detail-tag ${data?.status === 'success' ? 'success' : 'danger'}`}>{data?.status === 'success' ? '成功' : '失败'}</span></span></div>
                <div className="page-detail-item"><span className="pd-label">操作时间</span><span className="pd-value">{formatDateTime(data?.created_at)}</span></div>
              </div>
              {operations.length > 0 && (
                <div className="page-ops-section">
                  <h4>关联操作记录 ({operations.length}条)</h4>
                  <table className="page-ops-table">
                    <thead><tr><th>操作类型</th><th>用户</th><th>页码</th><th>耗时</th><th>影响行数</th><th>状态</th><th>时间</th></tr></thead>
                    <tbody>
                      {operations.map((op, idx) => (
                        <tr key={idx}>
                          <td><span className={`page-detail-tag ${op.Operation === 'export' ? 'warning' : 'info'}`}>{op.Operation === 'export' ? '导出' : op.Operation === 'page' ? '翻页' : '查询'}</span></td>
                          <td>{op.nick_name}</td>
                          <td><span className="page-detail-tag info">{op.Page || 1}</span></td>
                          <td><span className={`page-detail-tag ${op.execution_time > 1000 ? 'warning' : 'success'}`}>{op.execution_time}ms</span></td>
                          <td><span className="page-detail-tag info">{op.affected_rows}</span></td>
                          <td><span className={`page-detail-tag ${op.status === 'success' ? 'success' : 'danger'}`}>{op.status === 'success' ? '成功' : '失败'}</span></td>
                          <td>{formatDateTime(op.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            /* ES详情 */
            <>
              <div className="page-detail-grid">
                <div className="page-detail-item"><span className="pd-label">用户昵称</span><span className="pd-value">{data?.nick_name || '-'}</span></div>
                <div className="page-detail-item"><span className="pd-label">客户端IP</span><span className="pd-value">{data?.client_ip || '-'}</span></div>
                <div className="page-detail-item"><span className="pd-label">地区</span><span className="pd-value">{formatLocation(data)}</span></div>
                <div className="page-detail-item"><span className="pd-label">项目名称</span><span className="pd-value">{data?.project_name || '-'}</span></div>
                <div className="page-detail-item"><span className="pd-label">视图名称</span><span className="pd-value">{data?.view_name || '-'}</span></div>
                <div className="page-detail-item"><span className="pd-label">页码</span><span className="pd-value">{data?.page || '-'}</span></div>
                <div className="page-detail-item"><span className="pd-label">索引模式</span><span className="pd-value">{data?.q_index_pattern || '-'}</span></div>
                <div className="page-detail-item"><span className="pd-label">时间字段</span><span className="pd-value">{data?.q_time_field || '-'}</span></div>
                <div className="page-detail-item"><span className="pd-label">关键词</span><span className="pd-value">{data?.keyword || '-'}</span></div>
                <div className="page-detail-item"><span className="pd-label">查询ID</span><span className="pd-value">{data?.query_id || '-'}</span></div>
                <div className="page-detail-item"><span className="pd-label">查询耗时</span><span className="pd-value"><span className={`page-detail-tag ${data?.query_time_ms > 1000 ? 'warning' : 'success'}`}>{data?.query_time_ms || 0}ms</span></span></div>
                <div className="page-detail-item"><span className="pd-label">文档数量</span><span className="pd-value"><span className="page-detail-tag info">{data?.doc_count || 0}</span></span></div>
                <div className="page-detail-item"><span className="pd-label">状态码</span><span className="pd-value"><span className={`page-detail-tag ${data?.response_code === 200 ? 'success' : 'danger'}`}>{data?.response_code}</span></span></div>
                <div className="page-detail-item"><span className="pd-label">操作时间</span><span className="pd-value">{formatDateTime(data?.search_time)}</span></div>
              </div>
              {operations.length > 0 && (
                <div className="page-ops-section">
                  <h4>关联操作记录 ({operations.length}条)</h4>
                  <table className="page-ops-table">
                    <thead><tr><th>操作类型</th><th>用户</th><th>页码</th><th>耗时</th><th>文档数</th><th>时间</th></tr></thead>
                    <tbody>
                      {operations.map((op, idx) => (
                        <tr key={idx}>
                          <td><span className={`page-detail-tag ${op.operation === 'export' ? 'warning' : 'info'}`}>{op.operation === 'export' ? '导出' : op.operation === 'page' ? '翻页' : op.operation}</span></td>
                          <td>{op.nick_name}</td>
                          <td><span className="page-detail-tag info">{op.page}</span></td>
                          <td><span className={`page-detail-tag ${op.query_time_ms > 1000 ? 'warning' : 'success'}`}>{op.query_time_ms}ms</span></td>
                          <td><span className="page-detail-tag info">{op.doc_count}</span></td>
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
      </div>
      <style>{`
        .page-detail-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; }
        .page-detail-item { display: flex; border-bottom: 1px solid var(--border-color); }
        .page-detail-item:nth-last-child(-n+2) { border-bottom: none; }
        .page-detail-item.full { grid-column: 1 / -1; }
        .page-detail-item .pd-label { width: 100px; padding: 10px 14px; background: var(--bg-secondary); color: var(--text-secondary); font-size: 13px; flex-shrink: 0; }
        .page-detail-item .pd-value { flex: 1; padding: 10px 14px; color: var(--text-color); font-size: 13px; word-break: break-all; }
        .page-detail-item .pd-value.sql-text { font-family: 'Consolas', 'Monaco', monospace; background: var(--bg-secondary); white-space: pre-wrap; line-height: 1.5; max-height: 200px; overflow: auto; }
        .page-detail-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
        .page-detail-tag.success { background: rgba(82, 196, 26, 0.1); color: #52c41a; }
        .page-detail-tag.warning { background: rgba(250, 173, 20, 0.1); color: #faad14; }
        .page-detail-tag.danger { background: rgba(255, 77, 79, 0.1); color: #ff4d4f; }
        .page-detail-tag.info { background: var(--bg-secondary); color: var(--text-secondary); }
        .page-ops-section { margin-top: 24px; }
        .page-ops-section h4 { font-size: 14px; font-weight: 500; margin: 0 0 12px; padding-top: 16px; border-top: 1px solid var(--border-color); color: var(--text-color); }
        .page-ops-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .page-ops-table th, .page-ops-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border-color); }
        .page-ops-table th { background: var(--bg-secondary); font-weight: 500; color: var(--text-color); }
        .page-ops-table td { color: var(--text-secondary); }
        .pd-loading { display: flex; align-items: center; justify-content: center; gap: 8px; height: 200px; color: var(--text-secondary); }
        .pd-spin { animation: spin 1s linear infinite; }
      `}</style>
    </>
  );
};

export default PageDetailDialog;
