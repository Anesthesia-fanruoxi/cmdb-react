/**
 * 加载状态组件
 * 显示加载动画和可选的提示文字
 */

import './style.css';

interface LoadingProps {
  /** 提示文字 */
  text?: string;
  /** 是否全屏显示 */
  fullscreen?: boolean;
  /** 加载指示器大小 */
  size?: 'small' | 'medium' | 'large';
}

const Loading = ({ 
  text = '加载中...', 
  fullscreen = false,
  size = 'medium' 
}: LoadingProps) => {
  const content = (
    <div className={`loading-content loading-${size}`}>
      <div className="loading-spinner" />
      {text && <span className="loading-text">{text}</span>}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="loading-overlay">
        {content}
      </div>
    );
  }

  return content;
};

export default Loading;
