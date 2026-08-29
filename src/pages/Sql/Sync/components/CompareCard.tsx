import { useEffect, useMemo, useRef, useState } from 'react';
import {
  COMPARE_QUICK_RANGES,
  getCompareQuickRange,
  type CompareQuickRangeKey,
} from '../utils/compareRanges';
import {
  calcDrilldownPercent,
  drilldownWindowsToBackfill,
  isSyncOk,
  openSqlSyncCompareDrilldownSSE,
  triggerSqlSyncBackfillWindows,
  type SyncDrilldownProgress,
  type SyncDrilldownRange,
  type SyncDrilldownWindow,
  type SyncSseConnection,
} from '@/services/sql/sync';
import { toast } from '@/components/AppNotification';
import { confirm } from '@/components/ConfirmModal';

const LEVEL_LABEL: Record<number, string> = {
  1: '日',
  2: '小时',
  3: '5分钟',
  4: '10秒',
};

const MAX_WINDOWS = 4000;

interface CompareCardProps {
  project: string;
  cmpStart: string;
  cmpEnd: string;
  onCmpStartChange: (v: string) => void;
  onCmpEndChange: (v: string) => void;
  onCompare: () => void;
  onReset: () => void;
  loading: boolean;
  disabled: boolean;
  esCount: string;
  adbCount: string;
  diff: string;
  diffCls: string;
  rangeText: string;
  /** 最近一次对比实际范围（用于分析/全量补全） */
  actualRange: { start: string; end: string } | null;
  hasDiff: boolean;
  canWrite: boolean;
  backfillBusy: boolean;
  onFullBackfill: () => void;
  onLog?: (msg: string, err?: boolean) => void;
}

function winKey(w: SyncDrilldownWindow) {
  return `${w.s}-${w.e}-${w.level ?? 0}`;
}

