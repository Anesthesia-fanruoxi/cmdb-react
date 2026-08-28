import type { SyncBackfillProgress, SyncPipeline } from '@/services/sql/sync';

interface KpiBarProps {
  pipeline: SyncPipeline | null;
  backfillProgress: SyncBackfillProgress | null;
}

export default function KpiBar({ pipeline, backfillProgress }: KpiBarProps) {
  const p = pipeline;
  const bp = backfillProgress || p?.backfillProgress;
  const tw = p?.targetWindow;

  const incrRunning = !!p?.incrementalRunning;
  const bfActive = !!p?.backfillActive;

  let kpiBf = '空闲';
  let kpiBfSub = '--';
  if (bp?.totalWindows) {
    const done = (bp.completed || 0) + (bp.failed || 0);
    kpiBf = `${(bp.percent || 0).toFixed(0)}%`;
    kpiBfSub = `${done}/${bp.totalWindows || 0} 窗口`;
  } else if (bfActive && bp) {
    const done = (bp.completed || 0) + (bp.failed || 0);
    kpiBf = `${(bp.percent || 0).toFixed(0)}%`;
    kpiBfSub = `${done}/${bp.totalWindows || 0} 窗口`;
  }

  return (
    <section className="kpis">
      <div className="kpi">
        <div className={`dot ${incrRunning ? 'on' : 'off'}`}>{incrRunning ? '▶' : '‖'}</div>
        <div className="body">
          <div className="lbl">增量写入</div>
          <div className="val">{p ? (incrRunning ? '运行中' : '已停止') : '--'}</div>
          <div className="sub">
            {p?.lastIncremental
              ? `最近 ${p.lastIncremental.hits} 条 / ${p.lastIncremental.durationMs}ms`
              : '等待数据'}
          </div>
        </div>
      </div>
      <div className="kpi">
        <div className="dot">⏱</div>
        <div className="body">
          <div className="lbl">巡检节奏 / 延迟</div>
          <div className="val">{p ? `${p.intervalSec || 10}s / 次` : '--'}</div>
          <div className="sub">{p ? `lag ${p.lagSec || 60}s` : '--'}</div>
        </div>
      </div>
      <div className="kpi">
        <div className="dot">⌛</div>
        <div className="body">
          <div className="lbl">目标窗口</div>
          <div className="val">
            {tw?.start && tw?.end
              ? `${tw.start.slice(11)} ~ ${tw.end.slice(11)}`
              : '--'}
          </div>
          <div className="sub">时间范围</div>
        </div>
      </div>
      <div className="kpi">
        <div className={`dot ${bfActive ? 'on' : ''}`}>{bfActive ? '◷' : '✓'}</div>
        <div className="body">
          <div className="lbl">补全进度</div>
          <div className="val">{kpiBf}</div>
          <div className="sub">{kpiBfSub}</div>
        </div>
      </div>
    </section>
  );
}
