/**
 * 文档目录导航组件
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import './DocTocNav.css';

interface Heading {
  level: number;
  text: string;
  id: string;
}

interface DocTocNavProps {
  content: string;
  contentSelector?: string;
  containerSelector?: string;
}

const DocTocNav = ({ content, contentSelector = '.markdown-content', containerSelector = '.doc-content' }: DocTocNavProps) => {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeHeading, setActiveHeading] = useState('');
  const cleanupRef = useRef<(() => void) | null>(null);

  // 从 markdown 内容解析标题
  const parseHeadingsFromContent = useCallback((text: string): Heading[] => {
    if (!text) return [];
    const regex = /^(#{1,6})\s+(.+?)(?:\n|$)/gm;
    const matches: Heading[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      const level = match[1].length;
      const rawText = match[2].trim();
      // 去掉 markdown 格式：加粗、斜体、行内代码、链接
      const cleanText = rawText
        .replace(/\*\*(.+?)\*\*/g, '$1')  // **bold**
        .replace(/\*(.+?)\*/g, '$1')       // *italic*
        .replace(/`(.+?)`/g, '$1')         // `code`
        .replace(/\[(.+?)\]\(.+?\)/g, '$1'); // [link](url)
      const id = `heading-${rawText.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}-${matches.length}`;
      matches.push({ level, text: cleanText, id });
    }
    return matches;
  }, []);

  // 为 DOM 中的标题添加 ID
  const addIdsToHeadings = useCallback((parsedHeadings: Heading[]) => {
    const container = document.querySelector(contentSelector);
    if (!container || !parsedHeadings.length) {
      return false;
    }
    const headingElements = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (headingElements.length === 0) {
      return false;
    }
    headingElements.forEach((el, index) => {
      if (index < parsedHeadings.length) {
        el.id = parsedHeadings[index].id;
      }
    });
    return true;
  }, [contentSelector]);

  // 滚动到指定标题
  const scrollToHeading = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }
    
    // 直接使用 scrollIntoView，更可靠
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveHeading(id);
  }, []);

  // 设置滚动监听
  const setupScrollSpy = useCallback((parsedHeadings: Heading[]) => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    if (!parsedHeadings.length) return;

    const handleScroll = () => {
      const container = document.querySelector(containerSelector);
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      let currentHeading: string | null = null;
      let minDistance = Infinity;

      for (const heading of parsedHeadings) {
        const element = document.getElementById(heading.id);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        const topOffset = rect.top - containerRect.top;
        if (topOffset <= 50) {
          const distance = Math.abs(topOffset);
          if (distance < minDistance) {
            minDistance = distance;
            currentHeading = heading.id;
          }
        }
      }
      if (!currentHeading && parsedHeadings.length > 0) {
        currentHeading = parsedHeadings[0].id;
      }
      if (currentHeading) setActiveHeading(currentHeading);
    };

    const container = document.querySelector(containerSelector);
    if (container) {
      container.addEventListener('scroll', handleScroll);
      handleScroll();
      cleanupRef.current = () => container.removeEventListener('scroll', handleScroll);
    }
  }, [containerSelector]);

  // 解析标题并设置监听
  useEffect(() => {
    if (!content) {
      setHeadings([]);
      return;
    }
    const parsed = parseHeadingsFromContent(content);
    setHeadings(parsed);

    // 多次尝试添加 ID，确保 DOM 已渲染
    const tryAddIds = (attempt: number) => {
      if (attempt > 5) return;
      const success = addIdsToHeadings(parsed);
      if (success) {
        setupScrollSpy(parsed);
      } else {
        setTimeout(() => tryAddIds(attempt + 1), 200 * attempt);
      }
    };

    const timer = setTimeout(() => tryAddIds(1), 100);

    return () => {
      clearTimeout(timer);
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [content, parseHeadingsFromContent, addIdsToHeadings, setupScrollSpy]);

  if (headings.length === 0) return null;

  return (
    <div className="toc-container">
      <div className="toc-title">目录导航</div>
      <div className="toc-list">
        {headings.map((heading, index) => (
          <div
            key={index}
            className={`toc-item level-${heading.level} ${activeHeading === heading.id ? 'active' : ''}`}
            onClick={() => scrollToHeading(heading.id)}
            title={heading.text}
          >
            {heading.text}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocTocNav;
