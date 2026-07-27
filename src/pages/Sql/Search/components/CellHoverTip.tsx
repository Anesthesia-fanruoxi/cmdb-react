/**
 * 单元格悬浮提示
 * 单元格内容被截断时，鼠标悬浮延迟显示带样式的完整内容浮层
 * 任意滚动发生时自动隐藏，避免浮层位置错乱
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface CellTipState {
  text: string;
  left: number;
  top: number;
  flip: boolean; // 下方空间不足时向上翻转
}

const TIP_MAX_WIDTH = 480;
const TIP_MAX_HEIGHT = 240;
const SHOW_DELAY = 350;

export function useCellHoverTip() {
  const [tip, setTip] = useState<CellTipState | null>(null);
  const timerRef = useRef<number | null>(null);

  const showTip = useCallback((text: string, td: HTMLTableCellElement) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const rect = td.getBoundingClientRect();
    timerRef.current = window.setTimeout(() => {
      const spaceBelow = window.innerHeight - rect.bottom;
      const flip = spaceBelow < TIP_MAX_HEIGHT + 20;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - TIP_MAX_WIDTH - 8));
      setTip({ text, left, top: flip ? rect.top - 6 : rect.bottom + 6, flip });
    }, SHOW_DELAY);
  }, []);

  const hideTip = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setTip(null);
  }, []);

  // 任意容器滚动时隐藏（scroll 事件不冒泡，用捕获监听）
  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [tip]);

  // 卸载清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { tip, showTip, hideTip };
}

export const CellHoverTip = ({ tip }: { tip: CellTipState | null }) => {
  if (!tip) return null;
  return (
    <div
      className="cell-hover-tip"
      style={{
        left: tip.left,
        top: tip.top,
        transform: tip.flip ? 'translateY(-100%)' : undefined,
      }}
    >
      {tip.text}
    </div>
  );
};
