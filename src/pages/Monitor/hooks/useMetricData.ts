/**
 * 监控数据管理 Hook
 */

import { useState, useCallback, useMemo } from 'react';
import type { MonitorMetric, ProjectOption, GetMetricsParams } from '../../../services/monitor';
import { getMetricsProjects, getAlertProjects, getMonitorMetricsList, getAlertList } from '../../../services/monitor';
import toast from '../../../components/Toast';

interface UseMetricDataOptions {
  category?: string;
}

export function useMetricData(options: UseMetricDataOptions = {}) {
  const { category = 'hardware' } = options;
  
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<MonitorMetric[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);

  /** 获取项目列表 */
  const fetchProjects = useCallback(async () => {
    setProjectLoading(true);
    try {
      // 根据分类选择不同的项目列表接口
      const res = category === 'alert' 
        ? await getAlertProjects()
        : await getMetricsProjects();
      
      if (res.code === 200 && res.data) {
        setProjectOptions(res.data);
      }
    } catch (err) {
      toast.error('获取项目列表失败');
    } finally {
      setProjectLoading(false);
    }
  }, [category]);

  /** 获取监控数据 */
  const fetchMetrics = useCallback(async (params: Partial<GetMetricsParams> = {}) => {
    if (!selectedProject) return;
    
    setLoading(true);
    try {
      let res;
      
      if (category === 'alert') {
        // 告警使用单独的接口
        res = await getAlertList();
      } else {
        // 其他监控使用 metrics/list 接口
        res = await getMonitorMetricsList({
          project: selectedProject,
          category,
          ...params,
        });
      }
      
      if (res.code === 200 && res.data) {
        // 处理数据，计算统计值
        const processedMetrics = (Array.isArray(res.data) ? res.data : []).map(item => {
          const values: number[] = [];
          const firstValues: number[] = [];
          const lastValues: number[] = [];
          
          if (item.data?.resultType === 'matrix' && item.data.result) {
            item.data.result.forEach(result => {
              if (result.values && result.values.length > 0) {
                firstValues.push(parseFloat(result.values[0][1]));
                lastValues.push(parseFloat(result.values[result.values.length - 1][1]));
                result.values.forEach(v => values.push(parseFloat(v[1])));
              }
            });
          }
          
          const validValues = values.filter(v => !isNaN(v));
          const avg = validValues.length > 0 
            ? validValues.reduce((sum, val) => sum + val, 0) / validValues.length 
            : 0;
          const max = validValues.length > 0 ? Math.max(...validValues) : 0;
          const min = validValues.length > 0 ? Math.min(...validValues) : 0;
          
          let trend = 0;
          if (firstValues.length > 0 && lastValues.length > 0) {
            const firstAvg = firstValues.reduce((s, v) => s + v, 0) / firstValues.length;
            const lastAvg = lastValues.reduce((s, v) => s + v, 0) / lastValues.length;
            if (firstAvg !== 0) {
              trend = ((lastAvg - firstAvg) / Math.abs(firstAvg)) * 100;
            }
          }
          
          return {
            ...item,
            avg,
            max,
            min,
            trend,
            hosts_count: item.data?.result?.length || 0,
            project: selectedProject,
          };
        });
        
        // 按 sort 字段排序
        processedMetrics.sort((a, b) => (a.sort || 0) - (b.sort || 0));
        setMetrics(processedMetrics);
      }
    } catch (err) {
      toast.error('获取监控数据失败');
    } finally {
      setLoading(false);
    }
  }, [selectedProject, category]);

  /** 按项目过滤的指标 */
  const filteredMetrics = useMemo(() => {
    if (!selectedProject) return [];
    return metrics.filter(m => m.project === selectedProject);
  }, [metrics, selectedProject]);

  /** 处理项目变更 */
  const handleProjectChange = useCallback((projectKey: string) => {
    setSelectedProject(projectKey);
    setMetrics([]);
  }, []);

  return {
    loading,
    projectLoading,
    metrics,
    filteredMetrics,
    selectedProject,
    projectOptions,
    setSelectedProject: handleProjectChange,
    fetchProjects,
    fetchMetrics,
  };
}
