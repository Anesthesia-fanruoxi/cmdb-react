/**
 * SSE 监控状态指示灯（4 态呼吸灯）
 */
import type { DotState } from './useSSEMonitor';

interface Props {
  state: DotState;
  onClick: () => void;
}

const STATE_TEXT: Record<DotState, string> = {
  open: '已连接',
  connecting: '连接中',
  closed: '未连接',
  stale: '心跳超时',
};

export function StatusDot({ state, onClick }: Props) {
  return (
    <button
      type="button"
      className={`sse-monitor-dot sse-monitor-dot--${state}`}
      onClick={onClick}
      title={`SSE: ${STATE_TEXT[state]}（点击查看详情）`}
    >
      <span className="sse-monitor-dot__core" />
    </button>
  );
}
