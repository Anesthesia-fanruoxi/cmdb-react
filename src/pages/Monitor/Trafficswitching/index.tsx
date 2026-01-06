/**
 * 流量切换监控页面
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { RefreshCw, HelpCircle, User, Globe, Shuffle, Monitor } from 'lucide-react';
import { getMonitorMetricsList } from '@/services/monitor';
import type { MonitorMetric } from '@/services/monitor';
import type { TimeRangeType } from '@/types/monitor';
import { ProjectSelector, TimeRangeSelector, AutoRefresh, MetricChart, ChartZoomDialog } from '../components';
import { TIME_RANGE_OPTIONS } from '../hooks/useTimeRange';
import { formatTimestamp } from '../utils/format';
import { StatSection } from './components';
import toast from '@/components/Toast';
import '../styles/common.css';
import './index.css';

const SERVICE_LIST = [
  'scfq-manager-api', 'scfq-seller-api', 'scfq-common-api', 'scfq-consumer', 'scfq-buyer-api'
];

const TrafficSwitching = () => {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<MonitorMetric[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedService, setSelectedService] = useState('scfq-buyer-api');
  const [showHelp, setShowHelp] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRangeType>('1h');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [countdown, setCountdown] = useState(60);
  const [zoomMetric, setZoomMetric] = useState<MonitorMetric | null>(null);
  
  // 用 ref 存储最新的 timeRange，避免闭包问题
  const timeRangeRef = useRef(timeRange);
  timeRangeRef.current = timeRange;

  // 获取时间参数（每次调用都用最新值）
  const getTimeParams = () => {
    const now = Math.floor(Date.now() / 1000);
    const option = TIME_RANGE_OPTIONS.find(o => o.value === timeRangeRef.current);
    const seconds = option?.seconds || 3600;
    return { start: now - seconds, end: now };
  };

  // 刷新数据
  const refreshData = async () => {
    if (!selectedProject) return;
    
    setLoading(true);
    try {
      const { start, end } = getTimeParams();
      const service = selectedProject === 'scfq' ? selectedService : 'gateway';
      
      const res = await getMonitorMetricsList({
        project: selectedProject,
        category: 'trafficswitching',
        service,
        start: formatTimestamp(start),
        end: formatTimestamp(end),
      });
      
      if (res.code === 200 && res.data) {
        const items = Array.isArray(res.data) ? res.data : [];
        // 添加 updated_at 用于 memo 比较
        const processed = items.map(item => ({
          ...item,
          updated_at: new Date().toISOString(),
        }));
        setMetrics(processed);
      }
    } catch {
      toast.error('获取监控数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 项目变化时刷新
  useEffect(() => {
    if (selectedProject) refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject, selectedService]);

  // 时间范围变化处理
  const handleTimeRangeChange = (value: TimeRangeType) => {
    setTimeRange(value);
    timeRangeRef.current = value;
    setTimeout(() => refreshData(), 0);
  };

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh || !selectedProject) return;
    setCountdown(refreshInterval);
    const countdownTimer = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? refreshInterval : prev - 1));
    }, 1000);
    const refreshTimer = setInterval(() => {
      refreshData();
      setCountdown(refreshInterval);
    }, refreshInterval * 1000);
    return () => { clearInterval(countdownTimer); clearInterval(refreshTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, refreshInterval, selectedProject]);

  // 按类型分组指标
  const groupedMetrics = useMemo(() => {
    const sortFn = (a: MonitorMetric, b: MonitorMetric) => (a.sort || 0) - (b.sort || 0);
    const filter = (min: number, max: number) => 
      metrics.filter(m => ['stat', 'gauge'].includes(m.chart_type) && (m.sort || 0) >= min && (m.sort || 0) < max).sort(sortFn);
    return {
      lineMetrics: metrics.filter(m => m.chart_type === 'line').sort(sortFn),
      todayStats: filter(1, 10),
      totalStats: filter(30, 40),
      errorStats: filter(50, 60),
      cacheStats: filter(60, 70),
      runtimeStats: filter(70, 80),
    };
  }, [metrics]);

  return (
    <div className="monitor-page traffic-monitor">
      <div className="monitor-header">
        <div className="header-left">
          <h2 className="page-title">
            流量监控
            <span className="help-trigger" onClick={() => setShowHelp(!showHelp)}><HelpCircle size={16} /></span>
          </h2>
          {showHelp && (
            <div className="help-popover">
              <p className="help-desc">用于监听 Nginx 到流量插件再到后端 Gateway 之间的链路状况</p>
              <div className="flow-diagram">
                <div className="flow-node client"><User size={20} /><span>客户端</span></div>
                <div className="flow-arrow">→</div>
                <div className="flow-node nginx"><Globe size={20} /><span>Nginx</span></div>
                <div className="flow-arrow">→</div>
                <div className="flow-node plugin"><Shuffle size={20} /><span>流量插件</span></div>
                <div className="flow-arrow">→</div>
                <div className="flow-node gateway"><Monitor size={20} /><span>Gateway</span></div>
              </div>
            </div>
          )}
        </div>
        
        <div className="header-right">
          <ProjectSelector value={selectedProject} onChange={setSelectedProject} storageKey="monitor_traffic_project" apiType="metrics" />
          {selectedProject === 'scfq' && (
            <select className="service-select" value={selectedService} onChange={e => setSelectedService(e.target.value)}>
              {SERVICE_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <TimeRangeSelector value={timeRange} onChange={handleTimeRangeChange} disabled={autoRefresh} />
          <button className="btn-primary" onClick={refreshData} disabled={!selectedProject || loading}>
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />刷新
          </button>
          <AutoRefresh enabled={autoRefresh} onToggle={() => setAutoRefresh(!autoRefresh)} interval={refreshInterval} onIntervalChange={setRefreshInterval} countdown={countdown} disabled={!selectedProject} />
        </div>
      </div>

      <div className="monitor-content">
        {!selectedProject ? (
          <div className="empty-state">请先选择项目</div>
        ) : metrics.length === 0 ? (
          loading ? <div className="loading-state">加载中...</div> : <div className="empty-state">暂无数据</div>
        ) : (
          <div className="traffic-dashboard">
            <StatSection title="今日统计" items={groupedMetrics.todayStats} colSpan={3} />
            {groupedMetrics.lineMetrics.length > 0 && (
              <div className="section">
                <h3 className="section-title">📈 实时指标</h3>
                <div className="charts-grid">
                  {groupedMetrics.lineMetrics.map(m => (
                    <div key={m.view_id} className="chart-card">
                      <div className="chart-header" onClick={() => setZoomMetric(m)}>
                        <span>{m.view_name}</span>
                        <span className="chart-zoom-hint">点击放大</span>
                      </div>
                      <MetricChart metric={m} height={250} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <StatSection title="累计统计" items={groupedMetrics.totalStats} colSpan={6} />
            <StatSection title="错误统计" items={groupedMetrics.errorStats} colSpan={3} />
            <StatSection title="缓存配置" items={groupedMetrics.cacheStats} colSpan={12} />
            <StatSection title="运行时配置" items={groupedMetrics.runtimeStats} colSpan={6} />
          </div>
        )}
      </div>

      <ChartZoomDialog metric={zoomMetric} onClose={() => setZoomMetric(null)} />
    </div>
  );
};

export default TrafficSwitching;
