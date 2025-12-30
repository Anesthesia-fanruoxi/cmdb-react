/**
 * 指标卡片组件
 */

import { useState, memo } from 'react';
import { Server, Info } from 'lucide-react';
import type { MonitorMetric } from '../../../services/monitor';
import { formatTimestamp, truncateString } from '../utils/format';
import MetricChart from './MetricChart';
import MetricDetailDialog from './MetricDetailDialog';
import './MetricCard.css';

interface MetricCardProps {
  metric: MonitorMetric;
  hideLegends?: boolean;
}

// 自定义比较函数：比较数据是否真正变化
const areEqual = (prev: MetricCardProps, next: MetricCardProps) => {
  if (prev.metric.view_id !== next.metric.view_id) return false;
  if (prev.hideLegends !== next.hideLegends) return false;
  
  // 比较数据的首尾时间戳
  const prevData = prev.metric.data?.result?.[0]?.values;
  const nextData = next.metric.data?.result?.[0]?.values;
  
  if (!prevData && !nextData) return true;
  if (!prevData || !nextData) return false;
  if (prevData.length !== nextData.length) return false;
  
  return prevData[0]?.[0] === nextData[0]?.[0] && 
         prevData[prevData.length - 1]?.[0] === nextData[nextData.length - 1]?.[0];
};

const MetricCard = memo(({ metric }: MetricCardProps) => {
  const [detailVisible, setDetailVisible] = useState(false);

  return (
    <>
      <div className="metric-card">
        <div className="card-header">
          <div className="header-left">
            <span className="metric-name">{metric.view_name}</span>
            <div className="metric-meta">
              {metric.hosts_count !== undefined && metric.hosts_count > 0 && (
                <span className="hosts-count">
                  <Server size={12} />
                  {metric.hosts_count}{metric.category === 'container' ? '个服务' : '台主机'}
                </span>
              )}
              <span className="update-time">
                更新于: {formatTimestamp(metric.updated_at)}
              </span>
              {metric.query && (
                <span className="query-info" title={metric.query}>
                  <Info size={12} />
                  {truncateString(metric.query, 30)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="card-body">
          <MetricChart
            metric={metric}
            height={320}
            onDoubleClick={() => setDetailVisible(true)}
          />
        </div>
      </div>
      
      <MetricDetailDialog
        visible={detailVisible}
        metric={metric}
        onClose={() => setDetailVisible(false)}
      />
    </>
  );
}, areEqual);

MetricCard.displayName = 'MetricCard';

export default MetricCard;
