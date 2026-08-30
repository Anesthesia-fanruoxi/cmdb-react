/**
 * 异常分析：进度 SSE → ready(analysisId) → 详情 SSE（snapshot/update）
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  calcDrilldownPercent,
  openSqlSyncAnalyzeDetailSSE,
  openSqlSyncAnalyzeProgressSSE,
  type SyncAnalyzeDetailPayload,
  type SyncAnalyzeReady,
  type SyncDrilldownProgress,
  type SyncDrilldownRange,
  type SyncDrilldownWindow,
  type SyncSseConnection,
} from '@/services/sql/sync';
import { toast } from '@/components/AppNotification';

const LEVEL_LABEL: Record<number, string> = {
  1: '日',
  2: '小时',
  3: '5分钟',
  4: '10秒',
};

export type AnalyzePhase = 'idle' | 'running' | 'done' | 'error';

export interface AnalyzeProgressView {
  phase: AnalyzePhase;
  percent: number;
  hint: string;
  rangeText: string;
  abnormal: number;
  windowCount: number;
  analysisId?: string | null;
  level?: number;
  done?: number;
  total?: number;
}

function contains(parent: SyncDrilldownWindow, child: SyncDrilldownWindow) {
  return child.s >= parent.s && child.e <= parent.e;
}

function levelOf(w: SyncDrilldownWindow) {
  return w.level || 1;
}

function sortedLevel(all: SyncDrilldownWindow[], level: number) {
  return all.filter((w) => levelOf(w) === level).sort((a, b) => a.s - b.s);
}

function sameWin(a: SyncDrilldownWindow, b: SyncDrilldownWindow) {
  return a.s === b.s && a.e === b.e && levelOf(a) === levelOf(b);
}

/** 父窗下是否仍有末级（10 秒）异常；无则该父节点应从列表消失 */
export function hasAbnormalLeafUnder(
  parent: SyncDrilldownWindow,
  all: SyncDrilldownWindow[],
) {
  return sortedLevel(all, 4).some((w) => contains(parent, w));
}

export function cascadeFrom(
  all: SyncDrilldownWindow[],
  anchor: SyncDrilldownWindow,
): {
  day: SyncDrilldownWindow | null;
  hour: SyncDrilldownWindow | null;
  five: SyncDrilldownWindow | null;
  ten: SyncDrilldownWindow | null;
} {
  const lv = levelOf(anchor);
  let day: SyncDrilldownWindow | null = lv === 1 ? anchor : null;
  let hour: SyncDrilldownWindow | null = lv === 2 ? anchor : null;
  let five: SyncDrilldownWindow | null = lv === 3 ? anchor : null;
  let ten: SyncDrilldownWindow | null = lv === 4 ? anchor : null;

  // 锚点若已无末级子孙，整条链路清空（父节点应消失）
  if (day && !hasAbnormalLeafUnder(day, all)) {
    return { day: null, hour: null, five: null, ten: null };
  }
  if (hour && !hasAbnormalLeafUnder(hour, all)) {
    hour = null;
    five = null;
    ten = null;
  }
  if (five && !hasAbnormalLeafUnder(five, all)) {
    five = null;
    ten = null;
  }

  if (day && !hour) {
    hour =
      sortedLevel(all, 2).find(
        (w) => contains(day!, w) && hasAbnormalLeafUnder(w, all),
      ) ?? null;
  }
  if (hour && !five) {
    five =
      sortedLevel(all, 3).find(
        (w) => contains(hour!, w) && hasAbnormalLeafUnder(w, all),
      ) ?? null;
  }
  if (five && !ten) {
    ten = sortedLevel(all, 4).find((w) => contains(five!, w)) ?? null;
  }
  return { day, hour, five, ten };
}

