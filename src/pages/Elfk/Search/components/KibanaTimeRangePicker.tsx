/**
 * Kibana 风格的时间范围选择器
 * 单个按钮，点击打开弹窗，包含3个标签页：快捷选择、自定义时间范围、过去时间
 */

import { useState, useEffect } from 'react';
import { DatePicker, ConfigProvider, Modal, Tabs, InputNumber, Select, theme } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import './KibanaTimeRangePicker.css';

dayjs.locale('zh-cn');

const { RangePicker } = DatePicker;

interface TimeRange {
  start: string;
  end: string;
  label?: string;
}

interface Props {
  value: TimeRange;
  onChange: (range: TimeRange, autoSearch?: boolean) => void;
}

// 格式化本地时间
const formatLocalDateTime = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// 格式化显示时间（简短格式）
const formatDisplayTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  ) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  
  if (date.getFullYear() === now.getFullYear()) {
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// 快捷选项配置 - 按分类组织
const quickOptions = {
  day: [
    {
      label: '今天',
      value: 'today',
      getRange: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return { start, end: now };
      },
    },
    {
      label: '昨天',
      value: 'yesterday',
      getRange: () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
        const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
        return { start, end };
      },
    },
    {
      label: '前天',
      value: 'dayBeforeYesterday',
      getRange: () => {
        const dayBefore = new Date();
        dayBefore.setDate(dayBefore.getDate() - 2);
        const start = new Date(dayBefore.getFullYear(), dayBefore.getMonth(), dayBefore.getDate());
        const end = new Date(dayBefore.getFullYear(), dayBefore.getMonth(), dayBefore.getDate(), 23, 59, 59);
        return { start, end };
      },
    },
  ],
  week: [
    {
      label: '本周',
      value: 'thisWeek',
      getRange: () => {
        const now = new Date();
        const day = now.getDay();
        const diff = day === 0 ? 6 : day - 1;
        const start = new Date(now);
        start.setDate(now.getDate() - diff);
        start.setHours(0, 0, 0, 0);
        return { start, end: now };
      },
    },
    {
      label: '上周',
      value: 'lastWeek',
      getRange: () => {
        const now = new Date();
        const day = now.getDay();
        const diff = day === 0 ? 6 : day - 1;
        const thisWeekStart = new Date(now);
        thisWeekStart.setDate(now.getDate() - diff);
        const start = new Date(thisWeekStart);
        start.setDate(thisWeekStart.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        const end = new Date(thisWeekStart);
        end.setDate(thisWeekStart.getDate() - 1);
        end.setHours(23, 59, 59);
        return { start, end };
      },
    },
    {
      label: '上上周',
      value: 'twoWeeksAgo',
      getRange: () => {
        const now = new Date();
        const day = now.getDay();
        const diff = day === 0 ? 6 : day - 1;
        const thisWeekStart = new Date(now);
        thisWeekStart.setDate(now.getDate() - diff);
        const start = new Date(thisWeekStart);
        start.setDate(thisWeekStart.getDate() - 14);
        start.setHours(0, 0, 0, 0);
        const end = new Date(thisWeekStart);
        end.setDate(thisWeekStart.getDate() - 8);
        end.setHours(23, 59, 59);
        return { start, end };
      },
    },
  ],
  month: [
    {
      label: '本月',
      value: 'thisMonth',
      getRange: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start, end: now };
      },
    },
    {
      label: '上个月',
      value: 'lastMonth',
      getRange: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        return { start, end };
      },
    },
    {
      label: '上上个月',
      value: 'twoMonthsAgo',
      getRange: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59);
        return { start, end };
      },
    },
  ],
};

// 时间单位选项
const timeUnitOptions = [
  { label: '分钟', value: 'minutes', ms: 60 * 1000 },
  { label: '小时', value: 'hours', ms: 3600 * 1000 },
  { label: '天', value: 'days', ms: 24 * 3600 * 1000 },
  { label: '周', value: 'weeks', ms: 7 * 24 * 3600 * 1000 },
  { label: '月', value: 'months', ms: 30 * 24 * 3600 * 1000 },
];

