/**
 * 驼峰命名转换工具
 */
import { useState, useCallback } from 'react';
import ToolModal from '../ToolModal';
import './style.css';

interface CaseConvertProps {
  visible: boolean;
  onClose: () => void;
}

const toCamelCase = (s: string) => s.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '').replace(/^[A-Z]/, c => c.toLowerCase());
const toPascalCase = (s: string) => { const c = toCamelCase(s); return c.charAt(0).toUpperCase() + c.slice(1); };
const toSnakeCase = (s: string) => s.replace(/([A-Z])/g, '_$1').replace(/[-_\s]+/g, '_').toLowerCase().replace(/^_/, '');
const toKebabCase = (s: string) => s.replace(/([A-Z])/g, '-$1').replace(/[_\s]+/g, '-').toLowerCase().replace(/^-/, '');
const toScreamingSnake = (s: string) => toSnakeCase(s).toUpperCase();

const CONVERTERS: { label: string; fn: (s: string) => string }[] = [
  { label: 'camelCase', fn: toCamelCase },
  { label: 'PascalCase', fn: toPascalCase },
  { label: 'snake_case', fn: toSnakeCase },
  { label: 'kebab-case', fn: toKebabCase },
  { label: 'SCREAMING_SNAKE', fn: toScreamingSnake },
];

/** 核心内容，可在弹框和独立窗口中复用 */
export function CaseConvertContent() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<{ label: string; value: string }[] | null>(null);
  const [copiedIdx, setCopiedIdx] = useState(-1);

  const convert = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setResults(CONVERTERS.map(c => ({ label: c.label, value: c.fn(trimmed) })));
    setCopiedIdx(-1);
  }, [input]);

  const copy = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(-1), 1500);
    } catch { /* */ }
  };

  return (
    <>
      <textarea
        className="cc-input"
        placeholder="输入要转换的文本，例如：hello_world"
        value={input}
        onChange={e => setInput(e.target.value)}
        rows={3}
      />
      <button className="cc-convert-btn" onClick={convert}>转换</button>
      {results && (
        <div className="cc-results">
          {results.map((r, i) => (
            <div key={r.label} className="cc-row">
              <span className="cc-label">{r.label}</span>
              <code className="cc-value">{r.value}</code>
              <button className="cc-copy" onClick={() => copy(r.value, i)}>{copiedIdx === i ? '✓' : '复制'}</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** 独立窗口版本 */
export function CaseConvertWindow() {
  return (
    <div className="tool-window-root">
      <CaseConvertContent />
    </div>
  );
}

/** 弹框版本 */
export default function CaseConvert({ visible, onClose }: CaseConvertProps) {
  if (!visible) return null;
  return (
    <ToolModal visible={visible} title="🐪 驼峰转换" onClose={onClose} size="sm">
      <CaseConvertContent />
    </ToolModal>
  );
}
