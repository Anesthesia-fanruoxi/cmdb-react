/**
 * 翻转卡片组件
 */

import { useState, useMemo, memo } from 'react';
import type { MonitorMetric } from '../../../../services/monitor';
import './FlipCard.css';

interface FlipCardProps {
  item: MonitorMetric;
}

// 从指标数据中提取值
const extractValue = (data: MonitorMetric['data']): number => {
  if (!data?.result || data.result.length === 0) return 0;
  if (data.resultType === 'vector') {
    return parseFloat(data.result[0]?.value?.[1] || '0');
  }
  return 0;
};

// 格式化数字（支持亿、万）
const formatNumber = (num: number): string => {
  if (isNaN(num)) return '0';
  if (num >= 100000000) {
    const yi = Math.floor(num / 100000000);
    const wan = Math.floor((num % 100000000) / 10000);
    return wan > 0 ? `${yi}亿${wan}万` : `${yi}亿`;
  }
  if (num >= 10000) {
    return (num / 10000).toFixed(2).replace(/\.?0+$/, '') + '万';
  }
  return num.toFixed(0);
};

// 自定义比较函数：比较数据是否真正变化
const areEqual = (prev: FlipCardProps, next: FlipCardProps) => {
  if (prev.item.view_id !== next.item.view_id) return false;
  
  // 比较 vector 类型数据的值
  const prevValue = prev.item.data?.result?.[0]?.value?.[1];
  const nextValue = next.item.data?.result?.[0]?.value?.[1];
  
  return prevValue === nextValue;
};

export const FlipCard = memo(({ item }: FlipCardProps) => {
  const [flipped, setFlipped] = useState(false);

  const isPercent = item.standard?.includes('percent') || item.query?.includes('success_rate');
  const value = extractValue(item.data);
  
  const formattedValue = useMemo(() => {
    if (isPercent) return (value * 100).toFixed(4) + '%';
    return formatNumber(value);
  }, [value, isPercent]);

  const rawValue = useMemo(() => {
    if (isPercent) return (value * 100).toFixed(4) + '%';
    return value.toLocaleString();
  }, [value, isPercent]);

  // 卡片样式
  const cardClass = useMemo(() => {
    const query = item.query || '';
    const name = item.view_name || '';
    
    if (['2xx', '3xx', '4xx', '5xx'].some(s => name.includes(s))) return 'success';
    if (query.includes('success') && !query.includes('rate')) return 'success';
    if (query.includes('error') || query.includes('fail')) return 'danger';
    if (query.includes('success_rate')) {
      if (value >= 0.99) return 'success';
      if (value >= 0.95) return 'warning';
      return 'danger';
    }
    return '';
  }, [item, value]);

  // 状态注释
  const statusNote = useMemo(() => {
    const name = item.view_name || '';
    const query = item.query || '';
    
    if (name.includes('取消')) return '客户端主动取消';
    if (name.includes('2xx')) return '成功';
    if (name.includes('3xx')) return '重定向，代理成功';
    if (name.includes('4xx')) return '后端返回客户端错误，但代理成功转发';
    if (name.includes('5xx')) return '后端返回服务端错误，但代理成功转发';
    if (query.includes('connection_refused')) return '后端拒绝连接';
    if (query.includes('timeout')) return '连接/响应超时';
    if (query.includes('dns_error')) return 'DNS 解析失败';
    if (query.includes('connection_reset')) return '连接被重置';
    if (query.includes('eof')) return '后端意外关闭连接';
    if (query.includes('broken_pipe')) return '写入时连接已断';
    return '';
  }, [item]);

  return (
    <div className="flip-card" onClick={() => setFlipped(!flipped)}>
      <div className={`flip-card-inner ${flipped ? 'flipped' : ''}`}>
        <div className={`flip-card-front stat-card ${cardClass}`}>
          <div className="stat-value">{formattedValue}</div>
          <div className="stat-label">{item.view_name}</div>
        </div>
        <div className={`flip-card-back stat-card ${cardClass}`}>
          <div className="stat-value raw">{rawValue}</div>
          <div className="stat-label">{item.view_name}</div>
          {statusNote && <div className="stat-note">{statusNote}</div>}
        </div>
      </div>
    </div>
  );
}, areEqual);

FlipCard.displayName = 'FlipCard';

export default FlipCard;
