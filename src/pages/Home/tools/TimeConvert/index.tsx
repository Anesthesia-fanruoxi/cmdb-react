/**
 * 时间戳转换工具
 * 支持时间戳（秒/毫秒）↔ 日期时间互转
 */
import { useState, useEffect } from 'react';
import ToolModal from '../ToolModal';
import './style.css';

interface TimeConvertProps {
  visible: boolean;
  onClose: () => void;
}

type Unit = 's' | 'ms';

function getNow(): { ts: string; dt: string } {
  const now = new Date();
  return {
    ts: String(Math.floor(now.getTime() / 1000)),
    dt: formatLocal(now),
  };
}

function formatLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function tsToDate(ts: string, unit: Unit): string {
  const num = Number(ts.trim());
  if (isNaN(num)) return '';
  const ms = unit === 's' ? num * 1000 : num;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  return formatLocal(d);
}

function dateToTs(dt: string, unit: Unit): string {
  const d = new Date(dt.trim());
  if (isNaN(d.getTime())) return '';
  const ms = d.getTime();
  return String(unit === 's' ? Math.floor(ms / 1000) : ms);
}

export function TimeConvertContent() {
  const [unit, setUnit] = useState<Unit>('s');
  const [ts, setTs] = useState('');
  const [dt, setDt] = useState('');
  const [tsResult, setTsResult] = useState('');   // ts → date 结果
  const [dtResult, setDtResult] = useState('');   // date → ts 结果
  const [tsError, setTsError] = useState('');
  const [dtError, setDtError] = useState('');
  const [nowTs, setNowTs] = useState('');
  const [copiedTs, setCopiedTs] = useState(false);
  const [copiedDt, setCopiedDt] = useState(false);

  // 实时更新当前时间戳
  useEffect(() => {
    const update = () => setNowTs(String(Math.floor(Date.now() / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // 时间戳 → 日期
  useEffect(() => {
    if (!ts.trim()) { setTsResult(''); setTsError(''); return; }
    const result = tsToDate(ts, unit);
    if (result) { setTsResult(result); setTsError(''); }
    else { setTsResult(''); setTsError('无效的时间戳'); }
  }, [ts, unit]);

  // 日期 → 时间戳
  useEffect(() => {
    if (!dt.trim()) { setDtResult(''); setDtError(''); return; }
    const result = dateToTs(dt, unit);
    if (result) { setDtResult(result); setDtError(''); }
    else { setDtResult(''); setDtError('无效的日期格式'); }
  }, [dt, unit]);

  const fillNow = () => {
    const { ts: t, dt: d } = getNow();
    setTs(unit === 's' ? t : String(Date.now()));
    setDt(d);
  };

  const copy = async (text: string, which: 'ts' | 'dt') => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === 'ts') { setCopiedTs(true); setTimeout(() => setCopiedTs(false), 1500); }
      else { setCopiedDt(true); setTimeout(() => setCopiedDt(false), 1500); }
    } catch { /* */ }
  };

  return (
    <div className="tc-root">
      {/* 单位切换 + 当前时间戳 */}
      <div className="tc-topbar">
        <div className="tc-unit-tabs">
          <button className={`tc-unit-tab ${unit === 's' ? 'active' : ''}`} onClick={() => setUnit('s')}>秒 (s)</button>
          <button className={`tc-unit-tab ${unit === 'ms' ? 'active' : ''}`} onClick={() => setUnit('ms')}>毫秒 (ms)</button>
        </div>
        <div className="tc-now">
          <span className="tc-now-label">当前时间戳</span>
          <code className="tc-now-val">{unit === 's' ? nowTs : String(Date.now())}</code>
          <button className="tc-fill-btn" onClick={fillNow}>填入</button>
        </div>
      </div>

      {/* 时间戳 → 日期 */}
      <div className="tc-section">
        <div className="tc-section-title">时间戳 → 日期时间</div>
        <div className="tc-row">
          <input
            className={`tc-input ${tsError ? 'tc-input--error' : ''}`}
            placeholder={unit === 's' ? '输入秒级时间戳，例如：1716700800' : '输入毫秒时间戳，例如：1716700800000'}
            value={ts}
            onChange={e => setTs(e.target.value)}
          />
          <span className="tc-arrow">→</span>
          <div className="tc-result-wrap">
            {tsError ? (
              <span className="tc-error">{tsError}</span>
            ) : (
              <code className="tc-result">{tsResult || <span className="tc-placeholder">结果</span>}</code>
            )}
            {tsResult && !tsError && (
              <button className="tc-copy-btn" onClick={() => copy(tsResult, 'ts')}>
                {copiedTs ? '✓' : '复制'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 日期 → 时间戳 */}
      <div className="tc-section">
        <div className="tc-section-title">日期时间 → 时间戳</div>
        <div className="tc-row">
          <input
            className={`tc-input ${dtError ? 'tc-input--error' : ''}`}
            placeholder="输入日期时间，例如：2024-05-26 10:00:00"
            value={dt}
            onChange={e => setDt(e.target.value)}
          />
          <span className="tc-arrow">→</span>
          <div className="tc-result-wrap">
            {dtError ? (
              <span className="tc-error">{dtError}</span>
            ) : (
              <code className="tc-result">{dtResult || <span className="tc-placeholder">结果</span>}</code>
            )}
            {dtResult && !dtError && (
              <button className="tc-copy-btn" onClick={() => copy(dtResult, 'dt')}>
                {copiedDt ? '✓' : '复制'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 常用时间参考 */}
      <div className="tc-section">
        <div className="tc-section-title">快速参考</div>
        <div className="tc-ref-grid">
          {[
            { label: '1 分钟', s: 60 },
            { label: '1 小时', s: 3600 },
            { label: '1 天', s: 86400 },
            { label: '7 天', s: 604800 },
            { label: '30 天', s: 2592000 },
            { label: '1 年', s: 31536000 },
          ].map(({ label, s }) => (
            <div key={label} className="tc-ref-item">
              <span className="tc-ref-label">{label}</span>
              <code className="tc-ref-val">{unit === 's' ? s : s * 1000}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TimeConvertWindow() {
  return (
    <div className="tool-window-root">
      <TimeConvertContent />
    </div>
  );
}

export default function TimeConvert({ visible, onClose }: TimeConvertProps) {
  if (!visible) return null;
  return (
    <ToolModal visible={visible} title="🕐 时间戳转换" onClose={onClose} size="sm">
      <TimeConvertContent />
    </ToolModal>
  );
}
