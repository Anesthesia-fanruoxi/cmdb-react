import { useEffect, useMemo, useState } from 'react';
import {
  drilldownWindowsToBackfill,
  expandDrilldownToLeafWindows,
  isSyncOk,
  triggerSqlSyncBackfillWindows,
  type SyncDrilldownWindow,
} from '@/services/sql/sync';
import { toast } from '@/components/AppNotification';
import { confirm } from '@/components/ConfirmModal';
import { hasAbnormalLeafUnder, type AnalyzePhase } from '../hooks/useAnalyzeDrilldown';

const LEVEL_LABEL: Record<number, string> = {
  1: '日',
  2: '小时',
  3: '5分钟',
  4: '10秒',
};

const MAX_WINDOWS = 4000;
const COL_TITLES = ['异常日', '异常小时', '异常 5 分钟', '异常 10 秒'] as const;

export interface AnalyzeModalProps {
  open: boolean;
  project: string;
  analysisId: string | null;
  phase: AnalyzePhase;
  percent: number;
  hint: string;
  rangeText: string;
  windows: SyncDrilldownWindow[];
  abnormal: number;
  selDay: SyncDrilldownWindow | null;
  selHour: SyncDrilldownWindow | null;
  selFive: SyncDrilldownWindow | null;
  selTen: SyncDrilldownWindow | null;
  onSelectDay: (w: SyncDrilldownWindow) => void;
  onSelectHour: (w: SyncDrilldownWindow) => void;
  onSelectFive: (w: SyncDrilldownWindow) => void;
  onSelectTen: (w: SyncDrilldownWindow) => void;
  onRetry: () => void;
  canWrite: boolean;
  backfillBusy: boolean;
  onFullResync: () => void;
  onClose: () => void;
  onLog?: (msg: string, err?: boolean) => void;
}

function winKey(w: SyncDrilldownWindow) {
  return `${w.s}-${w.e}-${w.level ?? 0}`;
}

function contains(parent: SyncDrilldownWindow, child: SyncDrilldownWindow) {
  return child.s >= parent.s && child.e <= parent.e;
}

function formatDiff(diff: number | undefined) {
  if (diff == null) return '-';
  return diff > 0 ? `+${diff}` : String(diff);
}

function formatWinLabel(w: SyncDrilldownWindow) {
  if (w.start && w.end) return `${w.start} ~ ${w.end}`;
  return `${w.s} ~ ${w.e}`;
}

