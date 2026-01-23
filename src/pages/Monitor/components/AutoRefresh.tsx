/**
 * 自动刷新组件
 */

import { RefreshCw } from 'lucide-react';
import './AutoRefresh.css';

interface AutoRefreshProps {
  enabled: boolean;
  onToggle: () => void;
  interval: number;
  onIntervalChange: (value: number) => void;
  countdown: number; // 保留参数以兼容现有调用
  disabled?: boolean;
}

const INTERVAL_OPTIONS = [
  { label: '30秒', value: 30 },
  { label: '1分钟', value: 60 },
  { label: '2分钟', value: 120 },
  { label: '5分钟', value: 300 },
];

const AutoRefresh = ({
  enabled,
  onToggle,
  interval,
  onIntervalChange,
  disabled = false,
}: AutoRefreshProps) => {
  // 是否显示间隔选择器（间隔为5秒时不显示，表示固定间隔）
  const showIntervalSelect = interval !== 5;
  
  return (
    <div className="auto-refresh">
      <button
        className={`refresh-toggle ${enabled ? 'active' : ''}`}
        onClick={onToggle}
        disabled={disabled}
        title={enabled ? '关闭自动刷新' : '开启自动刷新'}
      >
        <RefreshCw size={14} className={enabled ? 'spinning' : ''} />
        <span>自动刷新</span>
      </button>
      
      {enabled && showIntervalSelect && (
        <select
          value={interval}
          onChange={e => onIntervalChange(Number(e.target.value))}
          className="interval-select"
          disabled={disabled}
        >
          {INTERVAL_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

export default AutoRefresh;
