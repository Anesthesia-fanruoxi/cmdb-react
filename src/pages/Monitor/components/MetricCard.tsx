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
  
  // 比较数据结果数量
  const prevResultCount = prev.metric.data?.result?.length || 0;
  const nextResultCount = next.metric.data?.result?.length || 0;
  if (prevResultCount !== nextResultCount) return false;
  
  // 如果都没有数据，认为相等
  if (prevResultCount === 0 && nextResultCount === 0) return true;
  
  // 比较第一个结果的数据（支持 matrix 和 vector 类型）
  const prevResult = prev.metric.data?.result?.[0];
  const nextResult = next.metric.data?.result?.[0];
  
  if (!prevResult || !nextResult) return false;
  
  // matrix 类型：比较 values 数组的长度和最后一个时间戳
  if (prevResult.values && nextResult.values) {
    if (prevResult.values.length !== nextResult.values.length) return false;
    // 只比较最后一个数据点的时间戳和值，避免比较整个数组
    const prevLast = prevResult.values[prevResult.values.length - 1];
    const nextLast = nextResult.values[nextResult.values.length - 1];
    return prevLast?.[0] === nextLast?.[0] && prevLast?.[1] === nextLast?.[1];
  }
  
  // vector 类型：比较 value
  if (prevResult.value && nextResult.value) {
    return prevResult.value[0] === nextResult.value[0] && 
           prevResult.value[1] === nextResult.value[1];
  }
  
  // 数据类型不一致，认为不相等
  return false;
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
