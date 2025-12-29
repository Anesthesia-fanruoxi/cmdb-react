/**
 * 时间范围选择器 - 弹框形式
 * 支持快捷选择和自定义时间
 */

import { useState, useEffect, useRef } from 'react';

interface TimeRange {
  start: string;
  end: string;
  label?: string;
}

interface Props {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

// 格式化本地时间
const formatLocalDateTime = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// 快捷选项配置
const shortcuts = {
  minute: [
    { label: '过去15分钟', value: '15m', ms: 15 * 60 * 1000 },
    { label: '过去30分钟', value: '30m', ms: 30 * 60 * 1000 },
    { label: '过去45分钟', value: '45m', ms: 45 * 60 * 1000 },
  ],
  hour: [
    { label: '近1小时', value: '1h', ms: 1 * 3600 * 1000 },
    { label: '近3小时', value: '3h', ms: 3 * 3600 * 1000 },
    { label: '近6小时', value: '6h', ms: 6 * 3600 * 1000 },
    { label: '近12小时', value: '12h', ms: 12 * 3600 * 1000 },
  ],
  day: [
    { label: '今日', value: 'today', getRange: () => {
      const now = new Date();
      return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: now };
    }},
    { label: '昨日', value: 'yesterday', getRange: () => {
      const now = new Date();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start: new Date(end.getTime() - 24 * 3600 * 1000), end };
    }},
    { label: '近3天', value: '3d', ms: 3 * 24 * 3600 * 1000 },
    { label: '近7天', value: '7d', ms: 7 * 24 * 3600 * 1000 },
  ],
  month: [
    { label: '本月', value: 'thisMonth', getRange: () => {
      const now = new Date();
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    }},
    { label: '上月', value: 'lastMonth', getRange: () => {
      const now = new Date();
      const end = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end };
    }},
    { label: '近1个月', value: '1M', ms: 30 * 24 * 3600 * 1000 },
    { label: '近3个月', value: '3M', ms: 90 * 24 * 3600 * 1000 },
  ],
};

const TimeRangePicker = ({ value, onChange }: Props) => {
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'quick' | 'custom'>('quick');
  const [selected, setSelected] = useState(value.label || 'today');
  const [customRange, setCustomRange] = useState({ start: value.start, end: value.end });
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };
    if (visible) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [visible]);

  const getShortcutRange = (item: any): { start: Date; end: Date } => {
    if (item.getRange) return item.getRange();
    const now = new Date();
    return { start: new Date(now.getTime() - item.ms), end: now };
  };

  const handleQuickSelect = (item: any) => {
    setSelected(item.value);
  };

  const handleConfirm = () => {
    if (activeTab === 'quick') {
      // 找到选中的快捷选项
      const allItems = [...shortcuts.minute, ...shortcuts.hour, ...shortcuts.day, ...shortcuts.month];
      const item = allItems.find(i => i.value === selected);
      if (item) {
        const range = getShortcutRange(item);
        onChange({
          start: formatLocalDateTime(range.start),
          end: formatLocalDateTime(range.end),
          label: item.label,
        });
      }
    } else {
      onChange({ start: customRange.start, end: customRange.end, label: '自定义' });
    }
    setVisible(false);
  };

  const handleClear = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    setSelected('today');
    setCustomRange({ start: formatLocalDateTime(start), end: formatLocalDateTime(now) });
  };

  return (
    <div className="time-range-picker" ref={containerRef}>
      <div className="picker-trigger" onClick={() => setVisible(!visible)}>
        <span className="trigger-icon">📅</span>
        <span className="trigger-label">{value.label || '选择时间'}</span>
        <span className="trigger-arrow">▼</span>
      </div>

      {visible && (
        <div className="picker-dropdown">
          <div className="picker-header">
            <span className="picker-title">选择时间范围</span>
            <span className="picker-close" onClick={() => setVisible(false)}>×</span>
          </div>

          <div className="picker-tabs">
            <div className={`tab-item ${activeTab === 'quick' ? 'active' : ''}`} onClick={() => setActiveTab('quick')}>快捷选择</div>
            <div className={`tab-item ${activeTab === 'custom' ? 'active' : ''}`} onClick={() => setActiveTab('custom')}>自定义时间</div>
          </div>

          <div className="picker-body">
            {activeTab === 'quick' ? (
              <div className="quick-panel">
                <div className="quick-section">
                  <div className="section-title">按分钟</div>
                  <div className="section-items">
                    {shortcuts.minute.map(item => (
                      <div key={item.value} className={`quick-item ${selected === item.value ? 'active' : ''}`}
                        onClick={() => handleQuickSelect(item)}>{item.label}</div>
                    ))}
                  </div>
                </div>
                <div className="quick-section">
                  <div className="section-title">按小时</div>
                  <div className="section-items">
                    {shortcuts.hour.map(item => (
                      <div key={item.value} className={`quick-item ${selected === item.value ? 'active' : ''}`}
                        onClick={() => handleQuickSelect(item)}>{item.label}</div>
                    ))}
                  </div>
                </div>
                <div className="quick-section">
                  <div className="section-title">按天</div>
                  <div className="section-items">
                    {shortcuts.day.map(item => (
                      <div key={item.value} className={`quick-item ${selected === item.value ? 'active' : ''}`}
                        onClick={() => handleQuickSelect(item)}>{item.label}</div>
                    ))}
                  </div>
                </div>
                <div className="quick-section">
                  <div className="section-title">按月</div>
                  <div className="section-items">
                    {shortcuts.month.map(item => (
                      <div key={item.value} className={`quick-item ${selected === item.value ? 'active' : ''}`}
                        onClick={() => handleQuickSelect(item)}>{item.label}</div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="custom-panel">
                <div className="custom-row">
                  <label>开始时间</label>
                  <input type="datetime-local" value={customRange.start}
                    onChange={e => setCustomRange(p => ({ ...p, start: e.target.value }))} />
                </div>
                <div className="custom-row">
                  <label>结束时间</label>
                  <input type="datetime-local" value={customRange.end}
                    onChange={e => setCustomRange(p => ({ ...p, end: e.target.value }))} />
                </div>
              </div>
            )}
          </div>

          <div className="picker-footer">
            <button className="btn-clear" onClick={handleClear}>清除</button>
            <button className="btn-confirm" onClick={handleConfirm}>确定</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeRangePicker;
