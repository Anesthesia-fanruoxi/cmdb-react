/**
 * AI调用记录页面
 * 展示 SQL EXPLAIN AI 分析的调用明细与用量（来源：audit_ai_log）
 */

import { useState, useEffect } from 'react';
import { Search, RefreshCw, Loader2 } from 'lucide-react';
import { getAuditAiList, getAuditSqlProjects, AiCallLogItem } from '../../../services/audit/audit';
import toast from '../../../components/Toast';
import AiDetailDialog from './components/AiDetailDialog';
import AuditDateRangePicker from '../components/AuditDateRangePicker';
import './index.css';

const pad = (n: number) => String(n).padStart(2, '0');

const formatDateTime = (date: Date) => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

// 默认查询今日
const getDefaultRange = () => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  return { start: formatDateTime(today), end: formatDateTime(end) };
};

// 耗时格式化（毫秒 -> s/ms）
const formatDuration = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms || 0}ms`);

const AuditAi = () => {
  const [loading, setLoading] = useState(false);
  const [logList, setLogList] = useState<AiCallLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [projects, setProjects] = useState<{ key: string; value: string }[]>([]);

  const [userName, setUserName] = useState('');
  const [project, setProject] = useState('');
  const [dbName, setDbName] = useState('');
  const [model, setModel] = useState('');
  const [status, setStatus] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState<AiCallLogItem | null>(null);

  useEffect(() => {
    const range = getDefaultRange();
    setStartTime(range.start);
    setEndTime(range.end);
    fetchListWithParams(range.start, range.end);
  }, []);

  const fetchListWithParams = async (start: string, end: string, p = 1, size = pageSize) => {
    setLoading(true);
    try {
      const res = await getAuditAiList({
        userName, project, dbName, model, status,
        startTime: start, endTime: end, page: p, pageSize: size,
      });
      if (res.code === 200 && res.data) {
        const resData = res.data as { list?: AiCallLogItem[]; total?: number };
        setLogList(resData.list || []);
        setTotal(resData.total || 0);
      }
    } catch { toast.error('查询失败'); }
    finally { setLoading(false); }
  };

  const fetchProjects = async () => {
    try {
      const res = await getAuditSqlProjects();
      if (res.code === 200 && res.data) {
        const items: any[] = Array.isArray(res.data) ? res.data : (res.data as any).items || [];
        setProjects(items.map(item => ({ key: item.project || item.key || '', value: item.project_name || item.value || '' })));
      }
    } catch (e) { console.error('获取项目列表失败:', e); }
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
    if (e.key === 'Enter') handleSearch();
  };

  const handleReset = () => {
    setUserName(''); setProject(''); setDbName(''); setModel(''); setStatus('');
    const range = getDefaultRange();
    setStartTime(range.start); setEndTime(range.end);
    setPage(1);
    fetchListWithParams(range.start, range.end, 1);
  };

  // 切换每页条数
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
    fetchListWithParams(startTime, endTime, 1, size);
  };

  const handleViewDetail = (row: AiCallLogItem) => {
    setDetailData(row);
    setDetailVisible(true);
  };

  const formatLocation = (row: AiCallLogItem) => row.city || row.region || row.country || '-';

  return (
    <div className="audit-ai-page">
      <div className="page-card">
        <div className="search-bar">
          <input type="text" value={userName} onChange={e => setUserName(e.target.value)} placeholder="操作人" className="search-input" onKeyPress={handleKeyPress} />
          <select value={project} onChange={e => setProject(e.target.value)} className="search-select" onKeyPress={handleKeyPress}>
            <option value="">选择项目</option>
            {projects.map(p => <option key={p.key} value={p.key}>{p.value}</option>)}
          </select>
          <input type="text" value={dbName} onChange={e => setDbName(e.target.value)} placeholder="数据库" className="search-input" onKeyPress={handleKeyPress} />
          <input type="text" value={model} onChange={e => setModel(e.target.value)} placeholder="AI模型" className="search-input" onKeyPress={handleKeyPress} />
          <select value={status} onChange={e => setStatus(e.target.value)} className="search-select" onKeyPress={handleKeyPress}>
            <option value="">调用状态</option>
            <option value="success">成功</option>
            <option value="failed">失败</option>
          </select>
          <AuditDateRangePicker
            value={{ start: startTime, end: endTime }}
            onChange={(start, end) => { setStartTime(start); setEndTime(end); }}
          />
          <button className="btn-primary" onClick={handleSearch}><Search size={14} /> 查询</button>
          <button className="btn-default" onClick={handleReset}><RefreshCw size={14} /> 重置</button>
        </div>

        <div className="card-header"><span className="title">AI调用记录</span></div>

        <div className="table-wrapper">
          {loading ? (
            <div className="loading-state"><Loader2 size={24} className="spin" /> 加载中...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>序号</th><th>操作人</th><th>项目</th><th>数据库</th><th>模型</th>
                  <th>Token用量</th><th>耗时</th><th>状态</th><th>来源</th>
                  <th>客户端IP</th><th>地区</th><th>操作时间</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {logList.map((row, idx) => (
                  <tr key={row.id}>
                    <td>{(page - 1) * pageSize + idx + 1}</td>
                    <td>{row.userName || '-'}</td>
                    <td>{row.project || '-'}</td>
                    <td>{row.dbName || '-'}</td>
                    <td><span className="tag info">{row.model || '-'}</span></td>
                    <td><span className="tag info" title={`输入 ${row.promptTokens || 0} / 输出 ${row.completionTokens || 0}`}>{row.totalTokens || 0}</span></td>
                    <td><span className={`tag ${row.duration >= 60000 ? 'warning' : 'success'}`}>{formatDuration(row.duration)}</span></td>
                    <td><span className={`tag ${row.status === 'success' ? 'success' : 'danger'}`}>{row.status === 'success' ? '成功' : '失败'}</span></td>
                    <td><span className={`tag ${row.platform === 'desktop' ? 'success' : 'info'}`}>{row.platform === 'desktop' ? '客户端' : '浏览器'}</span></td>
                    <td>{row.clientIp || '-'}</td>
                    <td>{formatLocation(row)}</td>
                    <td>{row.createdAt?.slice(0, 19).replace('T', ' ')}</td>
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
          <select value={pageSize} onChange={e => handlePageSizeChange(Number(e.target.value))} className="page-size-select">
            <option value={10}>10条/页</option>
            <option value={20}>20条/页</option>
            <option value={50}>50条/页</option>
            <option value={100}>100条/页</option>
          </select>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
          <span>第 {page} 页</span>
          <button disabled={page * pageSize >= total} onClick={() => setPage(p => p + 1)}>下一页</button>
        </div>
      </div>

      <AiDetailDialog visible={detailVisible} data={detailData} onClose={() => setDetailVisible(false)} />
    </div>
  );
};

export default AuditAi;
