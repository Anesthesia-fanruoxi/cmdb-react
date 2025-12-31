/**
 * 应用内通知组件
 * 显示在屏幕右下角，2秒后自动消失
 */

import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import './style.css';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationProps {
  type: NotificationType;
  title: string;
  content: string;
  duration?: number;
  onClose: () => void;
}

const icons = {
  success: <CheckCircle size={24} />,
  error: <XCircle size={24} />,
  warning: <AlertCircle size={24} />,
  info: <Info size={24} />,
};

const NotificationItem = ({ type, title, content, duration = 2000, onClose }: NotificationProps) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`app-notification app-notification-${type} ${visible ? 'show' : 'hide'}`}>
      <span className="app-notification-icon">{icons[type]}</span>
      <div className="app-notification-content">
        <div className="app-notification-title">{title}</div>
        <div className="app-notification-body">{content}</div>
      </div>
      <button className="app-notification-close" onClick={() => { setVisible(false); setTimeout(onClose, 300); }}>
        <X size={16} />
      </button>
    </div>
  );
};

// 通知容器
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let notifications: { id: number; type: NotificationType; title: string; content: string; duration?: number }[] = [];
let idCounter = 0;

const renderNotifications = () => {
  if (!container) {
    container = document.createElement('div');
    container.className = 'app-notification-container';
    document.body.appendChild(container);
    root = createRoot(container);
  }

  const removeNotification = (id: number) => {
    notifications = notifications.filter(n => n.id !== id);
    renderNotifications();
  };

  root?.render(
    <>
      {notifications.map(n => (
        <NotificationItem
          key={n.id}
          type={n.type}
          title={n.title}
          content={n.content}
          duration={n.duration}
          onClose={() => removeNotification(n.id)}
        />
      ))}
    </>
  );
};

const show = (type: NotificationType, title: string, content: string, duration?: number) => {
  notifications.push({ id: ++idCounter, type, title, content, duration });
  renderNotifications();
};

export const appNotification = {
  success: (title: string, content?: string, duration?: number) => show('success', title, content || '', duration),
  error: (title: string, content?: string, duration?: number) => show('error', title, content || '', duration),
  warning: (title: string, content?: string, duration?: number) => show('warning', title, content || '', duration),
  info: (title: string, content?: string, duration?: number) => show('info', title, content || '', duration),
};

// 简化版本，用于替换 alert()
export const toast = {
  success: (msg: string) => show('success', '成功', msg),
  error: (msg: string) => show('error', '错误', msg),
  warning: (msg: string) => show('warning', '警告', msg),
  info: (msg: string) => show('info', '提示', msg),
};

export default appNotification;
