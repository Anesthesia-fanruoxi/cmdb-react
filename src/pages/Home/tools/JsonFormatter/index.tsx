/**
 * JSON 格式化工具
 * 左右布局：左边输入（含错误高亮），右边实时显示可折叠 JSON 树
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import ToolModal from '../ToolModal';
import JsonTree from './JsonTree';
import './style.css';

/** 最小/最大面板宽度百分比 */
const MIN_PANEL = 20;
const MAX_PANEL = 80;

interface JsonFormatterProps {
  visible: boolean;
  onClose: () => void;
}

const DEFAULT_JSON = ``;

/** 从 JSON.parse 错误信息中提取字符位置 */
function parseErrorPosition(msg: string): number {
  // Chrome: "... is not valid JSON" — 无位置，需要逐步试探
  // Firefox/旧版: "JSON.parse: ... at line X column Y"
  const lineCol = msg.match(/line (\d+) column (\d+)/);
  if (lineCol) return -1; // 返回 -1 表示用行列定位

  // "at position N" (部分环境)
  const pos = msg.match(/at position (\d+)/);
  if (pos) return parseInt(pos[1], 10);

  return -1;
}

/** 从错误信息提取行列（Firefox 格式） */
function parseErrorLineCol(msg: string): { line: number; col: number } | null {
  const m = msg.match(/line (\d+) column (\d+)/);
  if (m) return { line: parseInt(m[1], 10), col: parseInt(m[2], 10) };
  return null;
}

/** 将字符位置转换为行列号 */
function posToLineCol(text: string, pos: number): { line: number; col: number } {
  const lines = text.slice(0, pos).split('\n');
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}

/** 用二分法找到第一个导致解析失败的字符位置 */
function findErrorPos(text: string): number {
  // 先尝试从错误信息提取
  try { JSON.parse(text); return -1; } catch (e: any) {
    const pos = parseErrorPosition(e.message);
    if (pos >= 0) return pos;

    const lc = parseErrorLineCol(e.message);
    if (lc) {
      const lines = text.split('\n');
      let offset = 0;
      for (let i = 0; i < lc.line - 1 && i < lines.length; i++) {
        offset += lines[i].length + 1;
      }
      return offset + lc.col - 1;
    }

    // 二分法兜底：找最短仍报错的前缀
    let lo = 0, hi = text.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      try { JSON.parse(text.slice(0, mid) + '"_"'); lo = mid + 1; } catch { hi = mid; }
    }
    return Math.min(lo, text.length - 1);
  }
}

/** 转义 HTML 特殊字符 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 生成带错误高亮的 HTML，在 errPos 处插入 <mark> */
function buildHighlightHtml(text: string, errPos: number): string {
  if (errPos < 0 || errPos >= text.length) return escapeHtml(text);
  const before = escapeHtml(text.slice(0, errPos));
  const errChar = escapeHtml(text[errPos] || ' ');
  const after = escapeHtml(text.slice(errPos + 1));
  return `${before}<mark class="jf-err-mark">${errChar}</mark>${after}`;
}

