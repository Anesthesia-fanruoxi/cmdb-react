import { useMemo, useRef, useState, type MouseEvent, useEffect, type ReactNode } from 'react';
import type { SyncIncrementalPoint } from '@/services/sql/sync';
import { niceMax } from '../utils/charts';

interface IncrChartProps {
  data: SyncIncrementalPoint[];
}

const ROWS = 360; // 10s/条 × 360 = 约 1 小时

export function IncrTable({ data }: { data: SyncIncrementalPoint[] }) {
  const rows = useMemo(() => data.slice(-ROWS).reverse(), [data]);

  return (
    <div className="card" style={{ flex: '1 1 54%', minHeight: 180 }}>
      <div className="card-head">
        <h2>最近增量</h2>
        <span className="tag">最新 360 条</span>
      </div>
      <div className="card-body table-wrap incr-recent-table" style={{ padding: '0 6px 8px' }}>
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>窗口</th>
              <th>查询</th>
              <th>写入</th>
              <th>耗时</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((pt, i) => (
              <tr key={`${pt.atStr}-${i}`}>
                <td>{pt.atStr || ''}</td>
                <td>{pt.window?.start || ''}</td>
                <td>{pt.hits}</td>
                <td>{pt.written}</td>
                <td>{pt.durationMs}ms</td>
                <td className={pt.success ? 'stat-ok' : 'stat-fail'}>
                  {pt.success ? 'ok' : 'fail'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface Pt {
  i: number;
  x: number;
  y: number;
}

/** Catmull-Rom → Bezier 平滑折线路径 */
function smoothLinePath(coords: Pt[]): string | null {
  if (coords.length === 0) return null;
  if (coords.length === 1) return `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  const n = coords.length;
  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = coords[Math.max(i - 1, 0)];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[Math.min(i + 2, n - 1)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export default function IncrChart({ data }: IncrChartProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const chart = useMemo(() => {
    const { w, h } = size;
    if (w < 40 || h < 40) return null;

    const pad = { l: 44, r: 14, t: 18, b: 24 };
    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;
    const bottom = pad.t + ih;

    if (!data.length) {
      return {
        empty: true as const,
        w,
        h,
        pad,
        bottom,
        hitsCoords: [] as Pt[],
        hitsLine: null as string | null,
        writtenLine: null as string | null,
        areaPath: null as string | null,
        yLabels: [] as { v: number; yy: number }[],
        xLabels: [] as { t: number; xx: number }[],
        dense: true,
      };
    }

    const times = data.map((p) => new Date(p.window?.start || p.atStr || '').getTime());
    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    const spanT = Math.max(tMax - tMin, 1000);
    const x = (t: number) => pad.l + ((t - tMin) / spanT) * iw;
    const maxV = niceMax(Math.max(...data.map((p) => p.hits || 0), 1));
    const y = (v: number) => bottom - (v / maxV) * ih;
    const maxW = Math.max(...data.map((p) => p.written || 0), 0);

    const gridN = 4;
    const yLabels = Array.from({ length: gridN + 1 }, (_, i) => {
      const v = (maxV * i) / gridN;
      return { v, yy: y(v) };
    });
    const xN = Math.min(6, Math.max(2, Math.round(iw / 130)));
    const xLabels = Array.from({ length: xN + 1 }, (_, i) => {
      const t = tMin + (spanT * i) / xN;
      return { t, xx: x(t) };
    });

    const hitsCoords = data.map((p, i) => ({ i, x: x(times[i]), y: y(p.hits || 0) }));
    const writtenCoords =
      maxW > 0 ? data.map((p, i) => ({ i, x: x(times[i]), y: y(p.written || 0) })) : [];
    const hitsLine = smoothLinePath(hitsCoords);
    const writtenLine = smoothLinePath(writtenCoords);
    const areaPath = hitsLine
      ? `${hitsLine} L ${(w - pad.r).toFixed(1)} ${bottom} L ${pad.l} ${bottom} Z`
      : null;

    const dense = data.length > 1 && (w - pad.l - pad.r) / data.length < 8;

    return {
      empty: false as const,
      w,
      h,
      pad,
      bottom,
      hitsCoords,
      hitsLine,
      writtenLine,
      areaPath,
      yLabels,
      xLabels,
      dense,
    };
  }, [data, size]);

  const onMove = (e: MouseEvent) => {
    if (!chart || chart.empty || chart.hitsCoords.length === 0) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    let best = 0;
    let bestD = Infinity;
    const pts = chart.hitsCoords;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.abs(pts[i].x - mx);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHover(best);
  };

  const hoverPt = hover != null && chart && !chart.empty ? chart.hitsCoords[hover] : null;
  const tipPt = hover != null && !chart?.empty ? data[hover] : null;

  let tipStyle: React.CSSProperties = { opacity: 0 };
  if (hoverPt && tipPt) {
    const half = 75;
    const tx = Math.min(Math.max(hoverPt.x, half + 4), (chart?.w ?? 0) - half - 4);
    const flipUp = hoverPt.y < 86; // 靠近顶部时翻转到点下方，避免顶部溢出成黑条
    const ty = flipUp ? hoverPt.y + 8 : hoverPt.y;
    tipStyle = {
      opacity: 1,
      left: tx,
      top: ty,
      transform: `translate(-50%, ${flipUp ? 8 : -104}%)`,
    };
  }

  const axisText = (children: ReactNode, attrs?: React.SVGProps<SVGTextElement>) => (
    <text className="axis-text" {...attrs}>
      {children}
    </text>
  );

  return (
    <div className="card" style={{ flex: '1 1 46%', minHeight: 240 }}>
      <div className="card-head">
        <h2>增量写入</h2>
        <span className="tag">最近 1 小时 · 内存仅保留 360 条</span>
      </div>
      <div className="incr-content">
        <div className="incr-legend">
          <span className="lg">
            <span className="sw" style={{ background: 'var(--accent)' }} />
            查询 / 窗
          </span>
          <span className="lg">
            <span className="sw" style={{ background: '#9aa6b2' }} />
            写入 / 窗
          </span>
          <span className="lg">移动鼠标查看明细</span>
        </div>
        <div className="chart-stage" ref={stageRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <div className="incr-tip" style={tipStyle}>
            {tipPt && (
              <>
                <div className="t-title">
                  {tipPt.window?.start
                    ? tipPt.window.start.slice(0, 10)
                    : (tipPt.atStr || '').slice(0, 10)}
                  {'　'}
                  {new Date(tipPt.window?.start || tipPt.atStr || '').toTimeString().slice(0, 8)}
                </div>
                <div className="t-row">
                  <span>查询</span>
                  <b>{tipPt.hits || 0}</b>
                </div>
                <div className="t-row">
                  <span>写入</span>
                  <b>{tipPt.written || 0}</b>
                </div>
                <div className="t-row">
                  <span>耗时</span>
                  <b>{tipPt.durationMs}ms</b>
                </div>
                <div className="t-row">
                  <span>状态</span>
                  <b className={tipPt.success ? 't-ok' : 't-fail'}>
                    {tipPt.success ? '成功' : '失败'}
                  </b>
                </div>
              </>
            )}
          </div>

          {chart && chart.empty && (
            <svg>
              <text
                x={chart.w / 2}
                y={chart.h / 2}
                textAnchor="middle"
                className="axis-text"
              >
                暂无数据，等待增量事件…
              </text>
            </svg>
          )}

          {chart && !chart.empty && chart.hitsLine && (
            <svg>
              {chart.yLabels.map((g) => (
                <g key={`y-${g.v}`}>
                  <line className="grid-line" x1={chart.pad.l} x2={chart.w - chart.pad.r} y1={g.yy} y2={g.yy} />
                  {axisText(String(Math.round(g.v)), { x: chart.pad.l - 6, y: g.yy + 3, textAnchor: 'end' })}
                </g>
              ))}
              {chart.xLabels.map((g) => (
                <g key={`x-${g.t}`}>
                  <line className="grid-line" x1={g.xx} y1={chart.pad.t} x2={g.xx} y2={chart.pad.t + (chart.bottom - chart.pad.t)} />
                  {axisText(new Date(g.t).toTimeString().slice(0, 5), {
                    x: g.xx,
                    y: chart.h - 7,
                    textAnchor: 'middle',
                  })}
                </g>
              ))}
              <line
                className="grid-line"
                x1={chart.pad.l}
                y1={chart.bottom}
                x2={chart.w - chart.pad.r}
                y2={chart.bottom}
              />

              <defs>
                <linearGradient id="incr-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {chart.areaPath && <path d={chart.areaPath} fill="url(#incr-area)" />}

              {chart.writtenLine && (
                <path d={chart.writtenLine} fill="none" stroke="#9aa6b2" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} strokeLinecap="round" />
              )}
              {chart.hitsLine && (
                <path d={chart.hitsLine} fill="none" stroke="var(--accent)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              )}

              {!chart.dense &&
                chart.hitsCoords.map((pt) => (
                  <circle key={`d-${pt.i}`} cx={pt.x} cy={pt.y} r={2.4} fill="var(--accent)" />
                ))}
              {hoverPt && (
                <circle cx={hoverPt.x} cy={hoverPt.y} r={4.2} fill="var(--accent)" stroke="#fff" strokeWidth={1.5} />
              )}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}