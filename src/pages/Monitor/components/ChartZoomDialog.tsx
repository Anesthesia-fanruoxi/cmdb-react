/**
 * 图表放大弹窗组件
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { MonitorMetric } from '@/services/monitor';
import MetricChart from './MetricChart';
import './ChartZoomDialog.css';

interface ChartZoomDialogProps {
  metric: MonitorMetric | null;
  onClose: () => void;
}

const ChartZoomDialog = ({ metric, onClose }: ChartZoomDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (metric) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [metric, onClose]);

  // 点击遮罩关闭
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === dialogRef.current) onClose();
  };

  if (!metric) return null;

  const dialog = (
    <div className="chart-zoom-dialog" ref={dialogRef} onClick={handleBackdropClick}>
      <div className="chart-zoom-content">
        <div className="chart-zoom-header">
          <h3 className="chart-zoom-title">{metric.view_name}</h3>
          <button className="chart-zoom-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="chart-zoom-body">
          <MetricChart metric={metric} height={650} isDetailed />
        </div>
      </div>
    </div>
  );

  // 使用 Portal 渲染到 body
  const container = document.getElementById('root') || document.body;
  return createPortal(dialog, container);
};

export default ChartZoomDialog;
