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
  mode?: 'confirm' | 'alert';
}

interface ConfirmModalProps extends ConfirmOptions {
  onOk: () => void;
  onCancel?: () => void;
}

const ConfirmModal = ({ title, content, okText, cancelText, type, mode, onOk, onCancel }: ConfirmModalProps) => {
  const isAlert = mode === 'alert';
  return (
    <div className="confirm-overlay" onClick={e => { e.stopPropagation(); if (isAlert) onOk(); else onCancel?.(); }}>
      <div className={`confirm-modal ${type || (isAlert ? 'info' : 'info')}`} onClick={e => e.stopPropagation()}>
        {title && <div className="confirm-title">{title}</div>}
        <div className="confirm-content">{content}</div>
        <div className="confirm-actions">
          {!isAlert && (
            <button className="confirm-btn cancel" onClick={onCancel}>
              {cancelText || '取消'}
            </button>
          )}
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
      // 延迟移除，避免 DOM 移除后点击事件冒泡穿透到底层元素
      setTimeout(() => {
        root.unmount();
        container.remove();
      }, 0);
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

/**
 * 显示提示弹框（替换原生 alert()）
 */
export const alert = (content: string, options?: Omit<ConfirmOptions, 'content' | 'mode'>): Promise<void> => {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const cleanup = () => {
      setTimeout(() => {
        root.unmount();
        container.remove();
      }, 0);
    };

    root.render(
      <ConfirmModal
        content={content}
        title={options?.title}
        okText={options?.okText || '我知道了'}
        type={options?.type || 'info'}
        mode="alert"
        onOk={() => { cleanup(); resolve(); }}
      />
    );
  });
};

export default ConfirmModal;
