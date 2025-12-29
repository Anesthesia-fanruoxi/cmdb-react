/**
 * 内容区域组件
 */

import type { ReactNode } from 'react';
import './Content.css';

interface ContentProps {
  /** 子元素 */
  children?: ReactNode;
  /** 页面标题 */
  title?: string;
}

const Content = ({ children, title }: ContentProps) => {
  return (
    <main className="app-content">
      {title && (
        <div className="content-header">
          <h2 className="content-title">{title}</h2>
        </div>
      )}
      <div className="content-body">
        {children}
      </div>
    </main>
  );
};

export default Content;
