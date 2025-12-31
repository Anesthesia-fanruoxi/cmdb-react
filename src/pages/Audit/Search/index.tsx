/**
 * ES审计日志页面
 */

import { useState, useEffect } from 'react';
import { Search, RefreshCw, Loader2 } from 'lucide-react';
import { getSearchLog, getSearchDetail } from '../../../services/audit/audit';
import { getDictDetail } from '../../../services/system/dict';
import toast from '../../../components/Toast';
import DetailDialog from './components/DetailDialog';
import './index.css';

interface LogItem {
  query_id: string;
  nick_name: string;
  client_ip: string;
  city?: string;
  region?: string;
  country?: string;
  district?: string;
  project_name: string;
  view_name?: string;
  keyword?: string;
  operation_count: number;
  query_time_ms: number;
  doc_count: number;
  search_time: string;
}

const AuditSearch = () => {
  const [loading, setLoading] = useState(false);
  const [logList, setLogList] = useState<LogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [projects, setProjects] = useState<{ key: string; value: string }[]>([]);

  // 查询参数
  const [project, setProject] = useState('');
  const [queryId, setQueryId] = useState('');
  const [userName, setUserName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // 详情弹框
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [pageOperations, setPageOperations] = useState<any[]>([]);

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
      const res = await getSearchLog({
        project, query_id: queryId, user_name: userName,
        start_time: start, end_time: end,
        current_page: p, page_size: pageSize
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
      if (res.code === 200 && res.data?.items) {
        setProjects(res.data.items);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchProjects(); }, []);

  // 翻页时重新加载
  useEffect(() => { 
    if (startTime && endTime && page > 1) {
      fetchListWithParams(startTime, endTime, page); 
    }
  }, [page]);

  const handleSearch = () => { setPage(1); fetchListWithParams(startTime, endTime, 1); };
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
      const res = await getSearchDetail({ query_id: row.query_id });
      if (res.code === 200 && res.data) {
        const resData = res.data as { search_detail?: any; page_operations?: any[] };
        setDetailData(resData.search_detail || row);
        setPageOperations(resData.page_operations || []);
      } else {
        setDetailData(row); setPageOperations([]);
      }
    } catch { setDetailData(row); setPageOperations([]); }
  };

  const formatLocation = (row: LogItem) => row.city || row.region || row.country || '未知';

  return (
    <div className="audit-search-page">
      <div className="page-card">
        <div className="search-bar">
          <select value={project} onChange={e => setProject(e.target.value)} className="search-select">
            <option value="">选择项目</option>
            {projects.map(p => <option key={p.key} value={p.key}>{p.value}</option>)}
          </select>
          <input type="text" value={queryId} onChange={e => setQueryId(e.target.value)} placeholder="查询ID" className="search-input" />
          <input type="text" value={userName} onChange={e => setUserName(e.target.value)} placeholder="用户名" className="search-input" />
          <input type="datetime-local" value={startTime.replace(' ', 'T').slice(0, 16)} onChange={e => setStartTime(e.target.value.replace('T', ' ') + ':00')} className="search-input datetime" />
          <span className="date-sep">至</span>
          <input type="datetime-local" value={endTime.replace(' ', 'T').slice(0, 16)} onChange={e => setEndTime(e.target.value.replace('T', ' ') + ':59')} className="search-input datetime" />
          <button className="btn-primary" onClick={handleSearch}><Search size={14} /> 查询</button>
          <button className="btn-default" onClick={handleReset}><RefreshCw size={14} /> 重置</button>
        </div>

        <div className="card-header"><span className="title">ES审计日志</span></div>

        <div className="table-wrapper">
          {loading ? (
            <div className="loading-state"><Loader2 size={24} className="spin" /> 加载中...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>序号</th><th>昵称</th><th>客户端IP</th><th>运营商</th><th>地区</th>
                  <th>项目名称</th><th>视图名称</th><th>关键词</th><th>操作次数</th>
                  <th>查询耗时</th><th>文档数量</th><th>操作时间</th><th>操作</th>
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
                    <td>{row.project_name}</td>
                    <td>{row.view_name || '-'}</td>
                    <td title={row.keyword}>{row.keyword || '-'}</td>
                    <td><span className={`tag ${row.operation_count > 30 ? 'danger' : row.operation_count > 10 ? 'warning' : 'success'}`}>{row.operation_count}</span></td>
                    <td><span className={`tag ${row.query_time_ms > 1000 ? 'warning' : 'success'}`}>{row.query_time_ms}ms</span></td>
                    <td><span className="tag info">{row.doc_count}</span></td>
                    <td>{row.search_time?.slice(0, 19).replace('T', ' ')}</td>
                    <td><button className="btn-link" onClick={() => handleViewDetail(row)}>详情</button></td>
                  </tr>
                ))}
                {logList.length === 0 && <tr><td colSpan={13} className="empty-cell">暂无数据</td></tr>}
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

      <DetailDialog visible={detailVisible} data={detailData} operations={pageOperations} onClose={() => setDetailVisible(false)} />
    </div>
  );
};

export default AuditSearch;
