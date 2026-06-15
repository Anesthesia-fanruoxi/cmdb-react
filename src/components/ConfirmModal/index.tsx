/**
 * 确认弹框组件
 */

import { createRoot } from 'react-dom/client';
import './style.css';

interface ConfirmButton {
  text: string;
  type?: 'ok' | 'cancel' | 'primary' | 'danger' | 'warning';
  onClick?: () => void;
}

interface ConfirmOptions {
  title?: string;
  content: string;
  okText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'danger';
  mode?: 'confirm' | 'alert';
  buttons?: ConfirmButton[];
}

interface ConfirmModalProps extends ConfirmOptions {
  onOk: () => void;
  onCancel?: () => void;
  onClose?: (index: number) => void;
}

const ConfirmModal = ({ title, content, okText, cancelText, type, mode, buttons, onOk, onCancel, onClose }: ConfirmModalProps) => {
  const isAlert = mode === 'alert';
  return (
    <div className="confirm-overlay" onClick={e => { e.stopPropagation(); if (isAlert) onOk(); else onCancel?.(); }}>
      <div className={`confirm-modal ${type || (isAlert ? 'info' : 'info')}`} onClick={e => e.stopPropagation()}>
        {title && <div className="confirm-title">{title}</div>}
        <div className="confirm-content">{content}</div>
        <div className="confirm-actions">
          {buttons ? (
            buttons.map((btn, idx) => (
              <button key={idx} className={`confirm-btn ${btn.type || 'ok'}`} onClick={() => onClose?.(idx)}>
                {btn.text}
              </button>
            ))
          ) : (
            <>
              {!isAlert && (
                <button className="confirm-btn cancel" onClick={onCancel}>
                  {cancelText || '取消'}
                </button>
              )}
              <button className="confirm-btn ok" onClick={onOk}>
                {okText || '确定'}
              </button>
            </>
          )}
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
 * 显示多按钮确认弹框，返回按钮索引
 */
export const confirmButtons = (options: ConfirmOptions): Promise<number> => {
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
        {...options}
        onOk={() => { cleanup(); resolve(-1); }}
        onCancel={() => { cleanup(); resolve(-1); }}
        onClose={(idx) => { cleanup(); resolve(idx); }}
      />
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
