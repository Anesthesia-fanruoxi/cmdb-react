/**
 * QPS 计算器
 * N（总量）= Q（QPS） × T（时间，秒）
 * 三选一作为计算目标，另外两个为输入；结果时间自动匹配单位
 */
import { useMemo, useState } from 'react';
import ToolModal from '../ToolModal';
import './style.css';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Target = 'qps' | 'time' | 'total';
type TimeUnit = 's' | 'min' | 'h' | 'd';

const UNIT_TO_SEC: Record<TimeUnit, number> = { s: 1, min: 60, h: 3600, d: 86400 };
const UNIT_LABELS: Record<TimeUnit, string> = { s: '秒', min: '分钟', h: '小时', d: '天' };

function fmt(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '';
  if (n === 0) return '0';
  if (Number.isInteger(n)) return n.toLocaleString('en-US');
  return Number(n.toFixed(4)).toLocaleString('en-US');
}

/** 总量中文分位表示：1392123 → "139万2123" */
function fmtTotalChinese(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '';
  if (n < 0) return `-${fmtTotalChinese(-n)}`;
  const v = Math.floor(n);
  if (v < 10000) return String(v);
  const yi = Math.floor(v / 1e8);
  const wan = Math.floor((v % 1e8) / 1e4);
  const yu = v % 1e4;
  let s = '';
  if (yi > 0) s += `${yi}亿`;
  if (wan > 0) s += `${s ? String(wan).padStart(4, '0') : wan}万`;
  if (yu > 0) s += s ? String(yu).padStart(4, '0') : String(yu);
  return s || '0';
}

/** 时间秒数 → 精确到秒的中文表示 */
function fmtTimeExact(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return '0 秒';
  const t = Math.round(sec);
  const d = Math.floor(t / 86400);
  const h = Math.floor((t % 86400) / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d} 天`);
  if (h > 0) parts.push(`${h} 小时`);
  if (m > 0) parts.push(`${m} 分`);
  if (s > 0 || parts.length === 0) parts.push(`${s} 秒`);
  return parts.join(' ');
}

export function QpsCalcContent() {
  const [target, setTarget] = useState<Target>('total');
  const [qps, setQps] = useState('');
  const [time, setTime] = useState('');
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('s');
  const [total, setTotal] = useState('');

  // 计算结果
  const result = useMemo<{ value: string; unit: string; label: string } | null>(() => {
    const q = parseFloat(qps);
    const t = parseFloat(time);
    const n = parseFloat(total);
    const tSec = isFinite(t) ? t * UNIT_TO_SEC[timeUnit] : NaN;

    if (target === 'total') {
      if (!isFinite(q) || !isFinite(tSec)) return null;
      const v = q * tSec;
      return { value: fmtTotalChinese(v), unit: '条', label: '总量' };
    }
    if (target === 'qps') {
      if (!isFinite(n) || !isFinite(tSec) || tSec === 0) return null;
      const v = Math.ceil(n / tSec); // QPS 向上取整
      return { value: fmt(v), unit: '/ 秒', label: 'QPS' };
    }
    // 算时间：精确到秒
    if (!isFinite(n) || !isFinite(q) || q === 0) return null;
    return { value: fmtTimeExact(n / q), unit: '', label: '时间' };
  }, [target, qps, time, timeUnit, total]);

  // 渲染单个输入行
  const renderInput = (
    field: 'qps' | 'time' | 'total',
  ) => {
    if (field === 'qps') {
      return (
        <div className="qc-row" key="qps">
          <label className="qc-label">QPS</label>
          <input
            className="qc-input"
            inputMode="decimal"
            placeholder="请输入 QPS"
            value={qps}
            onChange={e => setQps(e.target.value)}
          />
          <span className="qc-suffix">/秒</span>
        </div>
      );
    }
    if (field === 'time') {
      return (
        <div className="qc-row" key="time">
          <label className="qc-label">时间</label>
          <input
            className="qc-input"
            inputMode="decimal"
            placeholder="请输入时间"
            value={time}
            onChange={e => setTime(e.target.value)}
          />
          <select
            className="qc-unit-select"
            value={timeUnit}
            onChange={e => setTimeUnit(e.target.value as TimeUnit)}
          >
            {(['s', 'min', 'h', 'd'] as TimeUnit[]).map(u => (
              <option key={u} value={u}>{UNIT_LABELS[u]}</option>
            ))}
          </select>
        </div>
      );
    }
    return (
      <div className="qc-row" key="total">
        <label className="qc-label">总量</label>
        <input
          className="qc-input"
          inputMode="decimal"
          placeholder="请输入总量"
          value={total}
          onChange={e => setTotal(e.target.value)}
        />
        <span className="qc-suffix">条</span>
      </div>
    );
  };

  // 根据目标决定显示哪两个输入
  const inputs: ('qps' | 'time' | 'total')[] =
    target === 'total' ? ['qps', 'time']
    : target === 'qps' ? ['total', 'time']
    : ['total', 'qps'];

  return (
    <div className="qc-root">
      {/* 计算目标切换 */}
      <div className="qc-target-tabs">
        <button className={`qc-tab ${target === 'total' ? 'active' : ''}`} onClick={() => setTarget('total')}>📊 算总量</button>
        <button className={`qc-tab ${target === 'qps' ? 'active' : ''}`} onClick={() => setTarget('qps')}>⚡ 算 QPS</button>
        <button className={`qc-tab ${target === 'time' ? 'active' : ''}`} onClick={() => setTarget('time')}>⏱ 算时间</button>
      </div>

      <div className="qc-formula">公式：总量 = QPS × 时间(秒)</div>

      {/* 两个输入框 */}
      {inputs.map(renderInput)}

      {/* 结果展示框 */}
      <div className="qc-result-box">
        <div className="qc-result-header">{result ? result.label : '结果'}</div>
        <div className="qc-result-content">
          {result ? (
            <>
              <span className="qc-result-val">{result.value}</span>
              <span className="qc-result-unit">{result.unit}</span>
            </>
          ) : (
            <span className="qc-result-placeholder">请填写上方两项</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function QpsCalcWindow() {
  return (
    <div className="tool-window-root">
      <QpsCalcContent />
    </div>
  );
}

export default function QpsCalc({ visible, onClose }: Props) {
  if (!visible) return null;
  return (
    <ToolModal visible={visible} title="📊 QPS 计算器" onClose={onClose} size="sm">
      <QpsCalcContent />
    </ToolModal>
  );
}
