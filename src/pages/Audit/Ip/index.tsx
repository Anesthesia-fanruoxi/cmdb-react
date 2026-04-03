/**
 * IP访问审计日志页面
 */

import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Loader2 } from 'lucide-react';
import { getIpAuditLog } from '../../../services/audit';
import toast from '../../../components/Toast';
import AuditDateRangePicker from '../components/AuditDateRangePicker';
import './index.css';

interface IpLogItem {
  id: number;
  request_ip: string;
  query_ip: string;
  status: number;
  created_at: string;
  date: string;
}

const formatDate = (date: Date, isEnd = false) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear(), m = pad(date.getMonth() + 1), d = pad(date.getDate());
  return isEnd ? `${y}-${m}-${d}T23:59:59+08:00` : `${y}-${m}-${d}T00:00:00+08:00`;
};

const getDefaultDateRange = () => {
  const today = new Date();
  return { start: formatDate(today), end: formatDate(today, true) };
};

const AuditIp = () => {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<IpLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [requestIp, setRequestIp] = useState('');
  const [queryIp, setQueryIp] = useState('');
  const [status, setStatus] = useState('');
  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  const [page, setPage] = useState(1);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page };
      if (requestIp) params.request_ip = requestIp;
      if (queryIp) params.query_ip = queryIp;
      if (status) params.status = status;
      if (dateRange.start) params.start_time = dateRange.start;
      if (dateRange.end) params.end_time = dateRange.end;

      const res = await getIpAuditLog(params as any);
      if (res.code === 200 && res.data) {
        setList((res.data as any).list || []);
        setTotal((res.data as any).total || 0);
      }
    } catch { toast.error('获取IP访问审计日志失败'); }
    finally { setLoading(false); }
  }, [requestIp, queryIp, status, dateRange, page]);

  useEffect(() => { fetchList(); }, [page]);

  const handleSearch = () => { setPage(1); fetchList(); };
  const handleReset = () => {
    setRequestIp(''); setQueryIp(''); setStatus(''); setDateRange(getDefaultDateRange()); setPage(1);
    setTimeout(fetchList, 0);
  };

  const getStatusType = (s: number) => {
    if (s === 200) return 'success';
    if (s >= 400 && s < 500) return 'warning';
    return 'danger';
  };

  return (
    <div className="audit-ip-page">
      <div className="page-card">
        <div className="search-bar">
          <input type="text" value={requestIp} onChange={e => setRequestIp(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="请求IP" className="search-input" />
          <input type="text" value={queryIp} onChange={e => setQueryIp(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="查询IP" className="search-input" />
          <select value={status} onChange={e => setStatus(e.target.value)} className="search-select">
            <option value="">状态码</option>
            <option value="200">200 - 成功</option>
            <option value="400">400 - 错误请求</option>
            <option value="401">401 - 未授权</option>
            <option value="403">403 - 禁止访问</option>
            <option value="404">404 - 未找到</option>
            <option value="500">500 - 服务器错误</option>
          </select>
          <AuditDateRangePicker
            value={{ start: dateRange.start, end: dateRange.end }}
            onChange={(start, end) => setDateRange({ start, end })}
            showTime={false}
          />
          <button className="btn-primary" onClick={handleSearch}><Search size={14} /> 搜索</button>
          <button className="btn-default" onClick={handleReset}><RefreshCw size={14} /> 重置</button>
        </div>

        <div className="table-header"><span className="title">IP访问审计日志</span></div>
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-state"><Loader2 size={24} className="spin" /> 加载中...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>请求IP</th><th>查询IP</th><th>状态码</th><th>访问时间</th><th>日期</th></tr>
              </thead>
              <tbody>
                {list.map(item => (
                  <tr key={item.id}>
                    <td>{item.request_ip}</td>
                    <td>{item.query_ip}</td>
                    <td><span className={`status-tag ${getStatusType(item.status)}`}>{item.status}</span></td>
                    <td>{item.created_at}</td>
                    <td>{item.date}</td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={5} className="empty-cell">暂无数据</td></tr>}
              </tbody>
            </table>
          )}
        </div>
        <div className="pagination">
          <span>共 {total} 条</span>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
          <span>第 {page} 页</span>
          <button disabled={list.length < 20} onClick={() => setPage(p => p + 1)}>下一页</button>
        </div>
      </div>
    </div>
  );
};

export default AuditIp;
