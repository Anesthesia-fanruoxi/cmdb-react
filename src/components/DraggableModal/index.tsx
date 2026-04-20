/**
 * 可拖拽弹窗组件
 * 支持拖拽移动，拖到窗口边缘可分离成独立窗口
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { createDetachedWindow } from '@/utils/window.ts';
import './style.css';

interface Props {
  visible: boolean;
  title: string;
  width?: number;
  onClose: () => void;
  children: React.ReactNode;
  /** 是否显示右上角关闭按钮，默认 true */
  showCloseBtn?: boolean;
  /** 分离窗口配置 */
  detachConfig?: {
    label: string;
    url: string;
    width?: number;
    height?: number;
  };
}

const DraggableModal = ({ visible, title, width = 480, onClose, children, showCloseBtn = true, detachConfig }: Props) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isNearEdge, setIsNearEdge] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });

  // 重置位置
  useEffect(() => {
    if (visible) {
      setPosition({ x: 0, y: 0 });
      setIsNearEdge(false);
    }
  }, [visible]);

  // ESC 键关闭
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.modal-header')) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    }
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;
    setPosition({ x: newX, y: newY });

    // 检测是否靠近窗口边缘（50px范围内）
    const threshold = 50;
    const nearEdge = e.clientX < threshold || 
                     e.clientY < threshold || 
                     e.clientX > window.innerWidth - threshold ||
                     e.clientY > window.innerHeight - threshold;
    setIsNearEdge(nearEdge && !!detachConfig);
  }, [isDragging, detachConfig]);

  const handleMouseUp = useCallback(async () => {
    if (!isDragging) return;
    setIsDragging(false);

    // 如果在边缘释放且有分离配置，创建独立窗口
    if (isNearEdge && detachConfig) {
      onClose();
      await createDetachedWindow({
        label: detachConfig.label,
        title,
        url: detachConfig.url,
        width: detachConfig.width || 560,
        height: detachConfig.height || 500,
      });
    }
    setIsNearEdge(false);
  }, [isDragging, isNearEdge, detachConfig, title, onClose]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!visible) return null;

  return (
    <div className="draggable-modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className={`draggable-modal ${isDragging ? 'dragging' : ''} ${isNearEdge ? 'near-edge' : ''}`}
        style={{ width, transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))` }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
      >
        <div className="modal-header">
          <h4>{title}</h4>
          {showCloseBtn && <button className="close-btn" onClick={onClose}>×</button>}
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
};

export default DraggableModal;