export default function CompareCard({
  project,
  cmpStart,
  cmpEnd,
  onCmpStartChange,
  onCmpEndChange,
  onCompare,
  onReset,
  loading,
  disabled,
  esCount,
  adbCount,
  diff,
  diffCls,
  rangeText,
  actualRange,
  hasDiff,
  canWrite,
  backfillBusy,
  onFullBackfill,
  onLog,
}: CompareCardProps) {
  const [drillRunning, setDrillRunning] = useState(false);
  const [drillPercent, setDrillPercent] = useState(0);
  const [drillHint, setDrillHint] = useState('');
  const [drillRangeText, setDrillRangeText] = useState('');
  const [windows, setWindows] = useState<SyncDrilldownWindow[]>([]);
  const [abnormal, setAbnormal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [winBfLoading, setWinBfLoading] = useState(false);
  const [drillFinished, setDrillFinished] = useState(false);
  const [drillVisible, setDrillVisible] = useState(false);

  const esRef = useRef<SyncSseConnection | null>(null);
  const resultKey = `${actualRange?.start || ''}|${actualRange?.end || ''}|${diff}`;

  const fillQuick = (key: CompareQuickRangeKey) => {
    const { start, end } = getCompareQuickRange(key);
    onCmpStartChange(start);
    onCmpEndChange(end);
  };

  const clearDrill = () => {
    esRef.current?.close();
    esRef.current = null;
    setDrillRunning(false);
    setDrillPercent(0);
    setDrillHint('');
    setDrillRangeText('');
    setWindows([]);
    setAbnormal(0);
    setSelected(new Set());
    setDrillFinished(false);
    setDrillVisible(false);
  };

  useEffect(() => {
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);

  // 新对比结果出来时收起上次分析
  useEffect(() => {
    clearDrill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultKey]);

  const leafWindows = useMemo(() => {
    if (!windows.length) return [];
    const maxLv = Math.max(...windows.map((w) => w.level || 1));
    return windows.filter((w) => (w.level || 1) === maxLv);
  }, [windows]);

  const hasResult = !!actualRange?.start && esCount !== '-';
  const showActions = hasResult && hasDiff;

  const handleReset = () => {
    clearDrill();
    onReset();
  };

  const startAnalyze = () => {
    if (!project || drillRunning) return;
    if (!actualRange?.start || !actualRange?.end) {
      toast.warning('缺少对比实际范围，请先完成对比');
      return;
    }

    esRef.current?.close();
    setDrillVisible(true);
    setWindows([]);
    setSelected(new Set());
    setAbnormal(0);
    setDrillPercent(0);
    setDrillHint('连接中…');
    setDrillRangeText('');
    setDrillFinished(false);
    setDrillRunning(true);
    onLog?.(`[异常分析] 开始 ${actualRange.start} ~ ${actualRange.end}`);

    const conn = openSqlSyncCompareDrilldownSSE(
      project,
      { start: actualRange.start, end: actualRange.end },
      {
        onOpen: () => setDrillHint('已连接，分析中…'),
        onRange: (r: SyncDrilldownRange) => {
          setDrillRangeText(
            r.start && r.end
              ? `分析范围：[${r.start} ~ ${r.end})`
              : '',
          );
        },
        onProgress: (p: SyncDrilldownProgress) => {
          const level = p.level || 1;
          const done = p.done || 0;
          const total = p.total || 0;
          setDrillPercent(calcDrilldownPercent(level, done, total));
          setDrillHint(`L${level} ${LEVEL_LABEL[level] || ''} · ${done}/${total}`);
        },
        onDone: (d) => {
          const list = d.windows || [];
          setWindows(list);
          const maxLv = list.length ? Math.max(...list.map((w) => w.level || 1)) : 4;
          setAbnormal(
            d.abnormal ?? list.filter((w) => (w.level || 1) === maxLv).length,
          );
          setDrillPercent(100);
          setDrillHint('分析完成');
          setDrillFinished(true);
          setDrillRunning(false);
          setSelected(
            new Set(list.filter((w) => (w.level || 1) === maxLv).map(winKey)),
          );
          onLog?.(
            `[异常分析] 完成 abnormal=${d.abnormal ?? '-'} windows=${list.length}`,
          );
          esRef.current?.close();
          esRef.current = null;
        },
        onErrorEvent: (msg) => {
          toast.error(`异常分析失败: ${msg}`);
          onLog?.(`[异常分析] 失败: ${msg}`, true);
          setDrillHint(`失败: ${msg}`);
          setDrillRunning(false);
          esRef.current?.close();
          esRef.current = null;
        },
        onClosed: () => {
          setDrillRunning((prev) => {
            if (prev) setDrillHint((h) => (h.startsWith('失败') ? h : '连接已断开'));
            return false;
          });
        },
      },
    );
    esRef.current = conn;
  };

  const stopAnalyze = () => {
    esRef.current?.close();
    esRef.current = null;
    setDrillRunning(false);
    setDrillHint((h) => (h === '分析完成' ? h : '已停止'));
  };

  const toggleOne = (w: SyncDrilldownWindow) => {
    const k = winKey(w);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const runWindowBackfill = async () => {
    if (!canWrite) {
      toast.warning('无写权限（sql:sync:w）');
      return;
    }
    if (backfillBusy || winBfLoading) {
      toast.warning('补全进行中，请稍候');
      return;
    }
    const picked = windows.filter((w) => selected.has(winKey(w)));
    const payload = drilldownWindowsToBackfill(picked);
    if (!payload.length) {
      toast.warning('请先选择要补全的异常窗');
      return;
    }
    if (payload.length > MAX_WINDOWS) {
      toast.warning(`单次最多 ${MAX_WINDOWS} 个窗口，当前 ${payload.length}`);
      return;
    }
    const ok = await confirm({
      title: '确认窗口补全',
      content: `将对 ${payload.length} 个异常窗发起窗口补全。是否继续？`,
      okText: '开始补全',
      cancelText: '取消',
      type: 'warning',
    });
    if (!ok) return;

    setWinBfLoading(true);
    onLog?.(`[窗口补全] 开始 windows=${payload.length}`);
    try {
      const resp = await triggerSqlSyncBackfillWindows(project, payload);
      if (!isSyncOk(resp.code)) {
        toast.error(`窗口补全失败: ${resp.message}`);
        onLog?.(`[窗口补全] 失败: ${resp.message}`, true);
        return;
      }
      const s = resp.data?.summary;
      toast.success(
        `窗口补全完成 · ${resp.data?.windows ?? payload.length} 窗 · 写入 ${s?.totalWritten ?? '-'} · 失败 ${s?.failed ?? 0}`,
      );
      onLog?.(
        `[窗口补全] 完成 hits=${s?.totalHits} written=${s?.totalWritten} failed=${s?.failed}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`窗口补全请求失败: ${msg}`);
      onLog?.('[窗口补全] 请求失败', true);
    } finally {
      setWinBfLoading(false);
    }
  };

  return (
    <div className="card compare-card">
      <div className="card-head compare-card-head">
        <div className="compare-card-head-left">
          <h2>对比查询</h2>
          <button
            type="button"
            className="compare-quick-btn compare-quick-reset"
            disabled={disabled}
            onClick={handleReset}
          >
            重置
          </button>
        </div>
        <div className="compare-quick">
          {COMPARE_QUICK_RANGES.map((item) => (
            <button
              key={item.key}
              type="button"
              className="compare-quick-btn"
              disabled={disabled || drillRunning}
              onClick={() => fillQuick(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="card-body">
        <div className="form-row">
          <label>
            开始
            <input
              type="text"
              value={cmpStart}
              onChange={(e) => onCmpStartChange(e.target.value)}
              placeholder="可选"
              disabled={disabled || drillRunning}
            />
          </label>
          <label>
            结束
            <input
              type="text"
              value={cmpEnd}
              onChange={(e) => onCmpEndChange(e.target.value)}
              placeholder="可选"
              disabled={disabled || drillRunning}
            />
          </label>
          <button
            className="btn btn-secondary"
            onClick={onCompare}
            disabled={disabled || loading || drillRunning}
          >
            对比
          </button>
        </div>
        <p className="hint">
          开始、结束均不填时，默认查询上一个整点小时；填写时两者都要填，且不超过一个月。有差异时可做异常分析或全量补全。
        </p>
        <div className="compare-grid">
          <div>
            <div className="num">{esCount}</div>
            <div className="lbl">ES</div>
          </div>
          <div>
            <div className="num">{adbCount}</div>
            <div className="lbl">ADB</div>
          </div>
          <div>
            <div className={`num ${diffCls}`}>{diff}</div>
            <div className="lbl">差异</div>
          </div>
        </div>
        <p style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: 8 }}>{rangeText}</p>

        {showActions && (
          <div className="compare-actions">
            {drillRunning ? (
              <button type="button" className="btn btn-secondary" onClick={stopAnalyze}>
                停止分析
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={startAnalyze}
                disabled={disabled}
              >
                异常分析
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={onFullBackfill}
              disabled={disabled || !canWrite || backfillBusy || drillRunning}
              title={canWrite ? '按对比范围全量补全' : '需要 sql:sync:w'}
            >
              全量补全
            </button>
          </div>
        )}

        {drillVisible && (
          <div className="compare-drill">
            <div className="drill-progress">
              <div className="drill-progress-bar">
                <span
                  className="bar-fill"
                  style={{ width: `${Math.min(100, drillPercent).toFixed(1)}%` }}
                />
              </div>
              <div className="drill-progress-meta">
                <span>{drillPercent.toFixed(1)}%</span>
                <span>{drillHint || '—'}</span>
              </div>
            </div>
            {drillRangeText ? <p className="drill-range">{drillRangeText}</p> : null}

            {drillFinished && (
              <>
                <div className="drill-toolbar">
                  <span className="drill-abnormal">
                    末级异常 {abnormal || leafWindows.length} · 已选 {selected.size}
                  </span>
                  <div className="drill-toolbar-btns">
                    <button
                      type="button"
                      className="compare-quick-btn"
                      onClick={() => setSelected(new Set(leafWindows.map(winKey)))}
                      disabled={!leafWindows.length}
                    >
                      全选末级
                    </button>
                    <button
                      type="button"
                      className="compare-quick-btn"
                      onClick={() => setSelected(new Set())}
                      disabled={!selected.size}
                    >
                      清空
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!canWrite || !selected.size || winBfLoading || backfillBusy}
                      onClick={runWindowBackfill}
                      title={canWrite ? '窗口补全' : '需要 sql:sync:w'}
                    >
                      {winBfLoading ? '补全中…' : '补全选中异常窗'}
                    </button>
                  </div>
                </div>
                <div className="drill-table-wrap">
                  <table className="drill-table">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }} />
                        <th style={{ width: 56 }}>层级</th>
                        <th>开始</th>
                        <th>结束</th>
                        <th style={{ width: 64 }}>差异</th>
                      </tr>
                    </thead>
                    <tbody>
                      {windows.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', color: 'var(--faint)' }}>
                            无异常窗口
                          </td>
                        </tr>
                      ) : (
                        windows.map((w) => {
                          const k = winKey(w);
                          const lv = w.level || 1;
                          return (
                            <tr key={k} className={selected.has(k) ? 'is-selected' : ''}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={selected.has(k)}
                                  onChange={() => toggleOne(w)}
                                />
                              </td>
                              <td>
                                L{lv} {LEVEL_LABEL[lv] || ''}
                              </td>
                              <td title={w.start || String(w.s)}>{w.start || w.s}</td>
                              <td title={w.end || String(w.e)}>{w.end || w.e}</td>
                              <td className={w.diff ? 'stat-fail' : 'stat-ok'}>
                                {w.diff != null ? (w.diff > 0 ? `+${w.diff}` : w.diff) : '-'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