/** 尽量保留原选中；已无末级子孙的父节点跳过 */
function resolveSelection(
  list: SyncDrilldownWindow[],
  prefer: {
    day: SyncDrilldownWindow | null;
    hour: SyncDrilldownWindow | null;
    five: SyncDrilldownWindow | null;
    ten: SyncDrilldownWindow | null;
  },
) {
  const days = sortedLevel(list, 1).filter((d) => hasAbnormalLeafUnder(d, list));
  const day =
    (prefer.day && days.find((d) => sameWin(d, prefer.day!))) || days[0] || null;
  if (!day) {
    return { day: null, hour: null, five: null, ten: null };
  }

  const hours = sortedLevel(list, 2).filter(
    (w) => contains(day, w) && hasAbnormalLeafUnder(w, list),
  );
  const hour =
    (prefer.hour && hours.find((w) => sameWin(w, prefer.hour!))) ||
    hours[0] ||
    null;
  if (!hour) {
    return { day, hour: null, five: null, ten: null };
  }

  const fives = sortedLevel(list, 3).filter(
    (w) => contains(hour, w) && hasAbnormalLeafUnder(w, list),
  );
  const five =
    (prefer.five && fives.find((w) => sameWin(w, prefer.five!))) ||
    fives[0] ||
    null;
  if (!five) {
    return { day, hour, five: null, ten: null };
  }

  const tens = sortedLevel(list, 4).filter((w) => contains(five, w));
  const ten =
    (prefer.ten && tens.find((w) => sameWin(w, prefer.ten!))) ||
    tens[0] ||
    null;
  return { day, hour, five, ten };
}

function applyWindowsSelection(
  list: SyncDrilldownWindow[],
  setters: {
    setSelDay: (w: SyncDrilldownWindow | null) => void;
    setSelHour: (w: SyncDrilldownWindow | null) => void;
    setSelFive: (w: SyncDrilldownWindow | null) => void;
    setSelTen: (w: SyncDrilldownWindow | null) => void;
  },
  prefer?: {
    day: SyncDrilldownWindow | null;
    hour: SyncDrilldownWindow | null;
    five: SyncDrilldownWindow | null;
    ten: SyncDrilldownWindow | null;
  },
) {
  const c = resolveSelection(
    list,
    prefer ?? { day: null, hour: null, five: null, ten: null },
  );
  setters.setSelDay(c.day);
  setters.setSelHour(c.hour);
  setters.setSelFive(c.five);
  setters.setSelTen(c.ten);
}

