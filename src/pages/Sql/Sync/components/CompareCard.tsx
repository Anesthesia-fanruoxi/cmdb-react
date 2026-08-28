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
  /** 清空输入 + 最近一次对比结果 */
  onReset: () => void;
  loading: boolean;
  disabled: boolean;
  esCount: string;
  adbCount: string;
  diff: string;
  diffCls: string;
  rangeText: string;
  /** 有差异时可点击，提示填入补全时间 */
  diffClickable?: boolean;
  onDiffClick?: () => void;
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
  diffClickable,
  onDiffClick,
}: CompareCardProps) {
  const fillQuick = (key: CompareQuickRangeKey) => {
    const { start, end } = getCompareQuickRange(key);
    onCmpStartChange(start);
    onCmpEndChange(end);
  };

  return (
    <div className="card">
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
          开始、结束均不填时，默认查询上一个整点小时；填写时两者都要填，且不超过一个月。有差异时可点击差异数值发起补全。
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
            <div
              className={`num ${diffCls}${diffClickable ? ' diff-clickable' : ''}`}
              role={diffClickable ? 'button' : undefined}
              title={diffClickable ? '点击发起补全' : undefined}
              onClick={diffClickable ? onDiffClick : undefined}
            >
              {diff}
            </div>
            <div className="lbl">差异{diffClickable ? ' · 点击补全' : ''}</div>
          </div>
        </div>
        <p style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 8 }}>{rangeText}</p>
      </div>
    </div>
  );
}
