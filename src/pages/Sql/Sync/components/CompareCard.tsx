import {
  COMPARE_QUICK_RANGES,
  getCompareQuickRange,
  type CompareQuickRangeKey,
} from '../utils/compareRanges';

interface CompareCardProps {
  cmpStart: string;
  cmpEnd: string;
  onCmpStartChange: (v: string) => void;
  onCmpEndChange: (v: string) => void;
  onCompare: () => void;
  onReset: () => void;
  loading: boolean;
  disabled: boolean;
  esCount: string;
  adbCount: string;
  diff: string;
  diffCls: string;
  rangeText: string;
  actualRange: { start: string; end: string } | null;
  hasDiff: boolean;
  canWrite: boolean;
  backfillBusy: boolean;
  analyzeRunning?: boolean;
  onFullBackfill: () => void;
  /** 点击「分析异常」：启动分析并打开详情 */
  onAnalyze: () => void;
}

export default function CompareCard({
  cmpStart,
  cmpEnd,
  onCmpStartChange,
  onCmpEndChange,
  onCompare,
  onReset,
  loading,
  disabled,
  esCount,
  adbCount,
  diff,
  diffCls,
  rangeText,
  actualRange,
  hasDiff,
  canWrite,
  backfillBusy,
  analyzeRunning,
  onFullBackfill,
  onAnalyze,
}: CompareCardProps) {
  const fillQuick = (key: CompareQuickRangeKey) => {
    const { start, end } = getCompareQuickRange(key);
    onCmpStartChange(start);
    onCmpEndChange(end);
  };

  const hasResult = !!actualRange?.start && esCount !== '-';
  const showActions = hasResult && hasDiff;

  return (
    <div className="card compare-card">
      <div className="card-head compare-card-head">
        <div className="compare-card-head-left">
          <h2>对比查询</h2>
          <button
            type="button"
            className="compare-quick-btn compare-quick-reset"
            disabled={disabled}
            onClick={onReset}
          >
            重置
          </button>
        </div>
        <div className="compare-quick">
          {COMPARE_QUICK_RANGES.map((item) => (
            <button
              key={item.key}
              type="button"
              className="compare-quick-btn"
              disabled={disabled}
              onClick={() => fillQuick(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="card-body">
        <div className="form-row">
          <label>
            开始
            <input
              type="text"
              value={cmpStart}
              onChange={(e) => onCmpStartChange(e.target.value)}
              placeholder="可选"
              disabled={disabled}
            />
          </label>
          <label>
            结束
            <input
              type="text"
              value={cmpEnd}
              onChange={(e) => onCmpEndChange(e.target.value)}
              placeholder="可选"
              disabled={disabled}
            />
          </label>
          <button
            className="btn btn-secondary"
            onClick={onCompare}
            disabled={disabled || loading}
          >
            对比
          </button>
        </div>
        <p className="hint">
          开始、结束均不填时，默认查询上一个整点小时；填写时两者都要填，且不超过一个月。有差异时可做异常分析或全量补全。
        </p>
        <div className="compare-grid">
          <div>
            <div className="num">{esCount}</div>
            <div className="lbl">ES</div>
          </div>
          <div>
            <div className="num">{adbCount}</div>
            <div className="lbl">ADB</div>
          </div>
          <div>
            <div className={`num ${diffCls}`}>{diff}</div>
            <div className="lbl">差异</div>
          </div>
        </div>
        <p style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: 8 }}>{rangeText}</p>

        {showActions && (
          <div className="compare-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onAnalyze}
              disabled={disabled || analyzeRunning}
            >
              {analyzeRunning ? '分析中…' : '分析异常'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onFullBackfill}
              disabled={disabled || !canWrite || backfillBusy}
              title={canWrite ? '按对比范围全量补全' : '需要 sql:sync:w'}
            >
              全量补全
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