export function useAnalyzeDrilldown(
  project: string,
  onLog?: (msg: string, err?: boolean) => void,
) {
  const [phase, setPhase] = useState<AnalyzePhase>('idle');
  const [percent, setPercent] = useState(0);
  const [hint, setHint] = useState('等待分析');
  const [rangeText, setRangeText] = useState('');
  const [activeRange, setActiveRange] = useState<{ start: string; end: string } | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [windows, setWindows] = useState<SyncDrilldownWindow[]>([]);
  const [abnormal, setAbnormal] = useState(0);
  const [progressMeta, setProgressMeta] = useState<{
    level: number;
    done: number;
    total: number;
  } | null>(null);
  const [selDay, setSelDay] = useState<SyncDrilldownWindow | null>(null);
  const [selHour, setSelHour] = useState<SyncDrilldownWindow | null>(null);
  const [selFive, setSelFive] = useState<SyncDrilldownWindow | null>(null);
  const [selTen, setSelTen] = useState<SyncDrilldownWindow | null>(null);
  const selectionRef = useRef({
    day: null as SyncDrilldownWindow | null,
    hour: null as SyncDrilldownWindow | null,
    five: null as SyncDrilldownWindow | null,
    ten: null as SyncDrilldownWindow | null,
  });
  selectionRef.current = {
    day: selDay,
    hour: selHour,
    five: selFive,
    ten: selTen,
  };

  const progressEsRef = useRef<SyncSseConnection | null>(null);
  const detailEsRef = useRef<SyncSseConnection | null>(null);
  const progressFinishedRef = useRef(false);
  const sessionRef = useRef(0);
  const onLogRef = useRef(onLog);
  onLogRef.current = onLog;

  const stopProgressSse = useCallback(() => {
    progressEsRef.current?.close();
    progressEsRef.current = null;
  }, []);

  const stopDetailSse = useCallback(() => {
    detailEsRef.current?.close();
    detailEsRef.current = null;
  }, []);

  const stopAll = useCallback(() => {
    sessionRef.current += 1; // 作废进行中回调，避免旧连接 onClosed 误报失败
    stopProgressSse();
    stopDetailSse();
  }, [stopProgressSse, stopDetailSse]);

  const applyDetailPayload = useCallback((data: SyncAnalyzeDetailPayload, isFirst: boolean) => {
    const list = data.windows || [];
    setWindows(list);
    // 以详情 snapshot/update 的 abnormal 为准（补全后 update 会重算）；缺省再按 L4 数量回退
    setAbnormal(
      typeof data.abnormal === 'number'
        ? data.abnormal
        : list.filter((w) => (w.level || 1) === 4).length,
    );
    // 首次 / update：无末级子孙的父节点不参与选中；update 尽量保留原路径
    applyWindowsSelection(
      list,
      { setSelDay, setSelHour, setSelFive, setSelTen },
      isFirst || !list.length ? undefined : selectionRef.current,
    );
  }, []);

  const openDetailStream = useCallback(
    (id: string, session: number) => {
      stopDetailSse();
      if (session !== sessionRef.current) return;
      onLogRef.current?.(`[异常分析] 拉取详情 analysisId=${id}`);
      setHint('加载异常窗口…');

      let gotSnapshot = false;
      const conn = openSqlSyncAnalyzeDetailSSE(project, id, {
        onConnected: () => {
          if (session !== sessionRef.current) return;
          onLogRef.current?.('[异常分析] 详情 SSE connected');
        },
        onSnapshot: (data) => {
          if (session !== sessionRef.current) return;
          gotSnapshot = true;
          applyDetailPayload(data, true);
          setPhase('done');
          setPercent(100);
          setHint('分析完成');
          onLogRef.current?.(
            `[异常分析] snapshot abnormal=${data.abnormal ?? '-'} windows=${data.windows?.length ?? 0}`,
          );
        },
        onUpdate: (data) => {
          if (session !== sessionRef.current) return;
          applyDetailPayload(data, !gotSnapshot);
          gotSnapshot = true;
          setPhase('done');
          setPercent(100);
          setHint('列表已更新');
          onLogRef.current?.(
            `[异常分析] update abnormal=${data.abnormal ?? '-'} windows=${data.windows?.length ?? 0}`,
          );
        },
        onErrorEvent: (msg) => {
          if (session !== sessionRef.current) return;
          toast.error(`分析详情失败: ${msg}`);
          onLogRef.current?.(`[异常分析] 详情失败: ${msg}`, true);
          if (!gotSnapshot) {
            setHint(`详情失败: ${msg}`);
            setPhase('error');
          }
        },
        onClosed: () => {
          if (session !== sessionRef.current) return;
          if (!gotSnapshot) {
            setHint('详情连接断开');
            setPhase('error');
          }
        },
      });
      detailEsRef.current = conn;
    },
    [project, stopDetailSse, applyDetailPayload],
  );

  const reset = useCallback(() => {
    stopAll();
    progressFinishedRef.current = false;
    setPhase('idle');
    setPercent(0);
    setHint('等待分析');
    setRangeText('');
    setActiveRange(null);
    setAnalysisId(null);
    setWindows([]);
    setAbnormal(0);
    setProgressMeta(null);
    setSelDay(null);
    setSelHour(null);
    setSelFive(null);
    setSelTen(null);
  }, [stopAll]);

  const start = useCallback(
    (range: { start: string; end: string }) => {
      if (!project || !range.start || !range.end) {
        toast.warning('缺少对比实际范围，请先完成对比');
        return;
      }
      stopAll();
      const session = ++sessionRef.current;
      progressFinishedRef.current = false;
      setPhase('running');
      setActiveRange(range);
      setAnalysisId(null);
      setWindows([]);
      setAbnormal(0);
      setProgressMeta(null);
      setSelDay(null);
      setSelHour(null);
      setSelFive(null);
      setSelTen(null);
      setPercent(0);
      setHint('连接中…');
      setRangeText('');
      onLogRef.current?.(`[异常分析] 开始 ${range.start} ~ ${range.end}`);

      let lastPctLog = -1;
      let lastUiAt = 0;

      const conn = openSqlSyncAnalyzeProgressSSE(
        project,
        { start: range.start, end: range.end },
        {
          onOpen: () => {
            if (session !== sessionRef.current) return;
            setHint('连接中…');
          },
          onDebug: (msg) => {
            if (session !== sessionRef.current) return;
            onLogRef.current?.(`[异常分析] ${msg}`);
          },
          onConnected: (d) => {
            if (session !== sessionRef.current) return;
            setHint('SSE 连接成功，等待上游…');
            const msg =
              d && typeof d === 'object' && 'message' in d
                ? String((d as { message?: unknown }).message || '')
                : '';
            onLogRef.current?.(`[异常分析] connected ${msg || ''}`.trim());
          },
          onHub: () => {
            if (session !== sessionRef.current) return;
            setHint('等待上游分析…');
            onLogRef.current?.('[异常分析] hub 等待上游（正常）');
          },
          onRange: (r: SyncDrilldownRange) => {
            if (session !== sessionRef.current) return;
            if (r.start && r.end) {
              setRangeText(`[${r.start} ~ ${r.end})`);
              onLogRef.current?.(`[异常分析] range [${r.start} ~ ${r.end})`);
            }
            setHint('分析中…');
          },
          onProgress: (p: SyncDrilldownProgress) => {
            if (session !== sessionRef.current) return;
            const level = p.level || 1;
            const done = p.done || 0;
            const total = p.total || 0;
            const pct = calcDrilldownPercent(level, done, total);
            const now = Date.now();
            if (now - lastUiAt < 200 && pct < 99.5) return;
            lastUiAt = now;
            setPercent(Math.max(0, Math.min(100, pct)));
            setProgressMeta({ level, done, total });
            setHint(`L${level} ${LEVEL_LABEL[level] || ''} · ${done}/${total}`);
            const bucket = Math.floor(pct / 10);
            if (bucket !== lastPctLog) {
              lastPctLog = bucket;
              onLogRef.current?.(
                `[异常分析] progress ~${pct.toFixed(0)}% L${level} ${done}/${total}`,
              );
            }
          },
          onReady: (r: SyncAnalyzeReady) => {
            if (session !== sessionRef.current) return;
            progressFinishedRef.current = true;
            stopProgressSse();
            if (!r.analysisId) {
              setPhase('error');
              setHint('缺少 analysisId');
              toast.error('分析完成但缺少 analysisId');
              return;
            }
            setAnalysisId(r.analysisId);
            setAbnormal(r.abnormal ?? 0);
            setPercent(100);
            setHint('分析完成，加载详情…');
            onLogRef.current?.(
              `[异常分析] ready analysisId=${r.analysisId} abnormal=${r.abnormal ?? '-'}`,
            );
            openDetailStream(r.analysisId, session);
          },
          onErrorEvent: (msg) => {
            if (session !== sessionRef.current) return;
            if (progressFinishedRef.current) return;
            progressFinishedRef.current = true;
            toast.error(`异常分析失败: ${msg}`);
            onLogRef.current?.(`[异常分析] 失败: ${msg}`, true);
            setHint(`失败: ${msg}`);
            setPhase('error');
            stopProgressSse();
          },
          onClosed: () => {
            if (session !== sessionRef.current) return;
            if (progressFinishedRef.current) return;
            progressFinishedRef.current = true;
            const msg = '进度 SSE 连接断开';
            toast.error(msg);
            onLogRef.current?.(`[异常分析] ${msg}`, true);
            setHint(msg);
            setPhase('error');
          },
        },
      );
      progressEsRef.current = conn;
    },
    [project, stopAll, stopProgressSse, openDetailStream],
  );

  useEffect(() => () => stopAll(), [stopAll]);

  const selectDay = useCallback(
    (w: SyncDrilldownWindow) => {
      const c = cascadeFrom(windows, w);
      setSelDay(c.day);
      setSelHour(c.hour);
      setSelFive(c.five);
      setSelTen(c.ten);
    },
    [windows],
  );
  const selectHour = useCallback(
    (w: SyncDrilldownWindow) => {
      const c = cascadeFrom(windows, w);
      setSelHour(c.hour);
      setSelFive(c.five);
      setSelTen(c.ten);
    },
    [windows],
  );
  const selectFive = useCallback(
    (w: SyncDrilldownWindow) => {
      const c = cascadeFrom(windows, w);
      setSelFive(c.five);
      setSelTen(c.ten);
    },
    [windows],
  );

  const progress: AnalyzeProgressView = {
    phase,
    percent,
    hint,
    rangeText,
    abnormal,
    windowCount: windows.length,
    analysisId,
    level: progressMeta?.level,
    done: progressMeta?.done,
    total: progressMeta?.total,
  };

  return {
    progress,
    phase,
    percent,
    hint,
    rangeText,
    activeRange,
    analysisId,
    windows,
    abnormal,
    selDay,
    selHour,
    selFive,
    selTen,
    setSelTen,
    selectDay,
    selectHour,
    selectFive,
    start,
    stop: stopAll,
    reset,
    retry: () => {
      if (activeRange) start(activeRange);
    },
  };
}
