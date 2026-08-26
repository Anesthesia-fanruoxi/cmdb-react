import { useEffect, useRef, useState } from 'react';
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
  // 内联二次确认：0=驳回 1=执行，null=未待确认
  const [confirmType, setConfirmType] = useState<number | null>(null);
  const destroyTimer = useRef<number | null>(null);
  const confirmTimer = useRef<number | null>(null);
  const interactingRef = useRef(false);

  const cancelDestroy = () => {
    if (destroyTimer.current) {
      window.clearTimeout(destroyTimer.current);
      destroyTimer.current = null;
    }
  };

  const scheduleDestroy = (ms: number) => {
    cancelDestroy();
    destroyTimer.current = window.setTimeout(() => {
      try { getCurrentWebviewWindow().destroy(); } catch {}
    }, ms);
  };

  useEffect(() => {
    const win = getCurrentWebviewWindow();
    ['documentElement', 'body'].forEach(tag => {
      const el = document[tag as keyof Document] as HTMLElement | null;
      el?.style.setProperty('background', 'transparent', 'important');
    });
    document.getElementById('root')?.style.setProperty('background', 'transparent', 'important');
    win.show();

    // 10 秒无交互自动销毁；悬停/操作期间会暂停
    scheduleDestroy(10000);
    return () => {
      cancelDestroy();
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    };
  }, []);

  const doAction = async (processType: number) => {
    if (!applyId || acting) return;
    // 操作期间暂停自动销毁，避免请求被窗口销毁打断
    cancelDestroy();
    interactingRef.current = true;
    setActing(true);
    try {
      const res = await updateApply({ id: applyId, process_type: processType });
      if (res.code === 200) {
        try { getCurrentWebviewWindow().destroy(); } catch {}
        return;
      }
      console.error('[Notify] 操作失败:', res.message);
    } catch (e) {
      console.error('[Notify] 操作失败:', e);
    } finally {
      setActing(false);
      interactingRef.current = false;
      scheduleDestroy(5000);
    }
  };

  /** 第一次点击进待确认（3 秒内再点一次才执行），第二次点击执行 */
  const handleClick = (processType: number) => {
    if (acting) return;
    if (confirmType === processType) {
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
      setConfirmType(null);
      void doAction(processType);
      return;
    }
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    setConfirmType(processType);
    confirmTimer.current = window.setTimeout(() => setConfirmType(null), 3000);
  };

  return (
    <div className="desktop-notify-window">
      <div
        className="desktop-notify-panel"
        onMouseEnter={cancelDestroy}
        onMouseLeave={() => { if (!interactingRef.current) scheduleDestroy(5000); }}
      >
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
              className={`notify-btn notify-btn--reject${confirmType === 0 ? ' notify-btn--arm' : ''}`}
              disabled={acting}
              onClick={(e) => { e.stopPropagation(); handleClick(0); }}
            >
              {confirmType === 0 ? '确认驳回?' : '驳回'}
            </button>
            <button
              className={`notify-btn notify-btn--execute${confirmType === 1 ? ' notify-btn--arm' : ''}`}
              disabled={acting}
              onClick={(e) => { e.stopPropagation(); handleClick(1); }}
            >
              {acting ? '处理中...' : confirmType === 1 ? '确认执行?' : '执行'}
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
