/**
 * 单元格详情弹框
 * 单击单元格弹出，居中显示完整内容；JSON 内容自动格式化展示
 * readonly 模式（全屏预览）下不提供复制按钮
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from '../../../../components/Toast';

interface Props {
  value: string;
  colName: string;
  readonly?: boolean;
  onClose: () => void;
}

const CellDetailModal = ({ value, colName, readonly = false, onClose }: Props) => {
  // 检测是否为 JSON 内容
  const parsed = useMemo(() => {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return null;
      }
    }
    return null;
  }, [value]);

  const isJson = parsed !== null && typeof parsed === 'object';
  const [rawMode, setRawMode] = useState(false);
  const displayText = isJson && !rawMode ? JSON.stringify(parsed, null, 2) : value;

  // Esc 关闭
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayText);
      toast.success('已复制全部内容');
    } catch {
      toast.error('复制失败');
    }
  }, [displayText]);

  return (
    <div className="cell-detail-overlay" onClick={onClose}>
      <div className="cell-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cell-detail-header">
          <span className="cell-detail-title" title={colName}>{colName}</span>
          <div className="cell-detail-actions">
            {isJson && (
              <button className="cell-detail-btn" onClick={() => setRawMode((m) => !m)}>
                {rawMode ? '格式化' : '原始'}
              </button>
            )}
            {!readonly && (
              <button className="cell-detail-btn primary" onClick={handleCopy}>
                复制
              </button>
            )}
            <button className="cell-detail-close" onClick={onClose} title="关闭 (Esc)">
              ✕
            </button>
          </div>
        </div>
        <pre className="cell-detail-body">{displayText}</pre>
        <div className="cell-detail-footer">
          <span>{value.length} 字符</span>
          {isJson && <span>JSON</span>}
        </div>
      </div>
    </div>
  );
};

export default CellDetailModal;
