import type { SyncRuntime } from '@/services/sql/sync';
import { fmtMB, fmtUptime } from '../utils/charts';

interface RuntimeCardProps {
  runtime: SyncRuntime | null;
}

export default function RuntimeCard({ runtime }: RuntimeCardProps) {
  const p = runtime;
  return (
    <div className="card">
      <div className="card-head">
        <h2>服务状态</h2>
        <span className="tag">{p ? `运行 ${fmtUptime(p.uptimeSec || 0)}` : '--'}</span>
      </div>
      <div className="card-body">
        <div className="rt-grid">
          <div className="cell">
            <div className="v">{p ? `${p.goroutines || 0} 个` : '--'}</div>
            <div className="l">并发协程</div>
          </div>
          <div className="cell">
            <div className="v">
              {p ? `${p.goMaxProcs || p.numCPU || 0} / ${p.numCPU || 0}` : '--'}
            </div>
            <div className="l">运行 / 逻辑 CPU</div>
          </div>
          <div className="cell">
            <div className="v">{p ? fmtMB(p.allocMB) : '--'}</div>
            <div className="l">已分配内存 Alloc</div>
          </div>
          <div className="cell">
            <div className="v">{p ? fmtMB(p.heapSysMB) : '--'}</div>
            <div className="l">堆内存 HeapSys</div>
          </div>
          <div className="cell">
            <div className="v">{p ? fmtMB(p.sysMB) : '--'}</div>
            <div className="l">进程内存 Sys</div>
          </div>
          <div className="cell">
            <div className="v">{p ? fmtMB(p.totalAllocMB) : '--'}</div>
            <div className="l">累计分配</div>
          </div>
          <div className="cell">
            <div className="v">
              {p ? `${p.numGC || 0} / ${(p.pauseTotalSec || 0).toFixed(2)}` : '--'}
            </div>
            <div className="l">GC 次数 / 暂停s</div>
          </div>
          <div className="cell">
            <div className="v">{p?.goVersion || '--'}</div>
            <div className="l">Go 版本</div>
          </div>
        </div>
      </div>
    </div>
  );
}
