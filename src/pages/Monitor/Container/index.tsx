/**
 * 容器监控页面
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import type { TimeRangeType } from '../../../types/monitor';
import { TIME_RANGE_OPTIONS } from '../hooks/useTimeRange';
import { getMonitorMetricsList } from '../../../services/monitor';
import type { MonitorMetric } from '../../../services/monitor';
import { extractContainerNames, filterMetricsByContainer } from '../utils/chart';
import { formatTimestamp } from '../utils/format';
import {
  ProjectSelector,
  TimeRangeSelector,
  AutoRefresh,
  MetricCard,
  GaugeCard,
} from '../components';
import toast from '../../../components/Toast';
import '../styles/common.css';
import './index.css';

// Namespace 配置
const NAMESPACE_CONFIG: Record<string, string[]> = {
  'scfq': ['scfq-service', 'mhg-service'],
  'jxh': ['jxh-service', 'jxh-risk-service', 'jxh-dh-service'],
  'ysh': ['ysh-service', 'ysh-risk-service'],
};

const ContainerMonitor = () => {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<MonitorMetric[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedContainer, setSelectedContainer] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRangeType>('1h');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [countdown, setCountdown] = useState(60);
  
  const timeRangeRef = useRef(timeRange);
  timeRangeRef.current = timeRange;

  // 可用的 Namespace 列表
  const availableNamespaces = useMemo(() => NAMESPACE_CONFIG[selectedProject] || [], [selectedProject]);

  // 获取时间参数
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
      const res = await getMonitorMetricsList({
        project: selectedProject,
        category: 'container',
        start: formatTimestamp(start),
        end: formatTimestamp(end),
        namespace: selectedNamespace || undefined,
      });
      
      if (res.code === 200 && res.data) {
        const items = Array.isArray(res.data) ? res.data : [];
        const processed = items.map(item => ({
          ...item,
          hosts_count: item.data?.result?.length || 0,
          project: selectedProject,
          category: 'container',
          updated_at: new Date().toISOString(),
        }));
        processed.sort((a, b) => (a.sort || 0) - (b.sort || 0));
        setMetrics(processed);
      }
    } catch (err) {
      toast.error('获取监控数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 项目变化时设置默认 Namespace
  useEffect(() => {
    const namespaces = NAMESPACE_CONFIG[selectedProject] || [];
    if (namespaces.length > 0) {
      setSelectedNamespace(namespaces[0]);
    } else {
      setSelectedNamespace('');
    }
    setSelectedContainer('');
  }, [selectedProject]);

  // 项目或 Namespace 变化时刷新数据
  useEffect(() => {
    if (selectedProject) refreshData();
  }, [selectedProject, selectedNamespace]);

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
  }, [autoRefresh, refreshInterval, selectedProject]);

  // 提取可用容器列表
  const availableContainers = useMemo(() => extractContainerNames(metrics), [metrics]);

  // 按容器过滤的指标
  const displayMetrics = useMemo(() => filterMetricsByContainer(metrics, selectedContainer), [metrics, selectedContainer]);

  return (
    <div className="monitor-page container-monitor">
      <div className="monitor-header">
        <div className="header-left">
          <h2 className="page-title">容器监控</h2>
        </div>
        
        <div className="header-right">
          <ProjectSelector
            value={selectedProject}
            onChange={setSelectedProject}
            storageKey="monitor_container_project"
            apiType="metrics"
          />
          
          {availableNamespaces.length > 0 && (
            <select
              value={selectedNamespace}
              onChange={e => setSelectedNamespace(e.target.value)}
              className="namespace-select"
              disabled={!selectedProject}
            >
              {availableNamespaces.map(ns => (
                <option key={ns} value={ns}>{ns}</option>
              ))}
            </select>
          )}
          
          <select
            value={selectedContainer}
            onChange={e => setSelectedContainer(e.target.value)}
            className="container-select"
            disabled={!selectedProject}
          >
            <option value="">全部控制器</option>
            {availableContainers.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          
          <TimeRangeSelector
            value={timeRange}
            onChange={handleTimeRangeChange}
            disabled={autoRefresh}
          />
          
          <button
            className="btn-primary"
            onClick={refreshData}
            disabled={!selectedProject || loading}
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            刷新数据
          </button>
          
          <AutoRefresh
            enabled={autoRefresh}
            onToggle={() => setAutoRefresh(!autoRefresh)}
            interval={refreshInterval}
            onIntervalChange={setRefreshInterval}
            countdown={countdown}
            disabled={!selectedProject}
          />
        </div>
      </div>

      <div className="monitor-content">
        {!selectedProject ? (
          <div className="empty-state">请先选择项目</div>
        ) : metrics.length === 0 ? (
          loading ? <div className="loading-state">加载中...</div> : <div className="empty-state">暂无数据</div>
        ) : (
          <div className="metrics-grid">
            {displayMetrics.map((metric, index) => (
              metric.chart_type === 'gauge' ? (
                <GaugeCard key={metric.view_id || `gauge-${index}`} metric={metric} />
              ) : (
                <MetricCard key={metric.view_id || `chart-${index}`} metric={{ ...metric, category: 'container' }} />
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContainerMonitor;
