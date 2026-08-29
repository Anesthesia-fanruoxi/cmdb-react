import type { SyncRuntime } from '@/services/sql/sync';
import { fmtMB, fmtUptime } from '../utils/charts';

interface RuntimeCardProps {
  runtime: SyncRuntime | null;
}

export default function RuntimeCard({ runtime }: RuntimeCardProps) {
  const p = runtime;
  return (
    <div className="card rt-card-compact">
      <div className="card-head">
        <h2>服务状态</h2>
        <span className="tag">{p ? `运行 ${fmtUptime(p.uptimeSec || 0)}` : '--'}</span>
      </div>
      <div className="card-body">
        <div className="rt-grid rt-grid-compact">
          <div className="cell">
            <div className="v">{p ? `${p.goroutines || 0}` : '--'}</div>
            <div className="l">协程</div>
          </div>
          <div className="cell">
            <div className="v">{p ? fmtMB(p.allocMB) : '--'}</div>
            <div className="l">Alloc</div>
          </div>
          <div className="cell">
            <div className="v">{p ? fmtMB(p.heapSysMB) : '--'}</div>
            <div className="l">Heap</div>
          </div>
          <div className="cell">
            <div className="v">{p ? String(p.numGC || 0) : '--'}</div>
            <div className="l">GC</div>
          </div>
        </div>
      </div>
    </div>
  );
}
