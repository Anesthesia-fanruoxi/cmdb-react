/**
 * Toast 消息提示组件
 */

import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import './style.css';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  type: ToastType;
  message: string;
  duration?: number;
  onClose: () => void;
  onClick?: () => void;
}

const icons = {
  success: <CheckCircle size={20} />,
  error: <XCircle size={20} />,
  warning: <AlertCircle size={20} />,
  info: <AlertCircle size={20} />,
};

const ToastItem = ({ type, message, duration = 3000, onClose, onClick }: ToastProps) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className={`toast-item toast-${type} ${visible ? 'show' : 'hide'} ${onClick ? 'toast-clickable' : ''}`}
      onClick={() => { onClick?.(); setVisible(false); setTimeout(onClose, 300); }}
    >
      <span className="toast-icon">{icons[type]}</span>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={() => { setVisible(false); setTimeout(onClose, 300); }}>
        <X size={14} />
      </button>
    </div>
  );
};

// Toast 容器
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let toasts: { id: number; type: ToastType; message: string; duration?: number; onClick?: () => void }[] = [];
let idCounter = 0;

const renderToasts = () => {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
    root = createRoot(container);
  }

  const removeToast = (id: number) => {
    toasts = toasts.filter(t => t.id !== id);
    renderToasts();
  };

  root?.render(
    <>
      {toasts.map(t => (
        <ToastItem key={t.id} type={t.type} message={t.message} duration={t.duration} onClick={t.onClick} onClose={() => removeToast(t.id)} />
      ))}
    </>
  );
};

const show = (type: ToastType, message: string, duration?: number, onClick?: () => void) => {
  toasts.push({ id: ++idCounter, type, message, duration, onClick });
  renderToasts();
};

export const toast = {
  success: (msg: string, duration?: number, onClick?: () => void) => show('success', msg, duration, onClick),
  error: (msg: string, duration?: number, onClick?: () => void) => show('error', msg, duration, onClick),
  warning: (msg: string, duration?: number, onClick?: () => void) => show('warning', msg, duration, onClick),
  info: (msg: string, duration?: number, onClick?: () => void) => show('info', msg, duration, onClick),
};

export default toast;
