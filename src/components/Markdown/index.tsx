/**
 * Markdown 渲染组件
 */

import { useMemo, useEffect, useRef } from 'react';
import MarkdownIt from 'markdown-it';
import './index.css';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

// 初始化 markdown 解析器
const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true
});

const MarkdownView = ({ content, className = '' }: MarkdownViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 渲染 markdown 内容
  const renderedContent = useMemo(() => {
    return content ? md.render(content) : '';
  }, [content]);

  // 添加复制按钮到代码块
  useEffect(() => {
    if (!containerRef.current) return;

    const codeBlocks = containerRef.current.querySelectorAll('pre');
    codeBlocks.forEach(block => {
      // 如果已经添加过按钮，就不再添加
      if (block.querySelector('.copy-btn')) return;

      // 创建复制按钮
      const button = document.createElement('button');
      button.className = 'copy-btn';
      button.innerHTML = '复制';
      button.onclick = async () => {
        try {
          const code = block.querySelector('code');
          if (code) {
            await navigator.clipboard.writeText(code.textContent || '');
            button.innerHTML = '已复制!';
            setTimeout(() => {
              button.innerHTML = '复制';
            }, 2000);
          }
        } catch (err) {
          console.error('复制失败:', err);
        }
      };

      block.appendChild(button);
    });
  }, [renderedContent]);

  return (
    <div
      ref={containerRef}
      className={`markdown-view ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  );
};

export default MarkdownView;
