import type { AnalyzeProgressView } from '../hooks/useAnalyzeDrilldown';

/** 异常分析简易进度卡；点击打开详情弹框（四级下钻面板） */
export function AnalyzeProgressCard({
  progress,
  onOpenDetail,
}: {
  progress: AnalyzeProgressView;
  onOpenDetail: () => void;
}) {
  const {
    phase,
    percent,
    hint,
    rangeText,
    abnormal,
    windowCount,
    analysisId,
    done,
    total,
  } = progress;

  let badge = '空闲';
  let badgeCls = '';
  if (phase === 'running') {
    badge = '分析中';
    badgeCls = 'on';
  } else if (phase === 'done') {
    badge = '已完成';
  } else if (phase === 'error') {
    badge = '失败';
    badgeCls = 'warn';
  }

  const metaRight =
    phase === 'done'
      ? `总数 ${abnormal} · 节点 ${windowCount}`
      : done != null && total != null
        ? `${done}/${total}`
        : phase === 'idle'
          ? '—'
          : hint;

  const sub =
    phase === 'idle'
      ? '对比有差异后点击「分析异常」开始'
      : [
          hint,
          rangeText,
          analysisId ? `id ${analysisId}` : '',
        ]
          .filter(Boolean)
          .join('　');

  return (
    <div
      className="card analyze-progress-card"
      onClick={onOpenDetail}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetail();
        }
      }}
      title="点击查看异常分析详情"
    >
      <div className="card-head">
        <h2>
          异常分析{' '}
          <span className={`modal-badge ${badgeCls}`.trim()}>{badge}</span>
        </h2>
        <span className="tag">点击卡片查看详情</span>
      </div>
      <div className="card-body chart-wrap">
        <div className="bar">
          <span
            className="bar-fill"
            style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
          />
        </div>
        <div className="bf-meta">
          <span>{percent.toFixed(1)}%</span>
          <span>{metaRight}</span>
        </div>
        <p style={{ fontSize: '.72rem', color: 'var(--muted)', marginBottom: 4 }}>
          {sub}
        </p>
        <p className="bf-click-hint">分析中看进度；点此打开详情（四级下钻 / 窗口补全）</p>
      </div>
    </div>
  );
}
