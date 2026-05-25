import { useEffect, useState } from 'react';
import { BellDot } from 'lucide-react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { updateApply } from '@/services/sql/apply';
import './DesktopNotifyWindow.css';

interface Props {
  title?: string;
  subtitle?: string;
  content?: string;
  duration?: number;
  // SQL 审批快捷操作
  applyId?: string;
  project?: string;
  description?: string;
}

const DesktopNotifyWindow = ({
  title = 'SQL 审批通知',
  subtitle = '刚刚',
  content = '',
  applyId,
  project,
  description,
}: Props) => {
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const win = getCurrentWebviewWindow();
    ['documentElement', 'body'].forEach(tag => {
      const el = document[tag as keyof Document] as HTMLElement | null;
      el?.style.setProperty('background', 'transparent', 'important');
    });
    document.getElementById('root')?.style.setProperty('background', 'transparent', 'important');
    win.show();

    // 10 秒后自动销毁
    const timer = window.setTimeout(() => { try { win.destroy(); } catch {} }, 10000);
    return () => window.clearTimeout(timer);
  }, []);

  const doAction = async (processType: number, label: string) => {
    if (!applyId) return;
    setActing(true);
    try {
      console.log('[Notify] 操作:', label, 'applyId:', applyId);
      const res = await updateApply({ id: applyId, process_type: processType });
      console.log('[Notify] 结果:', res);
      if (res.code === 200) {
        try { getCurrentWebviewWindow().destroy(); } catch {}
      }
    } catch (e) {
      console.error('[Notify] 操作失败:', e);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="desktop-notify-window">
      <div className="desktop-notify-panel">
        <div className="desktop-notify-panel__header">
          <div className="desktop-notify-panel__icon">
            <BellDot size={16} />
          </div>
          <div className="desktop-notify-panel__titles">
            <div className="desktop-notify-panel__title">{title}</div>
            <div className="desktop-notify-panel__subtitle">{subtitle}</div>
          </div>
        </div>
        <div className="desktop-notify-panel__body">
          {!!applyId ? (
            <div className="desktop-notify-panel__approval">
              <div className="desktop-notify-panel__project">{project}</div>
              {description && <div className="desktop-notify-panel__desc">{description}</div>}
            </div>
          ) : (
            <div className="desktop-notify-panel__content">{content}</div>
          )}
        </div>
        {!!applyId ? (
          <div className="desktop-notify-panel__actions">
            <button
              className="notify-btn notify-btn--reject"
              disabled={acting}
              onClick={(e) => { e.stopPropagation(); doAction(0, '驳回'); }}
            >
              驳回
            </button>
            <button
              className="notify-btn notify-btn--execute"
              disabled={acting}
              onClick={(e) => { e.stopPropagation(); doAction(1, '执行'); }}
            >
              {acting ? '处理中...' : '执行'}
            </button>
          </div>
        ) : (
          <div className="desktop-notify-panel__footer">
            <span className="desktop-notify-panel__hint">点击查看</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DesktopNotifyWindow;