/** 核心内容，可在弹框和独立窗口中复用 */
export function JsonFormatterContent() {
  const [input, setInput] = useState(DEFAULT_JSON);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [parsed, setParsed] = useState<any>(null);
  const [error, setError] = useState('');
  const [errPos, setErrPos] = useState(-1);
  const [errLineCol, setErrLineCol] = useState<{ line: number; col: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 分割线拖拽状态
  const [splitRatio, setSplitRatio] = useState(50);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startRatio = useRef(50);

  useEffect(() => {
    setCopied(false);
    const trimmed = input.trim();
    if (!trimmed) { setParsed(null); setError(''); setErrPos(-1); setErrLineCol(null); return; }
    try {
      setParsed(JSON.parse(trimmed));
      setError('');
      setErrPos(-1);
      setErrLineCol(null);
    } catch (e: any) {
      const msg = e.message || '无效的 JSON';
      setError(msg);
      setParsed(null);
      const pos = findErrorPos(input);
      setErrPos(pos);
      setErrLineCol(pos >= 0 ? posToLineCol(input, pos) : null);
    }
  }, [input]);

  // 同步 textarea 和高亮层的滚动
  const syncScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // 分割线拖拽逻辑
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startRatio.current = splitRatio;
    document.body.classList.add('jf-resizing');
  }, [splitRatio]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const dx = e.clientX - startX.current;
      const deltaPercent = (dx / containerWidth) * 100;
      const newRatio = Math.max(MIN_PANEL, Math.min(MAX_PANEL, startRatio.current + deltaPercent));
      setSplitRatio(newRatio);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.classList.remove('jf-resizing');
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const copy = async () => {
    if (!parsed) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(parsed, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* */ }
  };

  const highlightHtml = error && errPos >= 0 ? buildHighlightHtml(input, errPos) : '';

  return (
    <div className="jf-container" ref={containerRef}>
      {/* 左侧输入区 */}
      <div className="jf-panel" style={{ flex: `0 0 calc(${splitRatio}% - 3px)` }}>
        <div className="jf-panel-header">
          <span className="jf-panel-title">输入</span>
          {error && errLineCol && (
            <span className="jf-err-badge">
              ⚠️ 第 {errLineCol.line} 行 第 {errLineCol.col} 列
            </span>
          )}
        </div>
        {/* 叠加层：高亮 div + textarea */}
        <div className="jf-editor-wrap">
          {/* 高亮层（仅错误时显示） */}
          {error && errPos >= 0 && (
            <div
              ref={highlightRef}
              className="jf-highlight-layer"
              dangerouslySetInnerHTML={{ __html: highlightHtml + '\n' }}
            />
          )}
          <textarea
            ref={textareaRef}
            className={`jf-textarea ${error ? 'jf-textarea--error' : ''}`}
            placeholder='粘贴 JSON 字符串，例如：{"name":"test"}'
            value={input}
            onChange={e => setInput(e.target.value)}
            onScroll={syncScroll}
            spellCheck={false}
          />
        </div>
      </div>

      {/* 拖拽分割线 */}
      <div
        className="jf-resizer"
        onMouseDown={handleDragStart}
      />

      {/* 右侧树视图 */}
      <div className="jf-panel" style={{ flex: `0 0 calc(${100 - splitRatio}% - 3px)` }}>
        <div className="jf-panel-header">
          <div className="jf-panel-title-group">
            <span className="jf-panel-title">
              {error ? '错误' : '树视图'}
            </span>
            {parsed && !error && (
              <span className="jf-hint-tag">🖱️ 右键折叠</span>
            )}
          </div>
          {parsed && !error && (
            <button className="jf-copy-btn" onClick={copy}>
              {copied ? '✓ 已复制' : '📋 复制'}
            </button>
          )}
        </div>
        {error ? (
          <div className="jf-error-box">
            <div className="jf-error-main">
              <span className="jf-error-icon">⚠️</span>
              <span className="jf-error-text">{error}</span>
            </div>
            {errLineCol && (
              <div className="jf-error-loc">
                错误位置：第 {errLineCol.line} 行，第 {errLineCol.col} 列
              </div>
            )}
          </div>
        ) : (
          <div className="jf-output" onContextMenu={e => e.preventDefault()}>
            {parsed !== null && <JsonTree data={parsed} />}
          </div>
        )}
      </div>
    </div>
  );
}

/** 独立窗口版本：直接渲染内容，填满整个窗口 */
export function JsonFormatterWindow() {
  return (
    <div className="tool-window-root">
      <JsonFormatterContent />
    </div>
  );
}

/** 弹框版本（首页卡片点击使用） */
export default function JsonFormatter({ visible, onClose }: JsonFormatterProps) {
  if (!visible) return null;
  return (
    <ToolModal visible={visible} title="📋 JSON 格式化" onClose={onClose} size="lg">
      <JsonFormatterContent />
    </ToolModal>
  );
}
