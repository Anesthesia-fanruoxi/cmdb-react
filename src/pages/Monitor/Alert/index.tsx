/**
 * 告警监控页面
 */

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { getAlertList } from '../../../services/monitor';
import toast from '../../../components/Toast';
import './index.css';

interface AlertItem {
  alertName: string;
  status: 'firing' | 'resolved';
  summary: string;
  hostName: string;
  project: string;
  severity: 'critical' | 'warning' | 'info';
  startTime: string;
  endTime?: string;
  instance?: string;
}

const AlertMonitor = () => {
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  // 格式化时间
  const formatTime = (timeStr: string): string => {
    if (!timeStr) return '-';
    try {
      const date = new Date(timeStr);
      return date.toLocaleString('zh-CN');
    } catch {
      return timeStr;
    }
  };

  // 刷新数据
  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAlertList();
      
      if (res.code === 200 && res.data) {
        const data = (res.data as any).alerts || [];
        // 按开始时间降序排序
        const sorted = [...data].sort((a: AlertItem, b: AlertItem) => {
          const timeA = new Date(a.startTime).getTime();
          const timeB = new Date(b.startTime).getTime();
          return timeB - timeA;
        });
        setAlerts(sorted);
      } else {
        setAlerts([]);
      }
    } catch (err) {
      toast.error('获取告警数据失败');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, []);

  // 获取严重级别样式
  const getSeverityClass = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'severity-critical';
      case 'warning': return 'severity-warning';
      case 'info': return 'severity-info';
      default: return 'severity-warning';
    }
  };

  // 翻译严重程度
  const translateSeverity = (severity: string): string => {
    switch (severity) {
      case 'critical': return '严重';
      case 'warning': return '警告';
      case 'info': return '信息';
      default: return severity;
    }
  };

  return (
    <div className="monitor-page alert-monitor">
      <div className="monitor-header">
        <div className="header-left">
          <h2 className="page-title">告警通知列表</h2>
        </div>
        
        <div className="header-right">
          <button
            className="btn-primary"
            onClick={refreshData}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            刷新数据
          </button>
        </div>
      </div>

      <div className="monitor-content">
        {loading ? (
          <div className="loading-state">正在加载告警数据...</div>
        ) : alerts.length === 0 ? (
          <div className="empty-state">暂无告警数据</div>
        ) : (
          <div className="alert-list">
            {alerts.map((item, index) => (
              <div key={index} className={`alert-item ${getSeverityClass(item.severity)}`}>
                <div className="alert-header">
                  <span className="alert-title">{item.alertName}</span>
                  <span className={`alert-status ${item.status === 'firing' ? 'status-firing' : 'status-resolved'}`}>
                    {item.status === 'firing' ? '触发中' : '已解决'}
                  </span>
                </div>
                <div className="alert-info">
                  <div className="alert-detail">
                    <div className="summary">{item.summary}</div>
                  </div>
                  <div className="alert-meta">
                    <div className="meta-item">
                      <span className="label">主机:</span> {item.hostName || '-'}
                    </div>
                    <div className="meta-item">
                      <span className="label">项目:</span> {item.project || '-'}
                    </div>
                    <div className="meta-item">
                      <span className="label">严重性:</span>
                      <span className={`severity-tag ${getSeverityClass(item.severity)}`}>
                        {translateSeverity(item.severity)}
                      </span>
                    </div>
                    <div className="meta-item">
                      <span className="label">开始时间:</span> {formatTime(item.startTime)}
                    </div>
                    {item.endTime && (
                      <div className="meta-item">
                        <span className="label">结束时间:</span> {formatTime(item.endTime)}
                      </div>
                    )}
                    {item.instance && (
                      <div className="meta-item">
                        <span className="label">实例:</span> {item.instance}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertMonitor;
