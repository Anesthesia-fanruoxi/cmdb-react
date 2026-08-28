import type { SyncProject } from '@/services/sql/sync';
import type { ConnState } from '../hooks/useSyncMonitor';

interface HeaderBarProps {
  projectList: SyncProject[];
  projectLoading: boolean;
  currentProject: string;
  onProjectChange: (project: string) => void;
  connState: ConnState;
  onReconnect: () => void;
}

function badgeText(connState: ConnState, hasProject: boolean): { text: string; cls: string } {
  if (!hasProject) return { text: '请选择项目', cls: '' };
  if (connState === 'open') return { text: '● SSE 已连接', cls: 'ok' };
  if (connState === 'connecting') return { text: 'SSE 重连中…', cls: '' };
  if (connState === 'closed') return { text: '● SSE 断开', cls: 'err' };
  return { text: 'SSE 连接中...', cls: '' };
}

export default function HeaderBar({
  projectList,
  projectLoading,
  currentProject,
  onProjectChange,
  connState,
  onReconnect,
}: HeaderBarProps) {
  const badge = badgeText(connState, !!currentProject);

  return (
    <header className="sync-header">
      <div className="brand">
        <div className="logo">es</div>
        <h1>es-adb 同步监控</h1>
      </div>
      <div className="head-right">
        <select
          className="project-select"
          value={currentProject}
          disabled={projectLoading}
          onChange={(e) => onProjectChange(e.target.value)}
        >
          {projectList.length === 0 && (
            <option value={currentProject || 'ysh'}>{currentProject || 'ysh'}</option>
          )}
          {projectList.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {connState === 'closed' && (
          <button
            type="button"
            className="reconnect-btn"
            onClick={onReconnect}
            title="手动重连 SSE"
          >
            ⟳ 重连
          </button>
        )}
        <span className={`conn-badge ${badge.cls}`}>{badge.text}</span>
      </div>
    </header>
  );
}
