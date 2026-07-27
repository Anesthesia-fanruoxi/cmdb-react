/**
 * 登录日志页面
 */

import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Loader2 } from 'lucide-react';
import { getLoginLog, LoginLogItem } from '../../../services/audit';
import toast from '../../../components/Toast';
import AuditDateRangePicker from '../components/AuditDateRangePicker';
import './index.css';

const formatDate = (date: Date, isEnd = false) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear(), m = pad(date.getMonth() + 1), d = pad(date.getDate());
  return isEnd ? `${y}-${m}-${d} 23:59:59` : `${y}-${m}-${d} 00:00:00`;
};

const getDefaultDateRange = () => {
  const today = new Date();
  return { start: formatDate(today), end: formatDate(today, true) };
};

const AuditLogin = () => {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<LoginLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [userName, setUserName] = useState('');
  const [status, setStatus] = useState<string>('');
  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLoginLog({
        userName, status: status ? Number(status) : null,
        startTime: dateRange.start, endTime: dateRange.end, page, pageSize
      });
      if (res.code === 200 && res.data) {
        setList((res.data as any).list || []);
        setTotal((res.data as any).total || 0);
      }
    } catch { toast.error('获取登录日志失败'); }
    finally { setLoading(false); }
  }, [userName, status, dateRange, page, pageSize]);

  useEffect(() => { fetchList(); }, [page, pageSize]);

  const handleSearch = () => { setPage(1); fetchList(); };
  const handleReset = () => {
    setUserName(''); setStatus(''); setDateRange(getDefaultDateRange()); setPage(1);
    setTimeout(fetchList, 0);
  };

  const formatLocation = (row: LoginLogItem) => row.city || row.region || row.country || '未知位置';

  return (
    <div className="audit-login-page">
      <div className="page-card">
        <div className="search-bar">
          <input type="text" value={userName} onChange={e => setUserName(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="用户名" className="search-input" />
          <select value={status} onChange={e => setStatus(e.target.value)} className="search-select">
            <option value="">登录状态</option>
            <option value="1">登录成功</option>
            <option value="0">登录失败</option>
          </select>
          <AuditDateRangePicker
            value={{ start: dateRange.start, end: dateRange.end }}
            onChange={(start, end) => setDateRange({ start, end })}
            showTime={false}
          />
          <button className="btn-default" onClick={handleSearch}><Search size={14} /> 搜索</button>
          <button className="btn-default" onClick={handleReset}><RefreshCw size={14} /> 重置</button>
        </div>

        <div className="table-header"><span className="title">登录日志</span></div>
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-state"><Loader2 size={24} className="spin" /> 加载中...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>用户名</th><th>登录IP</th><th>运营商</th><th>登录地点</th>
                  <th>浏览器</th><th>操作系统</th><th>状态</th><th>提示消息</th><th>登录时间</th>
                </tr>
              </thead>
              <tbody>
                {list.map(item => (
                  <tr key={item.id}>
                    <td>{item.userName}</td>
                    <td>{item.ip}</td>
                    <td>{item.district || '-'}</td>
                    <td>{formatLocation(item)}</td>
                    <td>{item.browser || '-'}</td>
                    <td>{item.os || '-'}</td>
                    <td><span className={`status-tag ${item.status === 1 ? 'success' : 'danger'}`}>
                      {item.status === 1 ? '成功' : '失败'}
                    </span></td>
                    <td title={item.msg}>{item.msg || '-'}</td>
                    <td>{item.createdAt}</td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={9} className="empty-cell">暂无数据</td></tr>}
              </tbody>
            </table>
          )}
        </div>
        <div className="pagination">
          <span>共 {total} 条</span>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
            <option value={10}>10条/页</option><option value={20}>20条/页</option>
          </select>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
          <span>第 {page} 页</span>
          <button disabled={page * pageSize >= total} onClick={() => setPage(p => p + 1)}>下一页</button>
        </div>
      </div>
    </div>
  );
};

export default AuditLogin;
