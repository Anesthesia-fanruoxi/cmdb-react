/**
 * SVG 折线图工具（自 index.html 移植）
 */

export interface LineDef<T> {
  key?: string;
  color: string;
  get?: (p: T) => number;
}

export interface DrawLineOpts {
  emptyText?: string;
  maxY?: number;
  minY?: number;
  fmtY?: (v: number) => string;
}

function lineValue<T>(ln: LineDef<T>, p: T): number {
  if (typeof ln.get === 'function') return ln.get(p) || 0;
  if (ln.key) {
    const rec = p as unknown as Record<string, unknown>;
    return Number(rec[ln.key] || 0);
  }
  return 0;
}

/** 通用折线（补全详情弹框多图） */
export function drawLineChartHtml<T>(
  w: number,
  h: number,
  series: T[] | undefined,
  lines: LineDef<T>[],
  opts?: DrawLineOpts,
): string {
  const emptyText = opts?.emptyText || '暂无数据';
  if (!series || !series.length) {
    return `<text x="${w / 2}" y="${h / 2}" text-anchor="middle" style="fill:var(--muted)" font-size="12">${emptyText}</text>`;
  }

  const pad = { l: 36, r: 12, t: 12, b: 22 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const n = series.length;
  const xAt = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));

  let maxY = opts?.maxY != null ? opts.maxY : 1;
  if (opts?.maxY == null) {
    for (const ln of lines) {
      for (const p of series) {
        const v = lineValue(ln, p);
        if (v > maxY) maxY = v;
      }
    }
    if (maxY < 1) maxY = 1;
  }

  const yMin = opts?.minY || 0;
  const yRange = maxY - yMin || 1;
  const yAt = (v: number) => pad.t + ih - ((v - yMin) / yRange) * ih;
  const fmtY = opts?.fmtY || ((v: number) => String(Math.round(v)));

  const poly = (ln: LineDef<T>) => {
    const pts = series.map((p, i) => `${xAt(i)},${yAt(lineValue(ln, p))}`).join(' ');
    return `<polyline fill="none" stroke="${ln.color}" stroke-width="2" points="${pts}"/>`;
  };

  let grid = '';
  for (let g = 0; g <= 3; g++) {
    const yy = pad.t + (ih * g) / 3;
    const val = yMin + (yRange * (3 - g)) / 3;
    grid += `<line x1="${pad.l}" y1="${yy}" x2="${w - pad.r}" y2="${yy}" style="stroke:var(--border)" stroke-width="1"/>`;
    grid += `<text x="${pad.l - 4}" y="${yy + 3}" text-anchor="end" style="fill:var(--muted)" font-size="10">${fmtY(val)}</text>`;
  }

  return grid + lines.map(poly).join('');
}

export function niceMax(v: number): number {
  if (v <= 4) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const d = v / pow;
  const nd = d <= 1 ? 1 : d <= 2 ? 2 : d <= 5 ? 5 : 10;
  return nd * pow;
}

export function fmtTime(iso: string | undefined): string {
  const s = String(iso || '');
  const m = s.match(/(\d{2}:\d{2}:\d{2})/);
  return m ? m[1] : s;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function fmtElapsed(ms: number): string {
  ms = Math.max(0, ms || 0);
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}时${pad2(m)}分${pad2(s)}秒`;
  if (m > 0) return `${m}分${pad2(s)}秒`;
  return `${s}秒`;
}

export function fmtUptime(sec: number): string {
  sec = Math.floor(sec || 0);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return d > 0 ? `${d}天 ${p(h)}:${p(m)}:${p(s)}` : `${p(h)}:${p(m)}:${p(s)}`;
}

export function fmtMB(mb: number | undefined): string {
  return (mb != null ? mb : 0).toFixed(1) + ' MB';
}
