/**
 * SSL 证书监控页面
 * 表格形式展示证书列表
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { getMonitorMetricsList } from '../../../services/monitor';
import type { MonitorMetric } from '../../../services/monitor';
import { ProjectSelector } from '../components';
import { formatTimestamp, getStatusType } from '../utils/format';
import type { SSLCertItem } from '../../../types/monitor';
import toast from '../../../components/Toast';
import '../styles/common.css';
import './index.css';

const SSLMonitor = () => {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<MonitorMetric[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  // 刷新数据
  const refreshData = useCallback(async () => {
    if (!selectedProject) return;
    
    setLoading(true);
    try {
      const now = new Date();
      const end = formatTimestamp(Math.floor(now.getTime() / 1000));
      const start = formatTimestamp(Math.floor((now.getTime() - 24 * 60 * 60 * 1000) / 1000));
      
      const res = await getMonitorMetricsList({
        project: selectedProject,
        category: 'ssl',
        start,
        end,
      });
      
      if (res.code === 200 && res.data) {
        setMetrics(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      toast.error('获取监控数据失败');
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  // 项目变化时刷新数据
  useEffect(() => {
    if (selectedProject) {
      refreshData();
    }
  }, [selectedProject]);

  // 格式化表格数据
  const tableData = useMemo((): SSLCertItem[] => {
    const items: SSLCertItem[] = [];
    
    metrics.forEach(metric => {
      if (!metric.data?.result) return;
      
      metric.data.result.forEach(result => {
        let timestamp: number, value: string;
        
        if (result.values && result.values.length > 0) {
          const lastValue = result.values[result.values.length - 1];
          timestamp = lastValue[0];
          value = lastValue[1];
        } else if (result.value) {
          timestamp = result.value[0];
          value = result.value[1];
        } else {
          return;
        }
        
        const domain = result.metric.domain || '未知域名';
        const comment = result.metric.comment || '-';
        const status = result.metric.status || '未知';
        const project = result.metric.project || '-';
        const days = parseInt(value) || 0;
        
        items.push({
          domain,
          comment,
          days,
          status,
          project,
          updateTime: formatTimestamp(timestamp),
        });
      });
    });
    
    // 过滤和排序
    return items
      .filter(item => {
        if (item.status !== '正常') return false;
        if (!searchKeyword.trim()) return true;
        const keyword = searchKeyword.toLowerCase();
        return item.domain.toLowerCase().includes(keyword) ||
               item.comment.toLowerCase().includes(keyword);
      })
      .sort((a, b) => {
        if (a.days !== b.days) return a.days - b.days;
        return a.comment.localeCompare(b.comment);
      });
  }, [metrics, searchKeyword]);

  // 获取天数样式
  const getDaysClass = (days: number): string => {
    if (days < 0) return 'days-expired';
    if (days <= 7) return 'days-critical';
    if (days <= 30) return 'days-warning';
    return 'days-normal';
  };

  // 获取行样式
  const getRowClass = (days: number): string => {
    if (days < 0) return 'row-expired';
    if (days <= 7) return 'row-critical';
    if (days <= 30) return 'row-warning';
    return '';
  };

  return (
    <div className="monitor-page ssl-monitor">
      <div className="monitor-header">
        <div className="header-left">
          <h2 className="page-title">SSL证书监控</h2>
          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              placeholder="搜索域名或备注"
            />
          </div>
        </div>
        
        <div className="header-right">
          <ProjectSelector
            value={selectedProject}
            onChange={setSelectedProject}
            storageKey="monitor_ssl_project"
            apiType="metrics"
          />
          
          <button
            className="btn-primary"
            onClick={refreshData}
            disabled={!selectedProject || loading}
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            刷新数据
          </button>
        </div>
      </div>

      <div className="monitor-content">
        {loading ? (
          <div className="loading-state">加载中...</div>
        ) : !selectedProject ? (
          <div className="empty-state">请先选择项目</div>
        ) : tableData.length === 0 ? (
          <div className="empty-state">暂无数据</div>
        ) : (
          <div className="table-container">
            <table className="ssl-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>序号</th>
                  <th>域名</th>
                  <th>备注</th>
                  <th style={{ width: 100 }}>剩余天数</th>
                  <th style={{ width: 80 }}>状态</th>
                  <th style={{ width: 100 }}>项目</th>
                  <th style={{ width: 160 }}>更新时间</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((item, index) => (
                  <tr key={index} className={getRowClass(item.days)}>
                    <td>{index + 1}</td>
                    <td className="domain-cell">{item.domain}</td>
                    <td>{item.comment}</td>
                    <td>
                      <span className={getDaysClass(item.days)}>
                        {item.days}天
                      </span>
                    </td>
                    <td>
                      <span className={`status-tag ${getStatusType(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>{item.project}</td>
                    <td>{item.updateTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SSLMonitor;