const KibanaTimeRangePicker = ({ value, onChange }: Props) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('1');
  const [tempDateRange, setTempDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [selectedQuick, setSelectedQuick] = useState<string>(value.label || '自定义');
  
  // 从 label 解析相对时间值
  const parseRelativeTime = (label: string) => {
    const match = label.match(/^过去(\d+)(分钟|小时|天|周|月)$/);
    if (match) {
      const value = parseInt(match[1]);
      const unitMap: Record<string, string> = {
        '分钟': 'minutes',
        '小时': 'hours',
        '天': 'days',
        '周': 'weeks',
        '月': 'months',
      };
      return { value, unit: unitMap[match[2]] || 'minutes' };
    }
    return { value: 15, unit: 'minutes' };
  };
  
  const initialRelative = parseRelativeTime(value.label || '');
  const [relativeValue, setRelativeValue] = useState<number>(initialRelative.value);
  const [relativeUnit, setRelativeUnit] = useState<string>(initialRelative.unit);

  useEffect(() => {
    if (value.start && value.end) {
      setTempDateRange([dayjs(value.start), dayjs(value.end)]);
      setSelectedQuick(value.label || '自定义');
      
      // 如果是相对时间标签，解析并更新输入值
      if (value.label && value.label.startsWith('过去')) {
        const parsed = parseRelativeTime(value.label);
        setRelativeValue(parsed.value);
        setRelativeUnit(parsed.unit);
      }
    }
  }, [value.start, value.end, value.label]);

  const handleOpenModal = () => {
    setModalVisible(true);
    setTempDateRange([dayjs(value.start), dayjs(value.end)]);
  };

  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (!dates || !dates[0] || !dates[1]) return;
    setTempDateRange(dates as [Dayjs, Dayjs]);
    setSelectedQuick('自定义');
  };

  const handleCalendarChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      setTempDateRange(dates as [Dayjs, Dayjs]);
      setSelectedQuick('自定义');
    }
  };

  const handleQuickSelect = (option: typeof quickOptions.day[0]) => {
    const range = option.getRange();
    const [start, end] = [dayjs(range.start), dayjs(range.end)];
    
    // 直接应用并关闭弹窗，传递 autoSearch=true 触发自动搜索
    onChange({
      start: formatLocalDateTime(start.toDate()),
      end: formatLocalDateTime(end.toDate()),
      label: option.label,
    }, true);
    setModalVisible(false);
  };

  const handleRelativeApply = () => {
    const unit = timeUnitOptions.find(u => u.value === relativeUnit);
    if (!unit) return;
    
    const now = new Date();
    const start = new Date(now.getTime() - relativeValue * unit.ms);
    setTempDateRange([dayjs(start), dayjs(now)]);
    setSelectedQuick(`过去${relativeValue}${unit.label}`);
  };

  const handleRelativeKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRelativeApply();
    }
  };

  const handleConfirm = () => {
    // 如果在"过去时间"标签页，先应用相对时间计算
    if (activeTab === '3') {
      const unit = timeUnitOptions.find(u => u.value === relativeUnit);
      if (!unit) return;
      
      const now = new Date();
      const start = new Date(now.getTime() - relativeValue * unit.ms);
      const calculatedRange: [Dayjs, Dayjs] = [dayjs(start), dayjs(now)];
      const label = `过去${relativeValue}${unit.label}`;
      
      onChange({
        start: formatLocalDateTime(calculatedRange[0].toDate()),
        end: formatLocalDateTime(calculatedRange[1].toDate()),
        label: label,
      }, true);
      setModalVisible(false);
      return;
    }
    
    // 自定义时间范围
    if (!tempDateRange) return;
    
    const [start, end] = tempDateRange;
    onChange({
      start: formatLocalDateTime(start.toDate()),
      end: formatLocalDateTime(end.toDate()),
      label: selectedQuick,
    }, true);
    setModalVisible(false);
  };

  const handleCancel = () => {
    setModalVisible(false);
    setTempDateRange([dayjs(value.start), dayjs(value.end)]);
    setSelectedQuick(value.label || '自定义');
    // 重置过去时间的输入
    setRelativeValue(15);
    setRelativeUnit('minutes');
  };

  const getDisplayText = () => {
    if (value.label && value.label !== '自定义') {
      return value.label;
    }
    return `${formatDisplayTime(value.start)} → ${formatDisplayTime(value.end)}`;
  };

  const isDark = document.documentElement.classList.contains('dark');

  const tabItems = [
    {
      key: '1',
      label: '快捷选择',
      children: (
        <div className="quick-select-panel">
          <div className="quick-category">
            <div className="category-title">按天</div>
            <div className="quick-options-grid">
              {quickOptions.day.map((option) => (
                <div
                  key={option.value}
                  className={`quick-option-card ${selectedQuick === option.label ? 'active' : ''}`}
                  onClick={() => handleQuickSelect(option)}
                >
                  {option.label}
                </div>
              ))}
            </div>
          </div>

          <div className="quick-category">
            <div className="category-title">按周</div>
            <div className="quick-options-grid">
              {quickOptions.week.map((option) => (
                <div
                  key={option.value}
                  className={`quick-option-card ${selectedQuick === option.label ? 'active' : ''}`}
                  onClick={() => handleQuickSelect(option)}
                >
                  {option.label}
                </div>
              ))}
            </div>
          </div>

          <div className="quick-category">
            <div className="category-title">按月</div>
            <div className="quick-options-grid">
              {quickOptions.month.map((option) => (
                <div
                  key={option.value}
                  className={`quick-option-card ${selectedQuick === option.label ? 'active' : ''}`}
                  onClick={() => handleQuickSelect(option)}
                >
                  {option.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: '2',
      label: '自定义时间范围',
      children: (
        <div className="custom-range-panel">
          <ConfigProvider locale={zhCN}>
            <RangePicker
              value={tempDateRange}
              onChange={handleDateChange}
              onCalendarChange={handleCalendarChange}
              showTime={{ 
                format: 'HH:mm',
                defaultValue: [dayjs().startOf('day'), dayjs()],
              }}
              format="YYYY-MM-DD HH:mm"
              placeholder={['开始时间', '结束时间']}
              disabledDate={(current) => current && current > dayjs().endOf('day')}
              style={{ width: '100%' }}
            />
          </ConfigProvider>
          
          {tempDateRange && (
            <div className="selected-range">
              <div className="range-info">
                <span className="label">开始时间：</span>
                <span className="value">{tempDateRange[0].format('YYYY-MM-DD HH:mm')}</span>
              </div>
              <div className="range-info">
                <span className="label">结束时间：</span>
                <span className="value">{tempDateRange[1].format('YYYY-MM-DD HH:mm')}</span>
              </div>
            </div>
          )}
          
          <div className="panel-footer">
            <button className="confirm-btn" onClick={handleConfirm} disabled={!tempDateRange}>
              确定
            </button>
          </div>
        </div>
      ),
    },
    {
      key: '3',
      label: '过去时间',
      children: (
        <div className="relative-time-panel">
          <div className="relative-time-input">
            <span className="input-label">过去</span>
            <InputNumber
              min={1}
              max={999}
              value={relativeValue}
              onChange={(val) => setRelativeValue(val || 1)}
              onKeyPress={handleRelativeKeyPress}
              style={{ width: 120 }}
            />
            <Select
              value={relativeUnit}
              onChange={setRelativeUnit}
              style={{ width: 120 }}
              options={timeUnitOptions}
            />
          </div>
          <div className="relative-time-hint">
            提示：输入数值和单位后，点击"确定"按钮或按回车键应用时间范围
          </div>
          
          <div className="panel-footer">
            <button className="confirm-btn" onClick={handleConfirm}>
              确定
            </button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      <button 
        className="kibana-time-btn"
        onClick={handleOpenModal}
        title="点击选择时间范围"
      >
        <ClockCircleOutlined className="icon" />
        <span className="time-text">{getDisplayText()}</span>
        <span className="arrow">▼</span>
      </button>

      <ConfigProvider
        theme={{
          algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        }}
      >
        <Modal
          title="选择时间范围"
          open={modalVisible}
          onCancel={handleCancel}
          width={700}
          footer={null}
          closable={false}
          maskClosable={true}
          keyboard={true}
          className="kibana-time-modal"
        >
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
        </Modal>
      </ConfigProvider>
    </>
  );
};

export default KibanaTimeRangePicker;
