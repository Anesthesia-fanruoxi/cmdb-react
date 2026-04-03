/**
 * 操作日志页面
 */

import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Loader2 } from 'lucide-react';
import { getOperationLog, OperationLogItem } from '../../../services/audit';
import toast from '../../../components/Toast';
import OperationDetailDialog from './components/OperationDetailDialog';
import AuditDateRangePicker from '../components/AuditDateRangePicker';
import './index.css';

const formatDate = (date: Date, isEnd = false) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear(), m = pad(date.getMonth() + 1), d = pad(date.getDate());
  return isEnd ? `${y}-${m}-${d}T23:59:59+08:00` : `${y}-${m}-${d}T00:00:00+08:00`;
};

const getDefaultDateRange = () => {
  const today = new Date();
  return { start: formatDate(today), end: formatDate(today, true) };
};

const AuditOperation = () => {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<OperationLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [userName, setUserName] = useState('');
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');
  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 模块和操作类型选项
  const [moduleOptions, setModuleOptions] = useState<string[]>([]);
  const [actionOptions, setActionOptions] = useState<string[]>([]);

  // 详情弹框
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState<OperationLogItem | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getOperationLog({
        userName, module, action,
        startTime: dateRange.start, endTime: dateRange.end, page, pageSize
      });
      if (res.code === 200 && res.data) {
        const data = res.data as any;
        setList(data.list || []);
        setTotal(data.total || 0);
        // 提取选项
        const modules = new Set<string>(), actions = new Set<string>();
        (data.list || []).forEach((item: OperationLogItem) => {
          if (item.module) modules.add(item.module);
          if (item.action) actions.add(item.action);
        });
        setModuleOptions(Array.from(modules));
        setActionOptions(Array.from(actions));
      }
    } catch { toast.error('获取操作日志失败'); }
    finally { setLoading(false); }
  }, [userName, module, action, dateRange, page, pageSize]);

  useEffect(() => { fetchList(); }, [page, pageSize]);

  const handleSearch = () => { setPage(1); fetchList(); };
  const handleReset = () => {
    setUserName(''); setModule(''); setAction(''); setDateRange(getDefaultDateRange()); setPage(1);
    setTimeout(fetchList, 0);
  };

  const handleViewDetail = (row: OperationLogItem) => {
    setDetailData(row);
    setDetailVisible(true);
  };

  return (
    <div className="audit-operation-page">
      <div className="page-card">
        <div className="search-bar">
          <input type="text" value={userName} onChange={e => setUserName(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="用户名" className="search-input" />
          <select value={module} onChange={e => setModule(e.target.value)} className="search-select">
            <option value="">操作模块</option>
            {moduleOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={action} onChange={e => setAction(e.target.value)} className="search-select">
            <option value="">操作类型</option>
            {actionOptions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <AuditDateRangePicker
            value={{ start: dateRange.start, end: dateRange.end }}
            onChange={(start, end) => setDateRange({ start, end })}
            showTime={false}
          />
          <button className="btn-primary" onClick={handleSearch}><Search size={14} /> 搜索</button>
          <button className="btn-default" onClick={handleReset}><RefreshCw size={14} /> 重置</button>
        </div>

        <div className="table-header"><span className="title">操作日志</span></div>
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-state"><Loader2 size={24} className="spin" /> 加载中...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>用户名</th><th>操作模块</th><th>操作类型</th><th>请求方法</th>
                  <th>操作IP</th><th>执行时长</th><th>操作时间</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map(item => (
                  <tr key={item.id}>
                    <td>{item.userName}</td>
                    <td>{item.module}</td>
                    <td>{item.action}</td>
                    <td>{item.method}</td>
                    <td>{item.ip}</td>
                    <td>{item.duration}ms</td>
                    <td>{item.createdAt}</td>
                    <td><button className="btn-link" onClick={() => handleViewDetail(item)}>详情</button></td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={8} className="empty-cell">暂无数据</td></tr>}
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

      <OperationDetailDialog visible={detailVisible} data={detailData} onClose={() => setDetailVisible(false)} />
    </div>
  );
};

export default AuditOperation;
