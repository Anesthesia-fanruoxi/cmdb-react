/**
 * 日志条目 - JSON 展示模式
 */

import { FileText } from 'lucide-react';
import type { LogHit } from '@/services/elfk/search';
import type { ViewDetail } from '@/services/elfk/view';
import '../styles/log-entry-json.css';

interface LogEntryJsonProps {
  log: LogHit;
  timeField: string;
  currentView: ViewDetail | null;
  selectedFields: string[];
  keyword: string;
  formatTime: (value: unknown) => string;
  highlightText: (text: string) => string;
  onContextClick: (log: LogHit) => void;
}

const typeColors: Record<string, string> = {
  string: '#3a8ee6',
  number: '#529b2e',
  boolean: '#b88230',
  date: '#c45656',
  array: '#737579',
  object: '#8b5da7',
};

const LogEntryJson = ({
  log,
  timeField,
  currentView,
  selectedFields,
  formatTime,
  highlightText,
  onContextClick,
}: LogEntryJsonProps) => {
  const processLog = (log: LogHit): Record<string, unknown> => {
    return log._source ? { ...log._source, _id: log._id, _index: log._index } : { ...log } as Record<string, unknown>;
  };

  const getFieldType = (value: unknown): string => {
    if (value === null || value === undefined) return 'string';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const data = processLog(log);
  const time = formatTime(data[timeField]);

  return (
    <div className="log-entry-json">
      <div className="log-time">{time}</div>
      <div className="log-body">
        {currentView?.log_type === 'sls' && data['__tag__:__path__'] ? (
          <div className="field-pair tag-path">
            <span className="field-name">__tag__:__path__:</span>
            <span className="field-value">{String(data['__tag__:__path__'])}</span>
          </div>
        ) : log._index ? (
          <div className="field-pair tag-path">
            <span className="field-name">_index:</span>
            <span className="field-value">{log._index}</span>
          </div>
        ) : null}
        {Object.entries(data)
          .filter(([key]) => {
            if (key === timeField || key.startsWith('_') || key === '__tag__:__path__') return false;
            if (selectedFields.length > 0) return selectedFields.includes(key);
            return true;
          })
          .map(([key, value]) => {
            const type = getFieldType(value);
            const color = typeColors[type] || typeColors.string;
            return (
              <div key={key} className="field-pair">
                <span className="field-name" style={{ color }}>{key}:</span>
                <span
                  className="field-value"
                  dangerouslySetInnerHTML={{ __html: highlightText(formatValue(value)) }}
                />
              </div>
            );
          })}
      </div>
      <div className="log-actions">
        <button className="btn-context" onClick={() => onContextClick(log)}>
          <FileText size={12} /> 上下文
        </button>
      </div>
    </div>
  );
};

export default LogEntryJson;
