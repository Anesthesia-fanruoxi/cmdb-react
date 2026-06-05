/**
 * Markdown 渲染组件
 * 支持：语法高亮、数学公式(KaTeX)、流程图(Mermaid)
 */

import { useMemo, useEffect, useRef, useCallback } from 'react';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import katex from 'katex';
import mermaid from 'mermaid';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github.css';
import './index.css';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

// 初始化 mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'inherit',
});

// KaTeX 插件：支持 $...$ 行内公式和 $$...$$ 块公式
const katexPlugin = (md: MarkdownIt) => {
  // 块级公式 $$...$$
  md.block.ruler.after('blockquote', 'katex_block', (state, start, end, silent) => {
    const startPos = state.bMarks[start] + state.tShift[start];
    const maxPos = state.eMarks[start];
    const lineText = state.src.slice(startPos, maxPos).trim();

    if (!lineText.startsWith('$$')) return false;

    // 单行 $$...$$ 情况
    if (lineText.length > 4 && lineText.endsWith('$$')) {
      if (silent) return true;
      const formula = lineText.slice(2, -2).trim();
      const token = state.push('katex_block', '', 0);
      token.content = formula;
      token.map = [start, start + 1];
      state.line = start + 1;
      return true;
    }

    // 多行情况
    let nextLine = start + 1;
    let found = false;
    while (nextLine < end) {
      const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
      const lineEnd = state.eMarks[nextLine];
      const line = state.src.slice(lineStart, lineEnd).trim();
      if (line === '$$') {
        found = true;
        break;
      }
      nextLine++;
    }

    if (!found) return false;
    if (silent) return true;

    const formulaLines: string[] = [];
    for (let i = start + 1; i < nextLine; i++) {
      const ls = state.bMarks[i] + state.tShift[i];
      const le = state.eMarks[i];
      formulaLines.push(state.src.slice(ls, le));
    }

    const token = state.push('katex_block', '', 0);
    token.content = formulaLines.join('\n').trim();
    token.map = [start, nextLine + 1];
    state.line = nextLine + 1;
    return true;
  });

  md.renderer.rules.katex_block = (tokens, idx) => {
    const t = tokens[idx];
    const lineAttr = t.map ? ` data-source-line="${t.map[0]}"` : '';
    try {
      return `<div class="katex-block"${lineAttr}>${katex.renderToString(t.content, { displayMode: true, throwOnError: false })}</div>`;
    } catch {
      return `<div class="katex-error"${lineAttr}>${t.content}</div>`;
    }
  };

  // 行内公式 $...$
  md.inline.ruler.after('escape', 'katex_inline', (state, silent) => {
    const start = state.pos;
    if (state.src[start] !== '$') return false;
    if (state.src[start + 1] === '$') return false; // 跳过 $$

    let end = start + 1;
    while (end < state.posMax) {
      if (state.src[end] === '$' && state.src[end - 1] !== '\\') break;
      end++;
    }

    if (end >= state.posMax) return false;
    if (start + 1 === end) return false; // 空公式
    if (silent) return true;

    const token = state.push('katex_inline', '', 0);
    token.content = state.src.slice(start + 1, end);
    state.pos = end + 1;
    return true;
  });

  md.renderer.rules.katex_inline = (tokens, idx) => {
    try {
      return katex.renderToString(tokens[idx].content, { displayMode: false, throwOnError: false });
    } catch {
      return `<span class="katex-error">${tokens[idx].content}</span>`;
    }
  };
};

// 初始化 markdown 解析器
const md: MarkdownIt = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
});

md.use(katexPlugin);

// fence 代码块渲染（同时注入 data-source-line）
md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const lang = token.info.trim();
  const code = token.content;
  const lineAttr = token.map ? ` data-source-line="${token.map[0]}"` : '';
  if (lang === 'mermaid') {
    return `<div class="mermaid-wrapper"${lineAttr}><pre class="mermaid-code" data-mermaid="${encodeURIComponent(code)}">${md.utils.escapeHtml(code)}</pre></div>`;
  }
  if (lang && hljs.getLanguage(lang)) {
    try {
      return `<pre class="hljs-code-block"${lineAttr}><code class="hljs language-${lang}">${hljs.highlight(code, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
    } catch { /* fallback */ }
  }
  return `<pre class="hljs-code-block"${lineAttr}><code class="hljs">${md.utils.escapeHtml(code)}</code></pre>`;
};

// 给所有带 map 的块级 _open token 注入 data-source-line
md.core.ruler.push('inject_source_line', state => {
  state.tokens.forEach(token => {
    if (token.map && token.level === 0 && token.type.endsWith('_open')) {
      token.attrSet('data-source-line', String(token.map[0]));
    }
  });
  return true;
});

// mermaid 计数器
let mermaidId = 0;

const MarkdownView = ({ content, className = '' }: MarkdownViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 渲染 markdown 内容
  const renderedContent = useMemo(() => {
    return content ? md.render(content) : '';
  }, [content]);

  // 渲染 mermaid 图表
  const renderMermaid = useCallback(async () => {
    if (!containerRef.current) return;
    const mermaidBlocks = containerRef.current.querySelectorAll('.mermaid-code[data-mermaid]');

    for (const block of Array.from(mermaidBlocks)) {
      const code = decodeURIComponent(block.getAttribute('data-mermaid') || '');
      const wrapper = block.parentElement;
      if (!wrapper || wrapper.querySelector('.mermaid-svg')) continue;

      try {
        const id = `mermaid-${mermaidId++}`;
        const { svg } = await mermaid.render(id, code);
        const svgDiv = document.createElement('div');
        svgDiv.className = 'mermaid-svg';
        svgDiv.innerHTML = svg;
        wrapper.appendChild(svgDiv);
        (block as HTMLElement).style.display = 'none';
      } catch (err) {
        console.warn('Mermaid render failed:', err);
        const errDiv = document.createElement('div');
        errDiv.className = 'mermaid-error';
        errDiv.textContent = '图表渲染失败';
        wrapper.appendChild(errDiv);
      }
    }
  }, []);

  // 添加复制按钮到代码块
  useEffect(() => {
    if (!containerRef.current) return;

    const codeBlocks = containerRef.current.querySelectorAll('pre.hljs-code-block, pre:not(.mermaid-code)');
    codeBlocks.forEach(block => {
      if (block.querySelector('.copy-btn')) return;
      if (block.classList.contains('mermaid-code')) return;

      const button = document.createElement('button');
      button.className = 'copy-btn';
      button.innerHTML = '复制';
      button.onclick = async () => {
        try {
          const code = block.querySelector('code');
          if (code) {
            await navigator.clipboard.writeText(code.textContent || '');
            button.innerHTML = '已复制!';
            setTimeout(() => { button.innerHTML = '复制'; }, 2000);
          }
        } catch (err) {
          console.error('复制失败:', err);
        }
      };

      (block as HTMLElement).style.position = 'relative';
      block.appendChild(button);
    });

    // 渲染 mermaid
    renderMermaid();

    // 表格包裹（实现横向滚动）
    const tables = containerRef.current.querySelectorAll('table');
    tables.forEach(table => {
      if (table.parentElement?.classList.contains('table-wrapper')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrapper';
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }, [renderedContent, renderMermaid]);

  return (
    <div
      ref={containerRef}
      className={`markdown-view ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  );
};

export default MarkdownView;
