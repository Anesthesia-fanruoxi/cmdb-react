/**
 * 工具弹框共享组件
 * 点击遮罩层不关闭，仅 ESC 和 X 按钮关闭
 */
import { useEffect, useCallback, type ReactNode } from 'react';

interface ToolModalProps {
  visible: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  size?: 'sm' | 'md';
}

export default function ToolModal({ visible, title, children, onClose, size = 'sm' }: ToolModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [visible, handleKeyDown]);

  if (!visible) return null;

  return (
    <div className="tool-overlay">
      <div className={`tool-modal ${size === 'sm' ? 'tool-modal--sm' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="tool-modal-header">
          <span className="tool-modal-title">{title}</span>
          <button className="tool-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="tool-modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
