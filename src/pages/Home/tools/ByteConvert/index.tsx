/**
 * 字节单位转换器
 * 任意单位输入 → 同步刷新所有单位
 * 基于 1024 进制：1 KB = 1024 B
 */
import { useState } from 'react';
import ToolModal from '../ToolModal';
import './style.css';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;
type Unit = typeof UNITS[number];

/** 单位 → 字节倍率（2^(10*idx)） */
const FACTOR: Record<Unit, number> = {
  B:  1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
  PB: 1024 ** 5,
};

/** 数值格式化：去尾零，保留最多 6 位小数 */
function fmt(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '';
  if (n === 0) return '0';
  if (Math.abs(n) >= 1e15) return n.toExponential(4);
  // 6 位小数后去尾零
  const s = n.toFixed(6);
  return s.replace(/\.?0+$/, '');
}

export function ByteConvertContent() {
  // 以字节数为内部源；显示时按各单位换算
  const [bytes, setBytes] = useState<number | null>(null);
  // 哪一行是当前编辑（其他行用计算值，自身用 raw 文本以保留输入态）
  const [activeUnit, setActiveUnit] = useState<Unit | null>(null);
  const [activeRaw, setActiveRaw] = useState('');

  const handleChange = (unit: Unit, raw: string) => {
    setActiveUnit(unit);
    setActiveRaw(raw);
    if (raw === '' || raw === '-') {
      setBytes(null);
      return;
    }
    const v = parseFloat(raw);
    if (!isFinite(v)) {
      setBytes(null);
      return;
    }
    setBytes(v * FACTOR[unit]);
  };

  const handleClear = () => {
    setBytes(null);
    setActiveUnit(null);
    setActiveRaw('');
  };

  const display = (unit: Unit): string => {
    if (activeUnit === unit) return activeRaw;
    if (bytes === null) return '';
    return fmt(bytes / FACTOR[unit]);
  };

  return (
    <div className="bc-root">
      <div className="bc-header">
        <span className="bc-formula">基于 1024 进制 · 任意单位输入即同步</span>
        <button className="bc-clear" onClick={handleClear} title="清空">清空</button>
      </div>

      {UNITS.map(u => (
        <div className="bc-row" key={u}>
          <input
            className="bc-input"
            inputMode="decimal"
            placeholder="0"
            value={display(u)}
            onChange={e => handleChange(u, e.target.value)}
          />
          <span className="bc-suffix">{u}</span>
        </div>
      ))}
    </div>
  );
}

export function ByteConvertWindow() {
  return (
    <div className="tool-window-root">
      <ByteConvertContent />
    </div>
  );
}

export default function ByteConvert({ visible, onClose }: Props) {
  if (!visible) return null;
  return (
    <ToolModal visible={visible} title="💾 字节转换" onClose={onClose} size="sm">
      <ByteConvertContent />
    </ToolModal>
  );
}
