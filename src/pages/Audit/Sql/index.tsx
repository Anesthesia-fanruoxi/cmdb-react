/**
 * SQL审计日志页面
 */

import { useState, useEffect } from 'react';
import { Search, RefreshCw, Loader2 } from 'lucide-react';
import { getSqlLog, getSqlDetail } from '../../../services/audit/audit';
import { getDictDetail } from '../../../services/system/dict';
import toast from '../../../components/Toast';
import SqlDetailDialog from './components/SqlDetailDialog';
import AuditDateRangePicker from '../components/AuditDateRangePicker';
import './index.css';

interface LogItem {
  query_id: string;
  nick_name: string;
  client_ip: string;
  city?: string;
  district?: string;
  db_name: string;
  platform?: string;  // 添加来源字段
  Operation: string;
  operation_count: number;
  execution_time: number;
  affected_rows: number;
  status: string;
  created_at: string;
}

const AuditSql = () => {
  const [loading, setLoading] = useState(false);
  const [logList, setLogList] = useState<LogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [projects, setProjects] = useState<{ key: string; value: string }[]>([]);

  const [project, setProject] = useState('');
  const [queryId, setQueryId] = useState('');
  const [userName, setUserName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [relatedOps, setRelatedOps] = useState<any[]>([]);

  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const start = formatDateTime(today);
    const endStr = formatDateTime(end);
    setStartTime(start);
    setEndTime(endStr);
    fetchListWithParams(start, endStr);
  }, []);

  const formatDateTime = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const fetchListWithParams = async (start: string, end: string, p = 1) => {
    setLoading(true);
    try {
      const res = await getSqlLog({
        project, query_id: queryId, UserName: userName,
        start_time: start, end_time: end, page: p, size: pageSize
      });
      if (res.code === 200 && res.data) {
        const resData = res.data as { list?: LogItem[]; total?: number };
        setLogList(resData.list || []);
        setTotal(resData.total || 0);
      }
    } catch { toast.error('查询失败'); }
    finally { setLoading(false); }
  };

  const fetchProjects = async () => {
    try {
      const res = await getDictDetail('sys_project_dict');
      if (res.code === 200 && res.data?.items) setProjects(res.data.items);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchProjects(); }, []);

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
  
  // 支持回车键搜索
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };
  
  const handleReset = () => {
    setProject(''); setQueryId(''); setUserName('');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const start = formatDateTime(today);
    const endStr = formatDateTime(end);
    setStartTime(start); setEndTime(endStr);
    setPage(1);
    fetchListWithParams(start, endStr, 1);
  };

  const handleViewDetail = async (row: LogItem) => {
    setDetailVisible(true);
    try {
      const res = await getSqlDetail({ query_id: row.query_id });
      if (res.code === 200 && res.data) {
        const resData = res.data as { search_detail?: any; page_operations?: any[] };
        setDetailData(resData.search_detail || row);
        setRelatedOps(resData.page_operations || []);
      } else { setDetailData(row); setRelatedOps([]); }
    } catch { setDetailData(row); setRelatedOps([]); }
  };

  const formatLocation = (row: LogItem) => row.city || '未知';

  return (
    <div className="audit-sql-page">
      <div className="page-card">
        <div className="search-bar">
          <select value={project} onChange={e => setProject(e.target.value)} className="search-select" onKeyPress={handleKeyPress}>
            <option value="">选择项目</option>
            {projects.map(p => <option key={p.key} value={p.key}>{p.value}</option>)}
          </select>
          <input type="text" value={queryId} onChange={e => setQueryId(e.target.value)} placeholder="查询ID" className="search-input" onKeyPress={handleKeyPress} />
          <input type="text" value={userName} onChange={e => setUserName(e.target.value)} placeholder="用户名" className="search-input" onKeyPress={handleKeyPress} />
          <AuditDateRangePicker
            value={{ start: startTime, end: endTime }}
            onChange={(start, end) => { setStartTime(start); setEndTime(end); }}
          />
          <button className="btn-primary" onClick={handleSearch}><Search size={14} /> 查询</button>
          <button className="btn-default" onClick={handleReset}><RefreshCw size={14} /> 重置</button>
        </div>

        <div className="card-header"><span className="title">SQL审计日志</span></div>

        <div className="table-wrapper">
          {loading ? (
            <div className="loading-state"><Loader2 size={24} className="spin" /> 加载中...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>序号</th><th>昵称</th><th>客户端IP</th><th>运营商</th><th>地区</th>
                  <th>数据库</th><th>来源</th><th>操作类型</th><th>操作次数</th><th>执行耗时</th>
                  <th>影响行数</th><th>状态</th><th>操作时间</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {logList.map((row, idx) => (
                  <tr key={row.query_id}>
                    <td>{(page - 1) * pageSize + idx + 1}</td>
                    <td>{row.nick_name}</td>
                    <td>{row.client_ip}</td>
                    <td>{row.district || '-'}</td>
                    <td>{formatLocation(row)}</td>
                    <td>{row.db_name}</td>
                    <td><span className={`tag ${row.platform === 'desktop' ? 'success' : 'info'}`}>{row.platform === 'desktop' ? '客户端' : '浏览器'}</span></td>
                    <td><span className={`tag ${row.Operation === 'export' ? 'warning' : 'info'}`}>{row.Operation === 'export' ? '导出' : '查询'}</span></td>
                    <td><span className={`tag ${row.operation_count > 30 ? 'danger' : row.operation_count > 10 ? 'warning' : 'success'}`}>{row.operation_count || 0}</span></td>
                    <td><span className={`tag ${row.execution_time > 1000 ? 'warning' : 'success'}`}>{row.execution_time}ms</span></td>
                    <td><span className="tag info">{row.affected_rows}</span></td>
                    <td><span className={`tag ${row.status === 'success' ? 'success' : 'danger'}`}>{row.status === 'success' ? '成功' : '失败'}</span></td>
                    <td>{row.created_at?.slice(0, 19).replace('T', ' ')}</td>
                    <td><button className="btn-link" onClick={() => handleViewDetail(row)}>详情</button></td>
                  </tr>
                ))}
                {logList.length === 0 && <tr><td colSpan={14} className="empty-cell">暂无数据</td></tr>}
              </tbody>
            </table>
          )}
        </div>

        <div className="pagination">
          <span>共 {total} 条</span>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
          <span>第 {page} 页</span>
          <button disabled={page * pageSize >= total} onClick={() => setPage(p => p + 1)}>下一页</button>
        </div>
      </div>

      <SqlDetailDialog visible={detailVisible} data={detailData} operations={relatedOps} onClose={() => setDetailVisible(false)} />
    </div>
  );
};

export default AuditSql;
