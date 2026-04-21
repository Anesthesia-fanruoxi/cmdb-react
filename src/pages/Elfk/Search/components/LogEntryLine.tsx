/**
 * 日志条目 - 行展示模式
 * 所有字段压缩成一行，支持横向滚动，无展开功能
 */

import type { LogHit } from '@/services/elfk/search';
import type { ViewDetail } from '@/services/elfk/view';
import '../styles/log-entry-line.css';

interface LogEntryLineProps {
  log: LogHit;
  timeField: string;
  currentView: ViewDetail | null;
  selectedFields: string[];
  formatTime: (value: unknown) => string;
  highlightText: (text: string) => string;
}

const LogEntryLine = ({
  log,
  timeField,
  currentView,
  selectedFields,
  formatTime,
  highlightText,
}: LogEntryLineProps) => {
  const processLog = (l: LogHit): Record<string, unknown> =>
    l._source ? { ...l._source, _id: l._id, _index: l._index } : { ...l } as Record<string, unknown>;

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const data = processLog(log);
  const time = formatTime(data[timeField]);

  // 过滤展示字段
  const visibleEntries = Object.entries(data).filter(([key]) => {
    if (key === timeField || key.startsWith('_') || key === '__tag__:__path__') return false;
    if (selectedFields.length > 0) return selectedFields.includes(key);
    return true;
  });

  // 所有字段拼成一行
  const lineText = visibleEntries
    .map(([key, value]) => `${key}: ${formatValue(value)}`)
    .join('  ');

  // 索引标识
  const indexLabel =
    currentView?.log_type === 'sls' && data['__tag__:__path__']
      ? String(data['__tag__:__path__'])
      : log._index || '';

  return (
    <div className="log-entry-line">
      <div className="line-row">
        <span className="line-time">{time}</span>

        {indexLabel && (
          <span className="line-index">{indexLabel}</span>
        )}

        <span
          className="line-content"
          dangerouslySetInnerHTML={{ __html: highlightText(lineText) }}
        />
      </div>
    </div>
  );
};

export default LogEntryLine;
