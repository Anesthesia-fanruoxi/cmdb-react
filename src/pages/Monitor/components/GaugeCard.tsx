/**
 * Gauge 进度条卡片组件
 * 用于容器监控中的 Pod 状态展示
 */

import { memo } from 'react';
import type { MonitorMetric } from '../../../services/monitor';
import './GaugeCard.css';

interface GaugeCardProps {
  metric: MonitorMetric;
}

interface GaugeItem {
  name: string;
  percentage: number;
  rawValue: number;
}

/** 根据百分比获取渐变色 */
const getGradientStyle = (percentage: number) => {
  const gradientWidth = percentage > 0 ? (100 / percentage) * 100 : 100;
  return {
    width: `${percentage}%`,
    background: `linear-gradient(90deg, 
      #67C23A 0%,
      #A3D344 15%,
      #E6A23C 40%,
      #F89838 60%,
      #F56C6C 80%,
      #E53E3E 100%
    )`,
    backgroundSize: `${gradientWidth}% 100%`,
  };
};

// 自定义比较函数：比较数据是否真正变化
const areEqual = (prev: GaugeCardProps, next: GaugeCardProps) => {
  if (prev.metric.view_id !== next.metric.view_id) return false;
  
  // 比较数据长度和第一个值
  const prevResult = prev.metric.data?.result;
  const nextResult = next.metric.data?.result;
  
  if (!prevResult && !nextResult) return true;
  if (!prevResult || !nextResult) return false;
  if (prevResult.length !== nextResult.length) return false;
  
  return prevResult[0]?.value?.[1] === nextResult[0]?.value?.[1];
};

const GaugeCard = memo(({ metric }: GaugeCardProps) => {
  // 格式化 Gauge 数据（数据已在页面层过滤，这里只做格式化）
  const formatGaugeData = (): GaugeItem[] => {
    if (!metric.data?.result) return [];
    
    const standard = metric.standard || 'default';
    
    // 格式化数据（与 Vue 的 formatGaugeData 一致）
    return metric.data.result
      .map(item => {
        // Vue 使用 podName 作为显示名称
        const name = item.metric?.podName || '未知Pod';
        const rawValue = item.value ? parseFloat(item.value[1]) : 0;
        
        let percentage = 0;
        if (standard === 'percent(0-1)') {
          percentage = Math.min(rawValue * 100, 100);
        } else if (standard === 'percent(1-100)') {
          percentage = Math.min(rawValue, 100);
        } else {
          percentage = Math.min(rawValue * 100, 100);
        }
        
        return { name, percentage: Math.max(percentage, 0), rawValue };
      })
      .sort((a, b) => b.percentage - a.percentage);
  };

  const gaugeData = formatGaugeData();
  // 使用 hosts_count 作为总数（未过滤前的数量）
  const totalCount = metric.hosts_count || metric.data?.result?.length || 0;

  return (
    <div className="gauge-card">
      <div className="gauge-header">
        <span className="gauge-title">{metric.view_name}</span>
        <span className="gauge-count">
          {gaugeData.length} / {totalCount}个
        </span>
      </div>
      
      <div className="gauge-content">
        {gaugeData.length === 0 ? (
          <div className="gauge-empty">暂无数据</div>
        ) : (
          gaugeData.map((item, index) => (
            <div key={index} className="gauge-item">
              <div className="gauge-name" title={item.name}>
                {item.name}
              </div>
              <div className="gauge-bar-wrapper">
                <div className="gauge-bar-bg">
                  <div
                    className="gauge-bar-fill"
                    style={getGradientStyle(item.percentage)}
                  />
                </div>
                <span className="gauge-percentage">
                  {item.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}, areEqual);

GaugeCard.displayName = 'GaugeCard';

export default GaugeCard;
