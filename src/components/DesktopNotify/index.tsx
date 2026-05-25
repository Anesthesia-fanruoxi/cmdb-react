import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import './style.css';

export interface DesktopNotifyProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  content: string;
  duration?: number;
  onClose: () => void;
  onClick?: () => void;
}

const DesktopNotify = ({
  visible,
  title,
  subtitle,
  content,
  duration = 5000,
  onClose,
  onClick,
}: DesktopNotifyProps) => {
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (duration > 0) {
        const timer = window.setTimeout(onClose, duration);
        return () => window.clearTimeout(timer);
      }
    } else {
      const timer = window.setTimeout(() => setMounted(false), 220);
      return () => window.clearTimeout(timer);
    }
  }, [visible, duration, onClose]);

  if (!mounted) return null;

  return (
    <div className={`desktop-notify ${visible ? 'show' : 'hide'}`}>
      <div className="desktop-notify-card" onClick={onClick} role="button" tabIndex={0}>
        <div className="desktop-notify-header">
          <div className="desktop-notify-title-wrap">
            <div className="desktop-notify-icon">
              <Bell size={16} />
            </div>
            <div className="desktop-notify-titles">
              <div className="desktop-notify-title">{title}</div>
              {subtitle ? <div className="desktop-notify-subtitle">{subtitle}</div> : null}
            </div>
          </div>
          <button
            type="button"
            className="desktop-notify-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <X size={14} />
          </button>
        </div>
        <div className="desktop-notify-content">{content}</div>
        <div className="desktop-notify-footer">点击可模拟跳转详情</div>
      </div>
    </div>
  );
};

export default DesktopNotify;
