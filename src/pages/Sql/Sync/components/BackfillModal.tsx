import { useEffect, useRef, useState } from 'react';
import {
  openSqlSyncBackfillSSE,
  type SyncBackfillDetail,
  type SyncQpsPoint,
  type SyncRuntimeSeriesPoint,
  type SyncSseConnection,
} from '@/services/sql/sync';
import { drawLineChartHtml, fmtElapsed } from '../utils/charts';

interface BackfillModalProps {
  open: boolean;
  project: string;
  onClose: () => void;
}

function LineChart({
  series,
  lines,
  emptyText,
  fmtY,
  redrawKey,
}: {
  series: Array<Record<string, number | undefined>> | undefined;
  lines: { key: string; color: string }[];
  emptyText: string;
  fmtY?: (v: number) => string;
  redrawKey: number;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const svg = svgRef.current;
    if (!stage || !svg) return;

    const draw = () => {
      const w = stage.clientWidth || 400;
      const h = stage.clientHeight || 80;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      svg.innerHTML = drawLineChartHtml(w, h, series, lines, { emptyText, fmtY });
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [series, lines, emptyText, fmtY, redrawKey]);

  return (
    <div className="modal-chart-stage" ref={stageRef}>
      <svg ref={svgRef} />
    </div>
  );
}

const QPS_LINES = [
  { key: 'writeQps', color: '#0e7c86' },
  { key: 'hitQps', color: '#34d399' },
  { key: 'windowQps', color: '#9aa6b2' },
];
const MEM_LINES = [
  { key: 'heapAllocMB', color: '#0e7c86' },
  { key: 'heapSysMB', color: '#94a3b8' },
];
const SYS_LINES = [{ key: 'sysMB', color: '#6366f1' }];
const GO_LINES = [{ key: 'numGoroutine', color: '#6366f1' }];
const GC_LINES = [{ key: 'numGC', color: '#f59e0b' }];

export default function BackfillModal({ open, project, onClose }: BackfillModalProps) {
  const [detail, setDetail] = useState<SyncBackfillDetail | null>(null);
  const [timerText, setTimerText] = useState('0秒');
  const [redrawKey, setRedrawKey] = useState(0);
  const esRef = useRef<SyncSseConnection | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chartsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !project) {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      setDetail(null);
      return;
    }

    const es = openSqlSyncBackfillSSE(project, (d) => setDetail(d));
    esRef.current = es;
    return () => {
      es.close();
      if (esRef.current === es) esRef.current = null;
    };
  }, [open, project]);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const ses = detail?.session;
    if (!ses?.startedAtMs) {
      setTimerText('0秒');
      return;
    }
    const active = !!detail?.backfillActive;
    const tick = () => {
      const end = active ? Date.now() : ses.finishedAtMs || Date.now();
      setTimerText(fmtElapsed(end - (ses.startedAtMs || 0)));
    };
    tick();
    if (active) timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [detail]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !chartsRef.current) return;
    const ro = new ResizeObserver(() => setRedrawKey((t) => t + 1));
    ro.observe(chartsRef.current);
    return () => ro.disconnect();
  }, [open]);

  if (!open) return null;

  const pt = detail?.progress || {};
  const ses = detail?.session || {};
  const pct = pt.percent || 0;
  const done = (pt.completed || 0) + (pt.failed || 0);

  let badgeText = '空闲';
  let badgeOn = false;
  if (detail?.backfillActive) {
    badgeText = '进行中';
    badgeOn = true;
  } else if (pt.totalWindows) {
    badgeText = '已结束';
  }

  const qps = detail?.qpsSeries as SyncQpsPoint[] | undefined;
  const rt = detail?.runtimeSeries as SyncRuntimeSeriesPoint[] | undefined;

  return (
    <div
      className="sql-sync-modal-mask open"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-head">
          <h3>
            补全详情{' '}
            <span className={`modal-badge ${badgeOn ? 'on' : ''}`}>{badgeText}</span>
          </h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="bf-modal-layout">
            <section className="bf-overview">
              <div className="bf-progress-head">
                <span className="bf-sec-label">本次进度</span>
                <span className="bf-progress-pct">{pct.toFixed(1)}%</span>
              </div>
              <div className="bar bar-lg">
                <i style={{ width: `${pct}%` }} />
              </div>
              <div className="bf-progress-grid">
                <div className="cell">
                  <div className="l">命中总数</div>
                  <div className="v">{(pt.totalHits || 0).toLocaleString()}</div>
                </div>
                <div className="cell">
                  <div className="l">写入总数</div>
                  <div className="v">{(pt.totalWritten || 0).toLocaleString()}</div>
                </div>
                <div className="cell">
                  <div className="l">窗口进度</div>
                  <div className="v">
                    {done}/{pt.totalWindows || 0}
                  </div>
                </div>
                <div className="cell">
                  <div className="l">成功窗口</div>
                  <div className="v">{pt.completed ?? '--'}</div>
                </div>
                <div className="cell">
                  <div className="l">失败窗口</div>
                  <div className="v">{pt.failed ?? '--'}</div>
                </div>
                <div className="cell">
                  <div className="l">计时</div>
                  <div className="v">{timerText}</div>
                </div>
                <div className="cell">
                  <div className="l">开始时间</div>
                  <div className="v">{ses.startedAtStr || '--'}</div>
                </div>
                <div className="cell">
                  <div className="l">结束时间</div>
                  <div className="v">
                    {detail?.backfillActive ? '进行中' : ses.finishedAtStr || '--'}
                  </div>
                </div>
              </div>
            </section>
            <div className="bf-subhead">
              实时监测
              <span className="bf-subhead-hint">补全吞吐 · 内存 · 协程 · GC（持续采样）</span>
            </div>
            <section className="bf-charts" ref={chartsRef}>
              <div className="bf-chart-qps modal-chart-cell">
                <h4>
                  补全吞吐 · 每秒 QPS
                  <span className="modal-chart-legend">
                    <i style={{ background: '#0e7c86' }} />
                    写入
                    <i style={{ background: '#34d399' }} />
                    命中
                    <i style={{ background: '#9aa6b2' }} />
                    窗口
                  </span>
                </h4>
                <LineChart
                  series={qps as Array<Record<string, number | undefined>> | undefined}
                  lines={QPS_LINES}
                  emptyText="暂无 QPS 数据"
                  redrawKey={redrawKey}
                />
              </div>
              <div className="modal-chart-cell">
                <h4>
                  服务 · 堆内存 MB
                  <span className="modal-chart-legend">
                    <i style={{ background: '#0e7c86' }} />
                    Alloc
                    <i style={{ background: '#94a3b8' }} />
                    HeapSys
                  </span>
                </h4>
                <LineChart
                  series={rt as Array<Record<string, number | undefined>> | undefined}
                  lines={MEM_LINES}
                  emptyText="暂无内存数据"
                  fmtY={(v) => v.toFixed(1)}
                  redrawKey={redrawKey}
                />
              </div>
              <div className="modal-chart-cell">
                <h4>服务 · 进程 Sys MB</h4>
                <LineChart
                  series={rt as Array<Record<string, number | undefined>> | undefined}
                  lines={SYS_LINES}
                  emptyText="暂无进程内存数据"
                  fmtY={(v) => v.toFixed(1)}
                  redrawKey={redrawKey}
                />
              </div>
              <div className="modal-chart-cell">
                <h4>服务 · Goroutine</h4>
                <LineChart
                  series={rt as Array<Record<string, number | undefined>> | undefined}
                  lines={GO_LINES}
                  emptyText="暂无 Goroutine 数据"
                  redrawKey={redrawKey}
                />
              </div>
              <div className="modal-chart-cell">
                <h4>服务 · GC 次数</h4>
                <LineChart
                  series={rt as Array<Record<string, number | undefined>> | undefined}
                  lines={GC_LINES}
                  emptyText="暂无 GC 数据"
                  redrawKey={redrawKey}
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
