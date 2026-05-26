/**
 * 随机密码生成工具
 */
import { useState, useCallback } from 'react';
import ToolModal from '../ToolModal';
import './style.css';

interface PasswordGenProps {
  visible: boolean;
  onClose: () => void;
}

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

const getStrength = (len: number, charset: string): { label: string; cls: string } => {
  const pool = new Set(charset).size;
  const bits = len * Math.log2(pool);
  if (bits < 30) return { label: '弱', cls: 'weak' };
  if (bits < 50) return { label: '中', cls: 'medium' };
  if (bits < 70) return { label: '强', cls: 'strong' };
  return { label: '非常强', cls: 'very-strong' };
};

function generateOne(chars: string, len: number): string {
  const array = new Uint32Array(len);
  crypto.getRandomValues(array);
  return Array.from(array).map(v => chars[v % chars.length]).join('');
}

export default function PasswordGen({ visible, onClose }: PasswordGenProps) {
  const [length, setLength] = useState(16);
  const [count, setCount] = useState(5);
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(false);
  const [passwords, setPasswords] = useState<string[]>([]);
  const [copiedIdx, setCopiedIdx] = useState(-1);
  const [copiedAll, setCopiedAll] = useState(false);

  const generate = useCallback(() => {
    const actualLen = Math.max(8, Math.min(64, length));
    let chars = '';
    if (upper) chars += UPPER;
    if (lower) chars += LOWER;
    if (digits) chars += DIGITS;
    if (symbols) chars += SYMBOLS;
    if (!chars) { setPasswords(['请至少选择一种字符类型']); return; }

    const list = Array.from({ length: count }, () => generateOne(chars, actualLen));
    setPasswords(list);
    setCopiedIdx(-1);
    setCopiedAll(false);
  }, [length, count, upper, lower, digits, symbols]);

  const copyOne = async (pw: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(pw);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(-1), 1500);
    } catch { /* */ }
  };

  const copyAll = async () => {
    if (passwords.length === 0) return;
    try {
      await navigator.clipboard.writeText(passwords.join('\n'));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch { /* */ }
  };

  if (!visible) return null;

  const charset = [upper ? UPPER : '', lower ? LOWER : '', digits ? DIGITS : '', symbols ? SYMBOLS : ''].join('');

  return (
    <ToolModal visible={visible} title="🔑 随机密码生成" onClose={onClose} size="sm">
          {/* 长度 + 生成数量 */}
          <div className="pw-row">
            <div className="pw-field pw-field-hal">
              <label className="pw-label">密码长度</label>
               <input
                type="number"
                className="pw-length-input"
                min={8}
                max={64}
                value={length}
                onChange={e => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v > 0) setLength(v);
                }}
              />
            </div>
            <div className="pw-field pw-field-hal">
              <label className="pw-label">生成数量</label>
              <input
                type="number"
                className="pw-count-input"
                min={1}
                max={999}
                value={count}
                onChange={e => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 1 && v <= 999) setCount(v);
                }}
              />
            </div>
          </div>

          {/* 字符类型 */}
          <div className="pw-field">
            <label className="pw-label">字符类型</label>
            <div className="pw-checks">
              <label className="pw-check">
                <input type="checkbox" checked={upper} onChange={e => setUpper(e.target.checked)} />
                <span className="pw-check-box" />
                A-Z
              </label>
              <label className="pw-check">
                <input type="checkbox" checked={lower} onChange={e => setLower(e.target.checked)} />
                <span className="pw-check-box" />
                a-z
              </label>
              <label className="pw-check">
                <input type="checkbox" checked={digits} onChange={e => setDigits(e.target.checked)} />
                <span className="pw-check-box" />
                0-9
              </label>
              <label className="pw-check">
                <input type="checkbox" checked={symbols} onChange={e => setSymbols(e.target.checked)} />
                <span className="pw-check-box" />
                !@#$%
              </label>
            </div>
          </div>

          {/* 生成按钮 */}
          <button className="pw-gen-btn" onClick={generate}>生成密码</button>

          {/* 结果列表 */}
          {passwords.length > 0 && (
            <div className="pw-results">
              <div className="pw-results-header">
                <span className="pw-results-count">共 {passwords.length} 条</span>
                <button className="pw-copy-all-btn" onClick={copyAll}>
                  {copiedAll ? '已复制全部' : '复制全部'}
                </button>
              </div>
              {passwords[0] !== '请至少选择一种字符类型' ? (
                <div className="pw-list">
                  {passwords.map((pw, i) => {
                    const strength = getStrength(Math.max(8, Math.min(64, length)), charset);
                    return (
                      <div key={i} className="pw-item">
                        <span className="pw-index">{i + 1}</span>
                        <code className="pw-text">{pw}</code>
                        <span className={`pw-tag ${strength.cls}`}>{strength.label}</span>
                        <button className="pw-item-copy" onClick={() => copyOne(pw, i)}>
                          {copiedIdx === i ? '✓' : '复制'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="pw-error">{passwords[0]}</div>
              )}
            </div>
          )}
    </ToolModal>
  );
}
