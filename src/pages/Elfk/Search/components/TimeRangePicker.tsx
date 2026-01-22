/**
 * 时间范围选择器 - 使用 Ant Design DatePicker
 * 支持快捷选择和自定义时间
 */

import { useState, useEffect, useRef } from 'react';
import { DatePicker, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

// 设置 dayjs 为中文
dayjs.locale('zh-cn');

const { RangePicker } = DatePicker;

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
const shortcuts = [
  { label: '过去15分钟', value: '15m', ms: 15 * 60 * 1000 },
  { label: '过去30分钟', value: '30m', ms: 30 * 60 * 1000 },
  { label: '过去45分钟', value: '45m', ms: 45 * 60 * 1000 },
  { label: '近1小时', value: '1h', ms: 1 * 3600 * 1000 },
  { label: '近3小时', value: '3h', ms: 3 * 3600 * 1000 },
  { label: '近6小时', value: '6h', ms: 6 * 3600 * 1000 },
  { label: '近12小时', value: '12h', ms: 12 * 3600 * 1000 },
  {
    label: '今日',
    value: 'today',
    getRange: () => {
      const now = dayjs();
      return [now.startOf('day'), now];
    },
  },
  {
    label: '昨日',
    value: 'yesterday',
    getRange: () => {
      const yesterday = dayjs().subtract(1, 'day');
      return [yesterday.startOf('day'), yesterday.endOf('day')];
    },
  },
  { label: '近3天', value: '3d', ms: 3 * 24 * 3600 * 1000 },
  { label: '近7天', value: '7d', ms: 7 * 24 * 3600 * 1000 },
  {
    label: '本月',
    value: 'thisMonth',
    getRange: () => {
      const now = dayjs();
      return [now.startOf('month'), now];
    },
  },
  {
    label: '上月',
    value: 'lastMonth',
    getRange: () => {
      const lastMonth = dayjs().subtract(1, 'month');
      return [lastMonth.startOf('month'), lastMonth.endOf('month')];
    },
  },
  { label: '近1个月', value: '1M', ms: 30 * 24 * 3600 * 1000 },
  { label: '近3个月', value: '3M', ms: 90 * 24 * 3600 * 1000 },
];

// 生成 Ant Design 的 presets
const rangePresets = shortcuts.map((item) => ({
  label: item.label,
  value: (() => {
    if (item.getRange) {
      return item.getRange();
    }
    const now = dayjs();
    return [now.subtract(item.ms!, 'millisecond'), now];
  })() as [Dayjs, Dayjs],
}));

const TimeRangePicker = ({ value, onChange }: Props) => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [currentLabel, setCurrentLabel] = useState(value.label || '今日');

  // 初始化时转换为 dayjs 对象
  useEffect(() => {
    if (value.start && value.end) {
      setDateRange([dayjs(value.start), dayjs(value.end)]);
      setCurrentLabel(value.label || '自定义');
    }
  }, [value.start, value.end, value.label]);

  const handleChange = (dates: [Dayjs, Dayjs] | null, dateStrings: [string, string]) => {
    if (!dates) {
      return;
    }

    const [start, end] = dates;
    
    // 检查是否匹配某个快捷选项
    let matchedLabel = '自定义';
    for (const shortcut of shortcuts) {
      let shortcutRange: [Dayjs, Dayjs];
      if (shortcut.getRange) {
        shortcutRange = shortcut.getRange();
      } else {
        const now = dayjs();
        shortcutRange = [now.subtract(shortcut.ms!, 'millisecond'), now];
      }
      
      // 允许1分钟误差
      if (
        Math.abs(start.diff(shortcutRange[0], 'minute')) <= 1 &&
        Math.abs(end.diff(shortcutRange[1], 'minute')) <= 1
      ) {
        matchedLabel = shortcut.label;
        break;
      }
    }

    setDateRange(dates);
    setCurrentLabel(matchedLabel);
    
    onChange({
      start: formatLocalDateTime(start.toDate()),
      end: formatLocalDateTime(end.toDate()),
      label: matchedLabel,
    });
  };

  return (
    <div className="time-range-picker-antd">
      <ConfigProvider locale={zhCN}>
        <RangePicker
          value={dateRange}
          onChange={handleChange}
          showTime={{ 
            format: 'HH:mm',
            defaultValue: [dayjs().startOf('day'), dayjs()],
          }}
          format="YYYY-MM-DD HH:mm"
          presets={rangePresets}
          placeholder={['开始时间', '结束时间']}
          style={{ width: 380 }}
          disabledDate={(current) => current && current > dayjs().endOf('day')}
          allowClear
          needConfirm={false}
          renderExtraFooter={() => (
            <div style={{ padding: '8px 12px', color: '#1890ff', fontSize: '12px' }}>
              当前选择: {currentLabel}
            </div>
          )}
        />
      </ConfigProvider>
    </div>
  );
};

export default TimeRangePicker;
