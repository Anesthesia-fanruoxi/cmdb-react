/**
 * Cron 表达式辅助生成工具
 */
import { useState, useMemo } from 'react';
import ToolModal from '../ToolModal';
import './style.css';

interface CronExprProps {
  visible: boolean;
  onClose: () => void;
}

type FreqType = 'seconds' | 'minutes' | 'hours' | 'daily' | 'weekly' | 'monthly';
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function parseField(field: string, min: number, max: number): number[] {
  if (field === '*') return Array.from({ length: max - min + 1 }, (_, i) => i + min);
  if (field.includes('/')) {
    const [startPart, stepPart] = field.split('/');
    const step = parseInt(stepPart, 10);
    const start = startPart === '*' ? min : parseInt(startPart, 10);
    const result: number[] = [];
    for (let i = start; i <= max; i += step) result.push(i);
    return result;
  }
  const result: number[] = [];
  for (const part of field.split(',')) {
    if (part.includes('-')) {
      const [s, e] = part.split('-').map(Number);
      for (let i = s; i <= e; i++) result.push(i);
    } else {
      result.push(parseInt(part, 10));
    }
  }
  return [...new Set(result)].sort((a, b) => a - b);
}

function getNextRuns(cron: string, count: number): Date[] {
  const normalized = cron.replace(/\?/g, '*');
  const parts = normalized.trim().split(/\s+/);
  const is6 = parts.length === 6;
  if (parts.length < 5) return [];
  const secField = is6 ? parts[0] : '0';
  const minField = parts[is6 ? 1 : 0];
  const hourField = parts[is6 ? 2 : 1];
  const domField = parts[is6 ? 3 : 2];
  const monField = parts[is6 ? 4 : 3];
  const dowField = parts[is6 ? 5 : 4];
  const seconds = parseField(secField, 0, 59);
  const minutes = parseField(minField, 0, 59);
  const hours = parseField(hourField, 0, 23);
  const doms = parseField(domField, 1, 31);
  const months = parseField(monField, 1, 12);
  const dows = parseField(dowField, 0, 7).map(d => d === 7 ? 0 : d);
  const hasDomRestriction = domField !== '*';
  const hasDowRestriction = dowField !== '*';
  const results: Date[] = [];
  const cursor = new Date();
  cursor.setSeconds(cursor.getSeconds() + 1);
  for (let i = 0; i < 525600 && results.length < count; i++) {
    const m = cursor.getMonth() + 1;
    const d = cursor.getDate();
    const dow = cursor.getDay();
    const h = cursor.getHours();
    const min = cursor.getMinutes();
    const sec = cursor.getSeconds();
    const monthOk = months.includes(m);
    let dayOk: boolean;
    if (hasDomRestriction && hasDowRestriction) dayOk = doms.includes(d) || dows.includes(dow);
    else if (hasDomRestriction) dayOk = doms.includes(d);
    else if (hasDowRestriction) dayOk = dows.includes(dow);
    else dayOk = true;
    if (monthOk && dayOk && hours.includes(h) && minutes.includes(min) && seconds.includes(sec))
      results.push(new Date(cursor));
    cursor.setSeconds(cursor.getSeconds() + 1);
  }
  return results;
}

function getDescription(freq: FreqType, interval: number, hour: number, minute: number, second: number, weekDays: number[], monthDay: number): string {
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  switch (freq) {
    case 'seconds': return `每 ${interval} 秒执行一次`;
    case 'minutes': return `每 ${interval} 分钟执行一次${second > 0 ? `（第 ${second} 秒触发）` : ''}`;
    case 'hours': return `每 ${interval} 小时执行一次（第 ${minute} 分${second > 0 ? `、${second} 秒` : ''}触发）`;
    case 'daily': return `每天 ${time}${second > 0 ? `:${String(second).padStart(2, '0')}` : ''} 执行`;
    case 'weekly': return `每周${weekDays.map(d => '周' + WEEKDAY_LABELS[d]).join('、')} ${time}${second > 0 ? `:${String(second).padStart(2, '0')}` : ''} 执行`;
    case 'monthly': return `每月 ${monthDay} 日 ${time}${second > 0 ? `:${String(second).padStart(2, '0')}` : ''} 执行`;
  }
}

