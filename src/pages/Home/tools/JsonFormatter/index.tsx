/**
 * JSON 格式化工具
 */
import { useState, useCallback } from 'react';
import ToolModal from '../ToolModal';
import './style.css';

interface JsonFormatterProps {
  visible: boolean;
  onClose: () => void;
}

export default function JsonFormatter({ visible, onClose }: JsonFormatterProps) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const process = useCallback((mode: 'format' | 'compress') => {
    setError('');
    setCopied(false);
    const trimmed = input.trim();
    if (!trimmed) { setOutput(''); return; }

    try {
      const parsed = JSON.parse(trimmed);
      setOutput(mode === 'format' ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed));
    } catch (e: any) {
      setError(e.message || '无效的 JSON');
      setOutput('');
    }
  }, [input]);

  const format = useCallback(() => process('format'), [process]);
  const compress = useCallback(() => process('compress'), [process]);

  const copy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* */ }
  };

  if (!visible) return null;

  return (
    <ToolModal visible={visible} title="📋 JSON 格式化" onClose={onClose} size="md">
          <div className="jf-section">
            <label className="jf-section-label">输入 JSON</label>
            <textarea
              className="jf-textarea"
              placeholder='输入 JSON 字符串，例如：{"name":"test"}'
              value={input}
              onChange={e => { setInput(e.target.value); setError(''); setOutput(''); }}
              rows={6}
            />
          </div>

          <div className="jf-actions">
            <button className="jf-btn jf-btn-format" onClick={format}>美化</button>
            <button className="jf-btn jf-btn-compress" onClick={compress}>压缩</button>
          </div>

          {error && (
            <div className="jf-error">
              <span className="jf-error-icon">⚠️</span>
              {error}
            </div>
          )}

          {output && (
            <div className="jf-section">
              <div className="jf-section-label-row">
                <label className="jf-section-label">结果</label>
                <button className="jf-copy-btn" onClick={copy}>{copied ? '已复制' : '复制'}</button>
              </div>
              <pre className="jf-output">{output}</pre>
            </div>
          )}
    </ToolModal>
  );
}
