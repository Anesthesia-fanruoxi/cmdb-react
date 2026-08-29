import type { SyncBackfillProgress } from '@/services/sql/sync';

/** 仅展示补全进度；发起补全走「对比 → 差异点击」 */
export function BackfillProgressCard({
  progress,
  onOpenDetail,
}: {
  progress: SyncBackfillProgress | null;
  onOpenDetail: () => void;
}) {
  const pct = progress?.percent || 0;
  const done = (progress?.completed || 0) + (progress?.failed || 0);
  const total = progress?.totalWindows || 0;
  const txt =
    progress
      ? `命中 ${progress.totalHits || 0} · 写入 ${progress.totalWritten || 0} · 失败 ${progress.failed || 0}` +
        (progress.rangeStart ? `　[${progress.rangeStart} ~ ${progress.rangeEnd || ''})` : '')
      : '';

  return (
    <div
      className="card bf-progress-card"
      onClick={onOpenDetail}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetail();
        }
      }}
      title="点击查看补全详情"
    >
      <div className="card-head">
        <h2>补全进度</h2>
        <span className="tag">点击卡片查看详情</span>
      </div>
      <div className="card-body chart-wrap">
        <div className="bar">
          <span className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
        </div>
        <div className="bf-meta">
          <span>{(pct.toFixed(1) || '0')}%</span>
          <span>
            {done}/{total} 窗口
          </span>
        </div>
        <p style={{ fontSize: '.72rem', color: 'var(--muted)', marginBottom: 4 }}>{txt}</p>
        <p className="bf-click-hint">点击卡片打开详情弹框（独立 SSE）</p>
      </div>
    </div>
  );
}