function generateCron(freq: FreqType, interval: number, hour: number, minute: number, second: number, weekDays: number[], monthDay: number, cronType: '5' | '6'): string {
  const sec = String(second);
  const Q = cronType === '6' ? '?' : '*';
  switch (freq) {
    case 'seconds': return `*/${Math.max(1, interval)} * * * * *`;
    case 'minutes': { const base = `*/${Math.max(1, interval)} * * * *`; return cronType === '6' ? `${sec} ${base}` : base; }
    case 'hours': { const base = `${minute} */${Math.max(1, interval)} * * *`; return cronType === '6' ? `${sec} ${base}` : base; }
    case 'daily': { const base = `${minute} ${hour} * * ${Q}`; return cronType === '6' ? `${sec} ${base}` : base; }
    case 'weekly': { const base = `${minute} ${hour} ${Q} * ${weekDays.sort().join(',')}`; return cronType === '6' ? `${sec} ${base}` : base; }
    case 'monthly': { const base = `${minute} ${hour} ${monthDay} * ${Q}`; return cronType === '6' ? `${sec} ${base}` : base; }
  }
}

function fmtDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 核心内容，可在弹框和独立窗口中复用 */
export function CronExprContent() {
  const [cronType, setCronType] = useState<'5' | '6'>('5');
  const [freq, setFreq] = useState<FreqType>('daily');
  const [interval, setInterval] = useState(5);
  const [hour, setHour] = useState(3);
  const [minute, setMinute] = useState(0);
  const [second, setSecond] = useState(0);
  const [weekDays, setWeekDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [monthDay, setMonthDay] = useState(1);
  const [copied, setCopied] = useState(false);

  const cron = useMemo(() => generateCron(freq, interval, hour, minute, second, weekDays, monthDay, cronType), [freq, interval, hour, minute, second, weekDays, monthDay, cronType]);
  const description = useMemo(() => getDescription(freq, interval, hour, minute, second, weekDays, monthDay), [freq, interval, hour, minute, second, weekDays, monthDay]);
  const nextRuns = useMemo(() => getNextRuns(cron, 5), [cron]);

  const toggleWeekDay = (d: number) => setWeekDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(cron); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* */ }
  };

  const freqOptions = useMemo(() => {
    const opts: { value: FreqType; label: string }[] = [
      { value: 'minutes', label: '每隔 N 分钟' },
      { value: 'hours', label: '每隔 N 小时' },
      { value: 'daily', label: '每天' },
      { value: 'weekly', label: '每周' },
      { value: 'monthly', label: '每月' },
    ];
    if (cronType === '6') opts.unshift({ value: 'seconds', label: '每隔 N 秒' });
    return opts;
  }, [cronType]);

  return (
    <>
      <div className="ce-tabs">
        <button className={`ce-tab ${cronType === '5' ? 'active' : ''}`} onClick={() => { setCronType('5'); if (freq === 'seconds') setFreq('daily'); }}>5 位（标准）</button>
        <button className={`ce-tab ${cronType === '6' ? 'active' : ''}`} onClick={() => setCronType('6')}>6 位（含秒）</button>
      </div>

      <div className="ce-section">
        <label className="ce-label">执行频率</label>
        <div className="ce-freq-grid" style={{ gridTemplateColumns: `repeat(${freqOptions.length}, 1fr)` }}>
          {freqOptions.map(opt => (
            <button key={opt.value} className={`ce-freq-btn ${freq === opt.value ? 'active' : ''}`} onClick={() => setFreq(opt.value)}>{opt.label}</button>
          ))}
        </div>
      </div>

      <div className="ce-section">
        <label className="ce-label">参数配置</label>
        <div className="ce-params">
          {freq === 'seconds' && (
            <div className="ce-param-row">
              <span className="ce-param-text">每隔</span>
              <input type="number" className="ce-num-input" min={1} max={59} value={interval} onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v > 0) setInterval(v); }} />
              <span className="ce-param-text">秒执行一次</span>
            </div>
          )}
          {(freq === 'minutes' || freq === 'hours') && (
            <div className="ce-param-row">
              <span className="ce-param-text">每隔</span>
              <input type="number" className="ce-num-input" min={1} max={freq === 'minutes' ? 59 : 23} value={interval} onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v > 0) setInterval(v); }} />
              <span className="ce-param-text">{freq === 'minutes' ? '分钟' : '小时'}</span>
              {freq === 'hours' && (
                <>
                  <span className="ce-param-text">（第</span>
                  <input type="number" className="ce-num-input ce-num-input--sm" min={0} max={59} value={minute} onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 59) setMinute(v); }} />
                  <span className="ce-param-text">分</span>
                  {cronType === '6' && (<><input type="number" className="ce-num-input ce-num-input--sm" min={0} max={59} value={second} onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 59) setSecond(v); }} /><span className="ce-param-text">秒触发）</span></>)}
                  {cronType === '5' && <span className="ce-param-text">触发）</span>}
                </>
              )}
              {freq === 'minutes' && cronType === '6' && (
                <>
                  <span className="ce-param-text">（第</span>
                  <input type="number" className="ce-num-input ce-num-input--sm" min={0} max={59} value={second} onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 59) setSecond(v); }} />
                  <span className="ce-param-text">秒触发）</span>
                </>
              )}
            </div>
          )}
          {freq === 'daily' && (
            <div className="ce-param-row">
              <span className="ce-param-text">每天</span>
              <input type="number" className="ce-num-input ce-num-input--sm" min={0} max={23} value={hour} onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 23) setHour(v); }} />
              <span className="ce-param-text">:</span>
              <input type="number" className="ce-num-input ce-num-input--sm" min={0} max={59} value={minute} onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 59) setMinute(v); }} />
              {cronType === '6' && (<><span className="ce-param-text">:</span><input type="number" className="ce-num-input ce-num-input--sm" min={0} max={59} value={second} onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 59) setSecond(v); }} /></>)}
              <span className="ce-param-text">执行</span>
            </div>
          )}
          {freq === 'weekly' && (
            <>
              <div className="ce-param-row">
                <span className="ce-param-text">星期</span>
                {WEEKDAY_LABELS.map((label, i) => (
                  <button key={i} className={`ce-weekday-btn ${weekDays.includes(i) ? 'active' : ''}`} onClick={() => toggleWeekDay(i)}>{label}</button>
                ))}
              </div>
              <div className="ce-param-row" style={{ marginTop: 8 }}>
                <span className="ce-param-text">时间</span>
                <input type="number" className="ce-num-input ce-num-input--sm" min={0} max={23} value={hour} onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 23) setHour(v); }} />
                <span className="ce-param-text">:</span>
                <input type="number" className="ce-num-input ce-num-input--sm" min={0} max={59} value={minute} onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 59) setMinute(v); }} />
                {cronType === '6' && (<><span className="ce-param-text">:</span><input type="number" className="ce-num-input ce-num-input--sm" min={0} max={59} value={second} onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 59) setSecond(v); }} /></>)}
              </div>
            </>
          )}
          {freq === 'monthly' && (
            <div className="ce-param-row">
              <span className="ce-param-text">每月第</span>
              <input type="number" className="ce-num-input ce-num-input--sm" min={1} max={28} value={monthDay} onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1 && v <= 28) setMonthDay(v); }} />
              <span className="ce-param-text">天</span>
              <input type="number" className="ce-num-input ce-num-input--sm" min={0} max={23} value={hour} onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 23) setHour(v); }} />
              <span className="ce-param-text">:</span>
              <input type="number" className="ce-num-input ce-num-input--sm" min={0} max={59} value={minute} onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 59) setMinute(v); }} />
              {cronType === '6' && (<><span className="ce-param-text">:</span><input type="number" className="ce-num-input ce-num-input--sm" min={0} max={59} value={second} onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 59) setSecond(v); }} /></>)}
            </div>
          )}
        </div>
      </div>

      <div className="ce-result-box">
        <div className="ce-result-row">
          <span className="ce-result-label">Cron 表达式</span>
          <code className="ce-cron-code">{cron}</code>
          <button className="ce-copy-btn" onClick={copy}>{copied ? '已复制' : '📋 复制'}</button>
        </div>
        <div className="ce-desc-text">{description}</div>
        <div className="ce-divider" />
        <div className="ce-next-title">最近 5 次执行时间</div>
        {nextRuns.length > 0 ? (
          <div className="ce-next-list">
            {nextRuns.map((d, i) => (
              <div key={i} className="ce-next-item">
                <span className="ce-next-idx">{i + 1}</span>
                <span className="ce-next-time">{fmtDate(d)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="ce-next-empty">无法计算执行时间，请检查参数</div>
        )}
      </div>
    </>
  );
}

/** 独立窗口版本 */
export function CronExprWindow() {
  return (
    <div className="tool-window-root">
      <CronExprContent />
    </div>
  );
}

/** 弹框版本 */
export default function CronExpr({ visible, onClose }: CronExprProps) {
  if (!visible) return null;
  return (
    <ToolModal visible={visible} title="⏰ Cron 表达式生成" onClose={onClose} size="md">
      <CronExprContent />
    </ToolModal>
  );
}
