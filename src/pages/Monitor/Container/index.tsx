/**
 * 容器监控页面
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import type { TimeRangeType } from '../../../types/monitor';
import { TIME_RANGE_OPTIONS } from '../hooks/useTimeRange';
import { getMonitorMetricsList, getMonitorMetricsSSE } from '../../../services/monitor';
import type { MonitorMetric } from '../../../services/monitor';
import { extractContainerNames, filterMetricsByContainer } from '../utils/chart';
import { formatTimestamp } from '../utils/format';
import { getToken } from '../../../services/storage/tokenStorage';
import {
  ProjectSelector,
  TimeRangeSelector,
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
  
  const timeRangeRef = useRef(timeRange);
  const eventSourceRef = useRef<EventSource | null>(null);
  timeRangeRef.current = timeRange;

  // 可用的 Namespace 列表
  const availableNamespaces = useMemo(() => NAMESPACE_CONFIG[selectedProject] || [], [selectedProject]);

  // 关闭 SSE 连接
  const closeSSE = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      console.log('[容器监控] SSE 连接已关闭');
    }
  };

  // 获取时间参数
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
          updated_at: Date.now(),
          forceReload: true, // 手动刷新，标记为强制重载
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

  // 启动 SSE 实时数据流（自动刷新模式）
  const startSSE = async () => {
    if (!selectedProject) return;
    
    closeSSE(); // 先关闭旧连接
    
    // 先获取最近1小时的完整数据
    setLoading(true);
    try {
      const now = Math.floor(Date.now() / 1000);
      const oneHourAgo = now - 3600;
      const res = await getMonitorMetricsList({
        project: selectedProject,
        category: 'container',
        start: formatTimestamp(oneHourAgo),
        end: formatTimestamp(now),
        namespace: selectedNamespace || undefined,
      });
      
      if (res.code === 200 && res.data) {
        const items = Array.isArray(res.data) ? res.data : [];
        const processed = items.map(item => ({
          ...item,
          hosts_count: item.data?.result?.length || 0,
          project: selectedProject,
          category: 'container',
          updated_at: Date.now(),
          forceReload: true, // 首次加载，标记为强制重载
        }));
        processed.sort((a, b) => (a.sort || 0) - (b.sort || 0));
        setMetrics(processed);
      }
    } catch (err) {
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

    console.log('[容器监控] 启动 SSE 连接, namespace:', selectedNamespace);
    const eventSource = getMonitorMetricsSSE(
      {
        project: selectedProject,
        category: 'container',
        namespace: selectedNamespace,
        token,
      },
      (data) => {
        // 将 vector 数据追加到现有的 matrix 数据中
        setMetrics(prevMetrics => {
          return prevMetrics.map(oldItem => {
            // 查找对应的新数据
            const newItem = data.find(d => d.view_id === oldItem.view_id);
            if (!newItem || newItem.data?.resultType !== 'vector' || !newItem.data.result) {
              return oldItem;
            }
            
            // matrix 数据必须存在
            if (oldItem.data?.resultType !== 'matrix' || !oldItem.data.result) {
              return oldItem;
            }
            
            // 更新每个容器的数据
            const updatedResult = oldItem.data.result.map(oldResult => {
              // 查找对应容器的新数据
              const newResult = newItem.data!.result.find(
                r => r.metric.container === oldResult.metric.container
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
  }, [selectedProject, selectedNamespace]);

  // 组件卸载时关闭 SSE
  useEffect(() => {
    return () => {
      console.log('[容器监控] 组件卸载，关闭 SSE');
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
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn-primary"
              onClick={refreshData}
              disabled={!selectedProject || loading || autoRefresh}
            >
              <RefreshCw size={14} className={loading || autoRefresh ? 'spinning' : ''} />
              {autoRefresh ? '自动刷新' : '刷新数据'}
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
