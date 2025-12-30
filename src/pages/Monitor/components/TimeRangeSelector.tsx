/**
 * 时间范围选择器组件
 */

import type { TimeRangeType } from '../../../types/monitor';
import { TIME_RANGE_OPTIONS } from '../hooks/useTimeRange';
import './TimeRangeSelector.css';

interface TimeRangeSelectorProps {
  value: TimeRangeType;
  onChange: (value: TimeRangeType) => void;
  customStart?: string;
  customEnd?: string;
  onCustomStartChange?: (value: string) => void;
  onCustomEndChange?: (value: string) => void;
  disabled?: boolean;
}

const TimeRangeSelector = ({
  value,
  onChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  disabled = false,
}: TimeRangeSelectorProps) => {
  return (
    <div className="time-range-selector">
      <select
        value={value}
        onChange={e => onChange(e.target.value as TimeRangeType)}
        disabled={disabled}
        className="time-select"
      >
        {TIME_RANGE_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        <option value="custom">自定义</option>
      </select>
      
      {value === 'custom' && (
        <div className="custom-range">
          <input
            type="datetime-local"
            value={customStart}
            onChange={e => onCustomStartChange?.(e.target.value)}
            disabled={disabled}
            className="datetime-input"
          />
          <span className="range-separator">至</span>
          <input
            type="datetime-local"
            value={customEnd}
            onChange={e => onCustomEndChange?.(e.target.value)}
            disabled={disabled}
            className="datetime-input"
          />
        </div>
      )}
    </div>
  );
};

export default TimeRangeSelector;
