import type { SyncPipeline } from '@/services/sql/sync';

interface PipelineBarProps {
  pipeline: SyncPipeline | null;
  flash: boolean;
}

export default function PipelineBar({ pipeline, flash }: PipelineBarProps) {
  const p = pipeline;
  const tw = p?.targetWindow;

  const esSt = p ? (p.esReady ? '就绪' : '未就绪') : '--';
  const adbSt = p ? (p.mysqlReady ? '就绪' : '未就绪') : '--';
  const parseSt = p?.lastIncremental
    ? `${p.lastIncremental.hits}条 / ${p.lastIncremental.durationMs}ms`
    : '等待';

  const info = p
    ? `增量${p.incrementalRunning ? '运行' : '停'} · ${p.intervalSec}s/lag${p.lagSec}s · ${
        tw ? `${tw.start?.slice(11)}~${tw.end?.slice(11)}` : '--'
      } · 补全${p.backfillActive ? '中' : '闲'}`
    : '';

  const boxCls = flash ? 'box on' : 'box';

  return (
    <section className="pipeline">
      <div className="pipe">
        <div className={boxCls}>
          <div className="name">ES</div>
          <small>{esSt}</small>
        </div>
        <span className="arrow">→</span>
        <div className={boxCls}>
          <div className="name">解析</div>
          <small>{parseSt}</small>
        </div>
        <span className="arrow">→</span>
        <div className={boxCls}>
          <div className="name">ADB</div>
          <small>{adbSt}</small>
        </div>
      </div>
      <div className="pipe-info">{info}</div>
    </section>
  );
}
