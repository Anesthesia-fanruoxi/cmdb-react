/**
 * 加解密审计日志页面
 */

import { useState, useEffect } from 'react';
import { Search, RefreshCw, Loader2 } from 'lucide-react';
import { getKeyAuditLog } from '../../../services/audit/audit';
import toast from '../../../components/Toast';
import AuditDateRangePicker from '../components/AuditDateRangePicker';
import './index.css';

interface LogItem {
  nick_name: string;
  operation_type: string;
  project_name: string;
  batch_count: number;
  ip_address: string;
  status: string;
  created_at: string;
}

const AuditKey = () => {
  const [loading, setLoading] = useState(false);
  const [logList, setLogList] = useState<LogItem[]>([]);
  const [total, setTotal] = useState(0);

  const [nickName, setNickName] = useState('');
  const [operationType, setOperationType] = useState('');
  const [projectName, setProjectName] = useState('');
  const [status, setStatus] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const start = formatDateTime(today);
    const endStr = formatDateTime(end);
    setStartTime(start);
    setEndTime(endStr);
    fetchListWithParams(start, endStr, 1);
  }, []);

  const formatDateTime = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const fetchListWithParams = async (start: string, end: string, p = 1) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page: p, start_time: start, end_time: end };
      if (nickName) params.nick_name = nickName;
      if (operationType) params.operation_type = operationType;
      if (projectName) params.project_name = projectName;
      if (status) params.status = status;

      const res = await getKeyAuditLog(params);
      if (res.code === 200 && res.data) {
        const resData = res.data as { list?: LogItem[]; total?: number };
        setLogList(resData.list || []);
        setTotal(resData.total || 0);
      }
    } catch { toast.error('获取加解密审计日志失败'); }
    finally { setLoading(false); }
  };

  // 翻页时重新加载
  useEffect(() => { 
    if (startTime && endTime && page > 1) {
      fetchListWithParams(startTime, endTime, page); 
    }
  }, [page]);

  const handleSearch = () => { 
    setPage(1); 
    fetchListWithParams(startTime, endTime, 1); 
  };
  const handleReset = () => {
    setNickName(''); setOperationType(''); setProjectName(''); setStatus('');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const start = formatDateTime(today);
    const endStr = formatDateTime(end);
    setStartTime(start); setEndTime(endStr);
    setPage(1);
    fetchListWithParams(start, endStr, 1);
  };

  const getOpText = (op: string) => ({ encrypt: '加密', decrypt: '解密', batchDecrypt: '批量解密' }[op] || op);
  const getOpType = (op: string) => ({ encrypt: 'primary', decrypt: 'success', batchDecrypt: 'warning' }[op] || '');

  return (
    <div className="audit-key-page">
      <div className="page-card">
        <div className="search-bar">
          <input type="text" value={nickName} onChange={e => setNickName(e.target.value)} placeholder="用户昵称" className="search-input" />
          <select value={operationType} onChange={e => setOperationType(e.target.value)} className="search-select">
            <option value="">操作类型</option>
            <option value="encrypt">加密</option>
            <option value="decrypt">解密</option>
            <option value="batchDecrypt">批量解密</option>
          </select>
          <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="项目名称" className="search-input" />
          <select value={status} onChange={e => setStatus(e.target.value)} className="search-select">
            <option value="">操作状态</option>
            <option value="success">成功</option>
            <option value="failed">失败</option>
          </select>
          <AuditDateRangePicker
            value={{ start: startTime, end: endTime }}
            onChange={(start, end) => { setStartTime(start); setEndTime(end); }}
          />
          <button className="btn-primary" onClick={handleSearch}><Search size={14} /> 搜索</button>
          <button className="btn-default" onClick={handleReset}><RefreshCw size={14} /> 重置</button>
        </div>

        <div className="card-header"><span className="title">加解密审计日志</span></div>

        <div className="table-wrapper">
          {loading ? (
            <div className="loading-state"><Loader2 size={24} className="spin" /> 加载中...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>用户</th><th>操作类型</th><th>项目</th><th>批处理数量</th><th>操作IP</th><th>状态</th><th>操作时间</th></tr>
              </thead>
              <tbody>
                {logList.map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.nick_name}</td>
                    <td><span className={`tag ${getOpType(row.operation_type)}`}>{getOpText(row.operation_type)}</span></td>
                    <td>{row.project_name}</td>
                    <td>{row.batch_count}</td>
                    <td>{row.ip_address}</td>
                    <td><span className={`tag ${row.status === 'success' ? 'success' : 'danger'}`}>{row.status === 'success' ? '成功' : '失败'}</span></td>
                    <td>{row.created_at}</td>
                  </tr>
                ))}
                {logList.length === 0 && <tr><td colSpan={7} className="empty-cell">暂无数据</td></tr>}
              </tbody>
            </table>
          )}
        </div>

        <div className="pagination">
          <span>共 {total} 条</span>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
          <span>第 {page} 页</span>
          <button disabled={logList.length < 20} onClick={() => setPage(p => p + 1)}>下一页</button>
        </div>
      </div>
    </div>
  );
};

export default AuditKey;
