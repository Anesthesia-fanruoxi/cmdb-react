/**
 * 流量切换监控页面
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { RefreshCw, HelpCircle, User, Globe, Shuffle, Monitor } from 'lucide-react';
import { getMonitorMetricsList, getMonitorMetricsSSE } from '@/services/monitor';
import type { MonitorMetric } from '@/services/monitor';
import type { TimeRangeType } from '@/types/monitor';
import { ProjectSelector, TimeRangeSelector, MetricChart, ChartZoomDialog } from '../components';
import { TIME_RANGE_OPTIONS } from '../hooks/useTimeRange';
import { formatTimestamp } from '../utils/format';
import { getToken } from '@/services/storage/tokenStorage';
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
  const [zoomMetric, setZoomMetric] = useState<MonitorMetric | null>(null);
  
  // 用 ref 存储最新的 timeRange，避免闭包问题
  const timeRangeRef = useRef(timeRange);
  const eventSourceRef = useRef<EventSource | null>(null);
  timeRangeRef.current = timeRange;

  // 关闭 SSE 连接
  const closeSSE = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  // 获取时间参数（每次调用都用最新值）
  const getTimeParams = () => {
    const now = Math.floor(Date.now() / 1000);
    const option = TIME_RANGE_OPTIONS.find(o => o.value === timeRangeRef.current);
    const seconds = option?.seconds || 3600;
    return { start: now - seconds, end: now };
  };

  // 刷新数据（普通模式）
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
          updated_at: Date.now(),
          forceReload: true, // 手动刷新，标记为强制重载
        }));
        setMetrics(processed);
      }
    } catch {
      toast.error('获取监控数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 启动 SSE 实时数据流（自动刷新模式）
  const startSSE = async () => {
    if (!selectedProject) return;
    
    closeSSE(); // 先关闭旧连接
    
    const service = selectedProject === 'scfq' ? selectedService : 'gateway';
    
    // 先获取最近1小时的完整数据
    setLoading(true);
    try {
      const now = Math.floor(Date.now() / 1000);
      const oneHourAgo = now - 3600;
      const res = await getMonitorMetricsList({
        project: selectedProject,
        category: 'trafficswitching',
        service,
        start: formatTimestamp(oneHourAgo),
        end: formatTimestamp(now),
      });
      
      if (res.code === 200 && res.data) {
        const items = Array.isArray(res.data) ? res.data : [];
        const processed = items.map(item => ({
          ...item,
          updated_at: Date.now(),
          forceReload: true, // 首次加载，标记为强制重载
        }));
        setMetrics(processed);
      }
    } catch {
      toast.error('获取初始数据失败');
      setAutoRefresh(false);
      setLoading(false);
      return;
    }
    setLoading(false);
    
    // 然后启动 SSE 接收实时数据
    const token = getToken();
    if (!token) {
      toast.error('未找到认证令牌');
      setAutoRefresh(false);
      return;
    }

    const eventSource = getMonitorMetricsSSE(
      {
        project: selectedProject,
        category: 'trafficswitching',
        service,
        token,
      },
      (data) => {
        // 将 vector 数据追加到现有的 matrix 数据中
        setMetrics(prevMetrics => {
          return prevMetrics.map(oldItem => {
            // 查找对应的新数据
            const newItem = data.find(d => d.view_id === oldItem.view_id);
            if (!newItem) {
              return oldItem;
            }
            
            // 只处理折线图类型
            if (oldItem.chart_type !== 'line') {
              return {
                ...newItem,
                updated_at: Date.now(),
                forceReload: false, // 非折线图，不重载
              };
            }
            
            // vector 数据追加到 matrix
            if (newItem.data?.resultType !== 'vector' || !newItem.data.result) {
              return oldItem;
            }
            
            // matrix 数据必须存在
            if (oldItem.data?.resultType !== 'matrix' || !oldItem.data.result) {
              return oldItem;
            }
            
            // 更新每个系列的数据
            const updatedResult = oldItem.data.result.map(oldResult => {
              // 查找对应的新数据
              const newResult = newItem.data!.result.find(
                r => JSON.stringify(r.metric) === JSON.stringify(oldResult.metric)
              );
              
              if (!newResult?.value || !oldResult.values) {
                return oldResult;
              }
              
              // 追加新数据点，移除最旧的数据点（保持数据点数量不变）
              const newValues = [...oldResult.values, newResult.value];
              if (newValues.length > oldResult.values.length) {
                newValues.shift(); // 移除第一个（最旧的）数据点
              }
              
              return {
                ...oldResult,
                values: newValues,
              };
            });
            
            return {
              ...oldItem,
              data: {
                ...oldItem.data,
                result: updatedResult,
              },
              updated_at: Date.now(),
              forceReload: false, // SSE 增量更新，不重载
            };
          });
        });
      },
      () => {
        toast.error('实时数据连接失败');
        setAutoRefresh(false);
      }
    );
    
    eventSourceRef.current = eventSource;
  };

  // 项目变化时刷新
  useEffect(() => {
    if (selectedProject) {
      closeSSE();
      if (autoRefresh) {
        setTimeRange('1h');
        timeRangeRef.current = '1h';
        startSSE();
      } else {
        refreshData();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject, selectedService]);

  // 组件卸载时关闭 SSE
  useEffect(() => {
    return () => {
      closeSSE();
    };
  }, []);

  // 时间范围变化处理
  const handleTimeRangeChange = (value: TimeRangeType) => {
    setTimeRange(value);
    timeRangeRef.current = value;
    setTimeout(() => refreshData(), 0);
  };

  // 自动刷新开关切换
  const handleAutoRefreshToggle = () => {
    const newValue = !autoRefresh;
    setAutoRefresh(newValue);
    
    if (newValue) {
      // 开启自动刷新：固定时间范围为1小时，启动 SSE
      setTimeRange('1h');
      timeRangeRef.current = '1h';
      startSSE();
    } else {
      // 关闭自动刷新：关闭 SSE，恢复普通查询
      closeSSE();
      refreshData();
    }
  };

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

  // 当 metrics 更新时同步更新 zoomMetric，确保全屏图表实时更新
  useEffect(() => {
    if (zoomMetric) {
      const updated = metrics.find(m => m.view_id === zoomMetric.view_id);
      if (updated && updated !== zoomMetric) {
        setZoomMetric(updated);
      }
    }
  }, [metrics, zoomMetric]);

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
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="btn-primary" onClick={refreshData} disabled={!selectedProject || loading || autoRefresh}>
              <RefreshCw size={14} className={loading || autoRefresh ? 'spinning' : ''} />
              {autoRefresh ? '自动刷新' : '刷新'}
            </button>
            
            <label className="switch" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={handleAutoRefreshToggle}
                disabled={!selectedProject}
              />
              <span className="slider"></span>
            </label>
          </div>
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
