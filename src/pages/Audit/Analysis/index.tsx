/**
 * 审计分析页面
 */

import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Loader2 } from 'lucide-react';
import { getAuditAnalysis } from '../../../services/audit/audit';
import toast from '../../../components/Toast';
import HourlyDrawer from './components/HourlyDrawer';
import PageDetailDialog from './components/PageDetailDialog';
import AuditDateRangePicker from '../components/AuditDateRangePicker';
import './index.css';

interface StatsItem { 
  nick_name: string; 
  execution_count: number; 
  web_count?: number; 
  desktop_count?: number; 
}
interface PageItem { 
  query_id: string; 
  page_count: number; 
  nick_name?: string; 
  platform?: string; 
  type?: string; 
}

const AuditAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>({});
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // 小时详情抽屉
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerType, setDrawerType] = useState<'sql' | 'es'>('sql');
  const [drawerHour, setDrawerHour] = useState(0);

  // 翻页详情弹框
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailType, setDetailType] = useState<'sql' | 'es'>('sql');
  const [detailQueryId, setDetailQueryId] = useState('');

  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const start = formatDateTime(today);
    const endStr = formatDateTime(end);
    setStartTime(start);
    setEndTime(endStr);
    // 立即获取数据
    fetchDataWithParams(start, endStr);
  }, []);

  const formatDateTime = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const fetchDataWithParams = async (start: string, end: string) => {
    setLoading(true);
    try {
      const res = await getAuditAnalysis({ start_time: start, end_time: end });
      if (res.code === 200 && res.data) {
        const d = res.data as any;
        // 兼容新旧字段名：新结构优先，回退到旧结构
        setData({
          top_executors: d.top_executors || d.sql_search_stats || [],
          top_exporters: d.top_exporters || d.sql_export_stats || [],
          top_searchers: d.top_searchers || d.es_search_stats || [],
          top_paged: d.top_paged || [
            ...(d.sql_top_pages || []).map((i: any) => ({ ...i, type: 'sql' })),
            ...(d.es_page_stats || []).map((i: any) => ({ ...i, type: 'es' })),
          ],
          top_analysis: d.top_analysis || d.es_analysis_stats || [],
          time_stats: d.time_stats || {
            hourly_distribution: {
              sql: d.sql_hourly_stats || {},
              es: d.es_hourly_stats || {},
            },
          },
        });
      }
      else toast.error(res.message || '获取审计分析数据失败');
    } catch { toast.error('获取审计分析数据失败'); }
    finally { setLoading(false); }
  };

  const fetchData = useCallback(async () => {
    if (!startTime || !endTime) return;
    fetchDataWithParams(startTime, endTime);
  }, [startTime, endTime]);

  const handleSearch = () => fetchData();
  const handleReset = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const start = formatDateTime(today);
    const endStr = formatDateTime(end);
    setStartTime(start); 
    setEndTime(endStr);
    fetchDataWithParams(start, endStr);
  };

  const getTotal = (arr: StatsItem[]) => arr?.reduce((sum, i) => sum + i.execution_count, 0) || 0;

  const handleHourClick = (type: 'sql' | 'es', hour: number, count: number) => {
    if (count <= 0) return;
    setDrawerType(type);
    setDrawerHour(hour);
    setDrawerVisible(true);
  };

  const handleViewDetail = (type: 'sql' | 'es', queryId: string) => {
    setDetailType(type);
    setDetailQueryId(queryId);
    setDetailVisible(true);
  };

  const renderStatsTable = (list: StatsItem[], total: number, showPlatform = false) => (
    <table className="stats-table">
      <thead>
        <tr>
          <th>排名</th>
          <th>昵称</th>
          <th>执行次数</th>
          {showPlatform && <th>Web端</th>}
          {showPlatform && <th>客户端</th>}
          <th>占比</th>
        </tr>
      </thead>
      <tbody>
        {list?.map((item, idx) => {
          const pct = total > 0 ? Math.round((item.execution_count / total) * 100) : 0;
          return (
            <tr key={idx}>
              <td>{idx + 1}</td>
              <td>{item.nick_name}</td>
              <td>{item.execution_count}</td>
              {showPlatform && <td>{item.web_count || 0}</td>}
              {showPlatform && <td>{item.desktop_count || 0}</td>}
              <td><div className="progress-bar"><div className={`progress-fill ${pct > 50 ? 'danger' : pct > 30 ? 'warning' : ''}`} style={{ width: `${pct}%` }} /><span>{pct}%</span></div></td>
            </tr>
          );
        })}
        {(!list || list.length === 0) && <tr><td colSpan={showPlatform ? 6 : 4} className="empty">暂无数据</td></tr>}
      </tbody>
    </table>
  );

  // 从合并翻页数据中按类型筛选
  const getPagedByType = (type: 'sql' | 'es') =>
    data.top_paged?.filter((item: PageItem) => (type === 'sql' ? item.type !== 'es' : item.type === 'es'));

  const renderHourlyChart = (stats: Record<string, number>, type: 'sql' | 'es') => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const counts = hours.map(h => stats?.[h.toString()] || 0);
    const max = Math.max(...counts, 1);
    return (
      <div className="hourly-chart">
        <div className="chart-bars">
          {counts.map((count, idx) => (
            <div key={idx} className={`bar-item ${count > 0 ? 'clickable' : ''}`} onClick={() => handleHourClick(type, idx, count)}>
              {count > 0 && <div className={`bar ${count > (type === 'sql' ? 10 : 100) ? 'danger' : count > (type === 'sql' ? 5 : 50) ? 'warning' : ''}`} style={{ height: `${(count / max) * 100}%` }} />}
              <span className="bar-value">{count}</span>
            </div>
          ))}
        </div>
        <div className="chart-labels">{hours.map(h => <span key={h}>{h}:00</span>)}</div>
      </div>
    );
  };

  return (
    <div className="audit-analysis-page">
      <div className="search-card">
        <AuditDateRangePicker
          value={{ start: startTime, end: endTime }}
          onChange={(start, end) => {
            setStartTime(start);
            setEndTime(end);
          }}
        />
        <button className="btn-primary" onClick={handleSearch}><Search size={14} /> 搜索</button>
        <button className="btn-default" onClick={handleReset}><RefreshCw size={14} /> 重置</button>
      </div>

      {loading ? (
        <div className="loading-state"><Loader2 size={24} className="spin" /> 加载中...</div>
      ) : (
        <>
          <div className="section-card">
            <div className="section-header">SQL分析</div>
            <div className="section-grid">
              <div className="grid-item">
                <div className="item-title">SQL查询统计 (总计: {getTotal(data.top_executors)})</div>
                {renderStatsTable(data.top_executors, getTotal(data.top_executors), true)}
              </div>
              <div className="grid-item">
                <div className="item-title">SQL翻页统计</div>
                <table className="stats-table">
                  <thead><tr><th>查询ID</th><th>昵称</th><th>来源</th><th>翻页次数</th><th>操作</th></tr></thead>
                  <tbody>
                    {getPagedByType('sql')?.map((item: PageItem, idx: number) => (
                      <tr key={idx}>
                        <td title={item.query_id}>{item.query_id?.slice(0, 16)}...</td>
                        <td>{item.nick_name || '-'}</td>
                        <td>
                          <span className={`tag ${item.platform === 'desktop' ? 'success' : 'info'}`}>
                            {item.platform === 'desktop' ? '客户端' : '浏览器'}
                          </span>
                        </td>
                        <td><span className="tag success">{item.page_count}</span></td>
                        <td><button className="btn-link" onClick={() => handleViewDetail('sql', item.query_id)}>详情</button></td>
                      </tr>
                    ))}
                    {(!getPagedByType('sql') || getPagedByType('sql').length === 0) && <tr><td colSpan={5} className="empty">暂无数据</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="grid-item">
                <div className="item-title">SQL导出统计 (总计: {getTotal(data.top_exporters)})</div>
                {renderStatsTable(data.top_exporters, getTotal(data.top_exporters))}
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header">ES分析</div>
            <div className="section-grid">
              <div className="grid-item">
                <div className="item-title">ES查询统计 (总计: {getTotal(data.top_searchers)})</div>
                {renderStatsTable(data.top_searchers, getTotal(data.top_searchers), true)}
              </div>
              <div className="grid-item">
                <div className="item-title">ES翻页统计</div>
                <table className="stats-table">
                  <thead><tr><th>查询ID</th><th>昵称</th><th>来源</th><th>翻页次数</th><th>操作</th></tr></thead>
                  <tbody>
                    {getPagedByType('es')?.map((item: PageItem, idx: number) => (
                      <tr key={idx}>
                        <td title={item.query_id}>{item.query_id?.slice(0, 16)}...</td>
                        <td>{item.nick_name || '-'}</td>
                        <td>
                          <span className={`tag ${item.platform === 'desktop' ? 'success' : 'info'}`}>
                            {item.platform === 'desktop' ? '客户端' : '浏览器'}
                          </span>
                        </td>
                        <td><span className="tag success">{item.page_count}</span></td>
                        <td><button className="btn-link" onClick={() => handleViewDetail('es', item.query_id)}>详情</button></td>
                      </tr>
                    ))}
                    {(!getPagedByType('es') || getPagedByType('es').length === 0) && <tr><td colSpan={5} className="empty">暂无数据</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="grid-item">
                <div className="item-title">ES用户分析统计</div>
                <table className="stats-table">
                  <thead><tr><th>排名</th><th>昵称</th><th>执行次数</th></tr></thead>
                  <tbody>
                    {data.top_analysis?.map((item: StatsItem, idx: number) => (
                      <tr key={idx}><td>{idx + 1}</td><td>{item.nick_name}</td><td><span className={`tag ${item.execution_count > 10 ? 'warning' : 'success'}`}>{item.execution_count}</span></td></tr>
                    ))}
                    {(!data.top_analysis || data.top_analysis.length === 0) && <tr><td colSpan={3} className="empty">暂无数据</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header">查询时间分布</div>
            <div className="section-grid two-col">
              <div className="grid-item">
                <div className="item-title">SQL查询时间分布</div>
                {renderHourlyChart(data.time_stats?.hourly_distribution?.sql, 'sql')}
              </div>
              <div className="grid-item">
                <div className="item-title">ES查询时间分布</div>
                {renderHourlyChart(data.time_stats?.hourly_distribution?.es, 'es')}
              </div>
            </div>
          </div>
        </>
      )}

      <HourlyDrawer visible={drawerVisible} type={drawerType} hour={drawerHour} startTime={startTime} endTime={endTime} onClose={() => setDrawerVisible(false)} />
      <PageDetailDialog visible={detailVisible} type={detailType} queryId={detailQueryId} onClose={() => setDetailVisible(false)} />
    </div>
  );
};

export default AuditAnalysis;
