/**
 * 状态弹框组件
 * 用于显示操作进度，支持自动关闭
 */

import { useEffect, useState } from 'react';
import './style.css';

interface StatusModalProps {
  visible: boolean;
  message: string;
  onClose?: () => void;
  autoClose?: number; // 自动关闭延迟（毫秒），0 表示不自动关闭
}

const StatusModal = ({ visible, message, onClose, autoClose = 0 }: StatusModalProps) => {
  useEffect(() => {
    if (visible && autoClose > 0 && onClose) {
      const timer = setTimeout(onClose, autoClose);
      return () => clearTimeout(timer);
    }
  }, [visible, autoClose, onClose]);

  if (!visible) return null;

  return (
    <div className="status-modal-overlay">
      <div className="status-modal">
        <div className="status-spinner" />
        <p className="status-message">{message}</p>
      </div>
    </div>
  );
};

// 命令式调用
let setModalState: React.Dispatch<React.SetStateAction<{
  visible: boolean;
  message: string;
  autoClose: number;
}>> | null = null;

export const StatusModalContainer = () => {
  const [state, setState] = useState({
    visible: false,
    message: '',
    autoClose: 0,
  });

  useEffect(() => {
    setModalState = setState;
    return () => { setModalState = null; };
  }, []);

  return (
    <StatusModal
      visible={state.visible}
      message={state.message}
      autoClose={state.autoClose}
      onClose={() => setState(s => ({ ...s, visible: false }))}
    />
  );
};

// 显示状态弹框
export const showStatus = (message: string) => {
  setModalState?.({ visible: true, message, autoClose: 0 });
};

// 更新消息并自动关闭
export const updateStatus = (message: string, autoClose = 1000) => {
  setModalState?.({ visible: true, message, autoClose });
};

// 关闭弹框
export const hideStatus = () => {
  setModalState?.(s => ({ ...s, visible: false }));
};

export default StatusModal;