/** 详情弹框：进度阶段 / 四级下钻；SSE 状态由外部 hook 持有 */
export default function AnalyzeModal({
  open,
  project,
  analysisId,
  phase,
  percent,
  hint,
  rangeText,
  windows,
  abnormal,
  selDay,
  selHour,
  selFive,
  selTen,
  onSelectDay,
  onSelectHour,
  onSelectFive,
  onSelectTen,
  onRetry,
  canWrite,
  backfillBusy,
  onFullResync,
  onClose,
  onLog,
}: AnalyzeModalProps) {
  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set());
  const [bfKey, setBfKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // 新一轮分析结果清空已补标记
  useEffect(() => {
    setDoneKeys(new Set());
    setBfKey(null);
  }, [windows]);

  const byLevel = useMemo(() => {
    const map: Record<number, SyncDrilldownWindow[]> = { 1: [], 2: [], 3: [], 4: [] };
    for (const w of windows) {
      const lv = w.level || 1;
      if (lv >= 1 && lv <= 4) map[lv].push(w);
    }
    for (const lv of [1, 2, 3, 4]) {
      map[lv].sort((a, b) => a.s - b.s);
    }
    return map;
  }, [windows]);

  // 仅展示仍含末级（10 秒）异常的父节点；无则父节点消失
  const days = useMemo(
    () => byLevel[1].filter((d) => hasAbnormalLeafUnder(d, windows)),
    [byLevel, windows],
  );
  const hours = useMemo(
    () =>
      selDay
        ? byLevel[2].filter(
            (w) => contains(selDay, w) && hasAbnormalLeafUnder(w, windows),
          )
        : [],
    [byLevel, selDay, windows],
  );
  const fives = useMemo(
    () =>
      selHour
        ? byLevel[3].filter(
            (w) => contains(selHour, w) && hasAbnormalLeafUnder(w, windows),
          )
        : [],
    [byLevel, selHour, windows],
  );
  const tens = useMemo(
    () => (selFive ? byLevel[4].filter((w) => contains(selFive, w)) : []),
    [byLevel, selFive],
  );

  const leafWindows = byLevel[4];
  const pendingCount = leafWindows.filter((w) => !doneKeys.has(winKey(w))).length;

  const backfillOne = async (w: SyncDrilldownWindow) => {
    if (!canWrite) {
      toast.warning('无写权限（sql:sync:w）');
      return;
    }
    if (backfillBusy || bfKey) {
      toast.warning('补全进行中，请稍候');
      return;
    }
    if (!analysisId) {
      toast.warning('缺少 analysisId，无法更新分析缓存；请重新分析后再补全');
      return;
    }
    const leaves = expandDrilldownToLeafWindows(windows, w);
    const payload = drilldownWindowsToBackfill(leaves);
    if (!payload.length) {
      toast.warning('窗口时间无效');
      return;
    }
    if (payload.length > MAX_WINDOWS) {
      toast.warning(`单次最多 ${MAX_WINDOWS} 个窗口，当前 ${payload.length}`);
      return;
    }
    const lv = w.level || 1;
    const scope =
      lv >= 4
        ? '该 10 秒窗'
        : `该${LEVEL_LABEL[lv] || ''}范围内全部末级异常窗（${payload.length} 个）`;
    const ok = await confirm({
      title: '确认补全',
      content: `将对${scope}发起窗口补全。\n${formatWinLabel(w)}`,
      okText: '开始补全',
      cancelText: '取消',
      type: 'warning',
    });
    if (!ok) return;

    const k = winKey(w);
    setBfKey(k);
    onLog?.(
      `[窗口补全] analysisId=${analysisId} L${lv} → 末级 ${payload.length} 窗`,
    );
    try {
      const resp = await triggerSqlSyncBackfillWindows(project, payload, analysisId);
      if (!isSyncOk(resp.code)) {
        toast.error(`补全失败: ${resp.message}`);
        onLog?.(`[窗口补全] 失败: ${resp.message}`, true);
        return;
      }
      setDoneKeys((prev) => {
        const next = new Set(prev);
        next.add(k);
        for (const leaf of leaves) next.add(winKey(leaf));
        return next;
      });
      const s = resp.data?.summary;
      toast.success(
        `补全完成 · ${resp.data?.windows ?? payload.length} 窗 · 写入 ${s?.totalWritten ?? '-'} · 失败 ${s?.failed ?? 0}`,
      );
      onLog?.(
        `[窗口补全] 完成 windows=${payload.length} hits=${s?.totalHits} written=${s?.totalWritten} failed=${s?.failed}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`补全请求失败: ${msg}`);
      onLog?.('[窗口补全] 请求失败', true);
    } finally {
      setBfKey(null);
    }
  };

  const handleFullResync = () => {
    if (!canWrite) {
      toast.warning('无写权限（sql:sync:w）');
      return;
    }
    if (backfillBusy || bfKey) {
      toast.warning('补全进行中，请稍候');
      return;
    }
    onClose();
    onFullResync();
  };

  if (!open) return null;

  const showProgress = phase !== 'done';

  const columns: {
    title: string;
    items: SyncDrilldownWindow[];
    selected: SyncDrilldownWindow | null;
    onSelect: (w: SyncDrilldownWindow) => void;
    empty: string;
    enabled: boolean;
  }[] = [
    {
      title: COL_TITLES[0],
      items: days,
      selected: selDay,
      onSelect: onSelectDay,
      empty: days.length ? '请选择异常日' : '无异常日',
      enabled: true,
    },
    {
      title: COL_TITLES[1],
      items: hours,
      selected: selHour,
      onSelect: onSelectHour,
      empty: !selDay ? '请先选择异常日' : hours.length ? '请选择异常小时' : '该日无异常小时',
      enabled: !!selDay,
    },
    {
      title: COL_TITLES[2],
      items: fives,
      selected: selFive,
      onSelect: onSelectFive,
      empty: !selHour
        ? '请先选择异常小时'
        : fives.length
          ? '请选择异常 5 分钟'
          : '该时段无异常 5 分钟',
      enabled: !!selHour,
    },
    {
      title: COL_TITLES[3],
      items: tens,
      selected: selTen,
      onSelect: onSelectTen,
      empty: !selFive
        ? '请先选择异常 5 分钟'
        : tens.length
          ? '请选择异常 10 秒'
          : '该时段无异常 10 秒窗',
      enabled: !!selFive,
    },
  ];

  return (
    <div
      className="sql-sync-modal-mask open"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== 'running') onClose();
      }}
    >
      <div className="modal analyze-modal">
        <div className="modal-head">
          <h3>
            异常分析
            {phase === 'running' || phase === 'idle' ? (
              <span className="modal-badge on">
                {phase === 'idle' ? '空闲' : '分析中'}
              </span>
            ) : phase === 'done' ? (
              <span className="modal-badge">已完成</span>
            ) : (
              <span className="modal-badge warn">失败</span>
            )}
          </h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        {phase === 'done' && (
          <div className="analyze-summary">
            <div className="analyze-summary-stats">
              <span>
                总数 <b>{abnormal}</b>
              </span>
              <span>
                节点 <b>{windows.length}</b>
              </span>
              <span>
                待补 <b>{pendingCount}</b>
              </span>
              {rangeText ? <span className="analyze-summary-range">{rangeText}</span> : null}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canWrite || backfillBusy || !!bfKey}
              title={canWrite ? '按对比范围整体重同步' : '需要 sql:sync:w'}
              onClick={handleFullResync}
            >
              整体重同步
            </button>
          </div>
        )}

        <div className="modal-body analyze-modal-body">
          {showProgress ? (
            <div className="analyze-progress-stage">
              <div className="analyze-progress-title">
                {phase === 'error' ? '分析中断' : phase === 'idle' ? '尚未开始' : '四级下钻分析'}
              </div>
              <p className="analyze-progress-hint">{hint}</p>
              <div className="analyze-progress-bar bar bar-lg">
                <span className="bar-fill" style={{ width: `${percent.toFixed(1)}%` }} />
              </div>
              <div className="analyze-progress-meta">
                <span>{percent.toFixed(1)}%</span>
                <span>日 → 小时 → 5 分 → 10 秒</span>
              </div>
              {rangeText ? <p className="analyze-progress-range">{rangeText}</p> : null}
              {(phase === 'error' || phase === 'idle') && (
                <div className="analyze-progress-actions">
                  {phase === 'error' && (
                    <button type="button" className="btn btn-secondary" onClick={onRetry}>
                      重试
                    </button>
                  )}
                  <button type="button" className="btn btn-secondary" onClick={onClose}>
                    关闭
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="analyze-cols">
              {columns.map((col) => (
                <div key={col.title} className="analyze-col">
                  <div className="analyze-col-head">
                    <span>{col.title}</span>
                    <span className="analyze-col-count">
                      {col.enabled ? col.items.length : '—'}
                    </span>
                  </div>
                  <div className="analyze-col-body">
                    {!col.enabled || col.items.length === 0 ? (
                      <div className="analyze-col-empty">{col.empty}</div>
                    ) : (
                      col.items.map((w) => {
                        const k = winKey(w);
                        const selected =
                          col.selected != null && winKey(col.selected) === k;
                        const filled = doneKeys.has(k);
                        const loading = bfKey === k;
                        return (
                          <div
                            key={k}
                            className={`analyze-row${selected ? ' is-selected' : ''}${filled ? ' is-done' : ''}`}
                            onClick={() => col.onSelect(w)}
                          >
                            <div className="analyze-row-main">
                              <div className="analyze-row-line" title={formatWinLabel(w)}>
                                <span className="analyze-row-time">{w.start || w.s}</span>
                                <span className="analyze-row-diff">{formatDiff(w.diff)}</span>
                                {filled ? <span className="analyze-row-tag">已补</span> : null}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="analyze-row-bf"
                              disabled={!canWrite || backfillBusy || !!bfKey || filled}
                              title={
                                canWrite
                                  ? filled
                                    ? '已补全'
                                    : '补全该窗口'
                                  : '需要 sql:sync:w'
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                void backfillOne(w);
                              }}
                            >
                              {loading ? '…' : filled ? '✓' : '补全'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
