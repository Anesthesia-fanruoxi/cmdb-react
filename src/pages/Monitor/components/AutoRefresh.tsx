/**
 * 自动刷新组件
 */

import { RefreshCw, Clock } from 'lucide-react';
import './AutoRefresh.css';

interface AutoRefreshProps {
  enabled: boolean;
  onToggle: () => void;
  interval: number;
  onIntervalChange: (value: number) => void;
  countdown: number;
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
  countdown,
  disabled = false,
}: AutoRefreshProps) => {
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
      
      {enabled && (
        <>
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
          
          <div className="countdown">
            <Clock size={12} />
            <span>{countdown}s</span>
          </div>
        </>
      )}
    </div>
  );
};

export default AutoRefresh;
