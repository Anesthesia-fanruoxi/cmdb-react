/**
 * 统计区域组件
 */

import { memo } from 'react';
import type { MonitorMetric } from '../../../../services/monitor';
import { FlipCard } from './FlipCard';
import './StatSection.css';

interface StatSectionProps {
  title: string;
  items: MonitorMetric[];
  colSpan?: number;
}

export const StatSection = memo(({ title, items, colSpan = 6 }: StatSectionProps) => {
  if (items.length === 0) return null;

  const cols = Math.floor(24 / colSpan);
  const gridStyle = { gridTemplateColumns: `repeat(${cols}, 1fr)` };

  return (
    <div className="stat-section">
      <h3 className="section-title">📊 {title}</h3>
      <div className="stat-grid" style={gridStyle}>
        {items.map(item => (
          <FlipCard key={item.view_id} item={item} />
        ))}
      </div>
    </div>
  );
});

StatSection.displayName = 'StatSection';

export default StatSection;
