/**
 * 确认弹框组件
 */

import { createRoot } from 'react-dom/client';
import './style.css';

interface ConfirmOptions {
  title?: string;
  content: string;
  okText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'danger';
}

interface ConfirmModalProps extends ConfirmOptions {
  onOk: () => void;
  onCancel: () => void;
}

const ConfirmModal = ({ title, content, okText, cancelText, type, onOk, onCancel }: ConfirmModalProps) => {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className={`confirm-modal ${type || 'info'}`} onClick={e => e.stopPropagation()}>
        {title && <div className="confirm-title">{title}</div>}
        <div className="confirm-content">{content}</div>
        <div className="confirm-actions">
          <button className="confirm-btn cancel" onClick={onCancel}>
            {cancelText || '取消'}
          </button>
          <button className="confirm-btn ok" onClick={onOk}>
            {okText || '确定'}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * 显示确认弹框
 */
export const confirm = (options: ConfirmOptions): Promise<boolean> => {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const cleanup = () => {
      root.unmount();
      container.remove();
    };

    const handleOk = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    root.render(
      <ConfirmModal {...options} onOk={handleOk} onCancel={handleCancel} />
    );
  });
};

export default ConfirmModal;
