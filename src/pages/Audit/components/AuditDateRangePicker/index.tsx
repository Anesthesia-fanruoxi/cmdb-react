/**
 * 审计模块公共时间选择器
 * 基于 Ant Design DatePicker，支持快捷时间和自定义范围
 */

import { useState } from 'react';
import { DatePicker, ConfigProvider, theme } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import './index.css';

dayjs.locale('zh-cn');

const { RangePicker } = DatePicker;

interface Props {
  value: { start: string; end: string };
  onChange: (start: string, end: string) => void;
  showTime?: boolean; // 是否显示时间选择，默认 true
}

type QuickOption = { label: string; getRange: () => { start: Date; end: Date } };

// 格式化日期时间
const formatDateTime = (date: Date, includeTime: boolean) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (includeTime) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} 00:00:00`;
};

// 格式化结束日期
const formatEndDateTime = (date: Date, includeTime: boolean) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (includeTime) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} 23:59:59`;
};

// 快捷选项配置
const quickOptions: Record<string, QuickOption[]> = {
  day: [
    { label: '今日', getRange: () => { const now = new Date(); return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: now }; } },
    { label: '昨日', getRange: () => { const d = new Date(); d.setDate(d.getDate() - 1); return { start: new Date(d.getFullYear(), d.getMonth(), d.getDate()), end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59) }; } },
    { label: '前日', getRange: () => { const d = new Date(); d.setDate(d.getDate() - 2); return { start: new Date(d.getFullYear(), d.getMonth(), d.getDate()), end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59) }; } },
  ],
  week: [
    { label: '本周', getRange: () => { const now = new Date(); const day = now.getDay(); const diff = day === 0 ? 6 : day - 1; const start = new Date(now); start.setDate(now.getDate() - diff); start.setHours(0, 0, 0, 0); return { start, end: now }; } },
    { label: '上周', getRange: () => { const now = new Date(); const day = now.getDay(); const diff = day === 0 ? 6 : day - 1; const thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate() - diff); const start = new Date(thisWeekStart); start.setDate(thisWeekStart.getDate() - 7); start.setHours(0, 0, 0, 0); const end = new Date(thisWeekStart); end.setDate(thisWeekStart.getDate() - 1); end.setHours(23, 59, 59); return { start, end }; } },
    { label: '上上周', getRange: () => { const now = new Date(); const day = now.getDay(); const diff = day === 0 ? 6 : day - 1; const thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate() - diff); const start = new Date(thisWeekStart); start.setDate(thisWeekStart.getDate() - 14); start.setHours(0, 0, 0, 0); const end = new Date(thisWeekStart); end.setDate(thisWeekStart.getDate() - 8); end.setHours(23, 59, 59); return { start, end }; } },
  ],
  month: [
    { label: '当月', getRange: () => { const now = new Date(); return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now }; } },
    { label: '上月', getRange: () => { const now = new Date(); return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) }; } },
    { label: '近3个月', getRange: () => { const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth() - 2, 1); return { start, end: now }; } },
  ],
};

const categoryLabels: Record<string, string> = {
  day: '按天',
  week: '按周',
  month: '按月',
};

const AuditDateRangePicker = ({ value, onChange, showTime = true }: Props) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'quick' | 'custom'>('quick');
  const isDark = document.documentElement.classList.contains('dark');

  const handleQuickSelect = (option: QuickOption) => {
    const range = option.getRange();
    onChange(formatDateTime(range.start, showTime), formatEndDateTime(range.end, showTime));
    setOpen(false);
  };

  const handleChange = (dates: any) => {
    if (!dates || !dates[0] || !dates[1]) return;
    if (showTime) {
      onChange(formatDateTime(dates[0].toDate(), true), formatDateTime(dates[1].toDate(), true));
    } else {
      onChange(formatDateTime(dates[0].toDate(), false), formatEndDateTime(dates[1].toDate(), false));
    }
    setOpen(false);
  };

  // 格式化显示文本
  const getDisplayText = () => {
    if (!value.start || !value.end) return showTime ? '选择时间范围' : '选择日期范围';
    
    const startDate = dayjs(value.start);
    const endDate = dayjs(value.end);
    const now = dayjs();
    
    if (showTime) {
      if (startDate.isSame(now, 'day') && endDate.isSame(now, 'day')) {
        return `今日 ${startDate.format('HH:mm')} ~ ${endDate.format('HH:mm')}`;
      }
      
      const yesterday = now.subtract(1, 'day');
      if (startDate.isSame(yesterday, 'day') && endDate.isSame(yesterday, 'day')) {
        return `昨日 ${startDate.format('HH:mm')} ~ ${endDate.format('HH:mm')}`;
      }
      
      const dayBeforeYesterday = now.subtract(2, 'day');
      if (startDate.isSame(dayBeforeYesterday, 'day') && endDate.isSame(dayBeforeYesterday, 'day')) {
        return `前日 ${startDate.format('HH:mm')} ~ ${endDate.format('HH:mm')}`;
      }
      
      return `${startDate.format('MM-DD HH:mm')} ~ ${endDate.format('MM-DD HH:mm')}`;
    } else {
      if (startDate.isSame(now, 'day') && endDate.isSame(now, 'day')) {
        return `今日`;
      }
      
      const yesterday = now.subtract(1, 'day');
      if (startDate.isSame(yesterday, 'day') && endDate.isSame(yesterday, 'day')) {
        return `昨日`;
      }
      
      const dayBeforeYesterday = now.subtract(2, 'day');
      if (startDate.isSame(dayBeforeYesterday, 'day') && endDate.isSame(dayBeforeYesterday, 'day')) {
        return `前日`;
      }
      
      return `${startDate.format('MM-DD')} ~ ${endDate.format('MM-DD')}`;
    }
  };

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      <div className="audit-date-picker-wrapper">
        <button className="audit-date-btn" onClick={() => setOpen(!open)}>
          <ClockCircleOutlined className="icon" />
          <span className="time-text">{getDisplayText()}</span>
          <span className="arrow">▼</span>
        </button>
        
        {open && (
          <div className="audit-date-dropdown">
            <div className="dropdown-tabs">
              <button 
                className={`tab-btn ${activeTab === 'quick' ? 'active' : ''}`}
                onClick={() => setActiveTab('quick')}
              >
                快捷选择
              </button>
              <button 
                className={`tab-btn ${activeTab === 'custom' ? 'active' : ''}`}
                onClick={() => setActiveTab('custom')}
              >
                自定义
              </button>
            </div>
            
            {activeTab === 'quick' ? (
              <div className="quick-panel">
                {Object.entries(quickOptions).map(([key, options]) => (
                  <div key={key} className="quick-category">
                    <div className="category-label">{categoryLabels[key]}</div>
                    <div className="quick-grid">
                      {options.map((option) => (
                        <button
                          key={option.label}
                          className="quick-btn"
                          onClick={() => handleQuickSelect(option)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="custom-panel">
                <RangePicker
                  value={value.start ? [dayjs(value.start), dayjs(value.end)] : null}
                  onChange={handleChange}
                  showTime={showTime ? {
                    format: 'HH:mm:ss',
                    showSecond: true,
                    defaultValue: [dayjs().startOf('day'), dayjs()],
                  } : false}
                  format={showTime ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'}
                  disabledDate={(current) => current && current > dayjs().endOf('day')}
                  allowClear
                  autoFocus
                />
              </div>
            )}
          </div>
        )}
      </div>
    </ConfigProvider>
  );
};

export default AuditDateRangePicker;