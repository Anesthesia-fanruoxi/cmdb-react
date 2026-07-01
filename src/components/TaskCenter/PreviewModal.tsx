/**
 * 任务数据预览弹框 - 使用内联样式确保高度铺满
 */

import { X, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { dialogStackManager } from '../../utils/dialogStack';
import { PreviewData, Task } from '../../services/task';

interface PreviewModalProps {
  visible: boolean;
  loading: boolean;
  data: PreviewData;
  currentTask: Task | null;
  onClose: () => void;
  onPageChange: (task: Task, page: number) => void;
}

const PreviewModal = ({ visible, loading, data, currentTask, onClose, onPageChange }: PreviewModalProps) => {
  useEffect(() => {
    const dialogId = 'preview-modal';
    if (!visible) {
      dialogStackManager.pop(dialogId);
      return;
    }
    dialogStackManager.push(dialogId);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dialogStackManager.isTop(dialogId)) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      dialogStackManager.pop(dialogId);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  const isAnalysisPreview = currentTask?.type === 'analysis';
  const safeData = data || { items: [], columns: [], rows: [], total: 0, total_rows: 0, page: 1, page_size: 20 };
  const hasData = (safeData.rows && safeData.rows.length > 0) || (safeData.items && safeData.items.length > 0) || (safeData.columns && safeData.columns.length > 0);
  // 首次加载无数据时才显示全屏 spinner
  const showFullSpinner = loading && !hasData;

  const previewTableData = safeData.rows?.map(row => {
    const obj: Record<string, any> = {};
    row.forEach((val, idx) => {
      obj[`col${idx}`] = val;
    });
    return obj;
  }) || [];

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-color)',
          borderRadius: '8px',
          width: '85%',
          maxWidth: '1400px',
          height: '840px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
          }}
        >
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-color)' }}>数据预览</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            height: 0,
          }}
        >
          {showFullSpinner ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--primary-color)' }}>
              <Loader2 size={24} className="spin" />
            </div>
          ) : (
            <>
              {/* 数据分析预览 */}
              {isAnalysisPreview && safeData.items && safeData.items.length > 0 && (
                <div style={{ flex: 1, overflow: 'auto', minHeight: 0, height: 0 }}>
                  <table className="preview-table">
                    <thead><tr><th>值</th><th>数量</th></tr></thead>
                    <tbody>
                      {safeData.items.map((item, i) => (
                        <tr key={i}><td>{item.value}</td><td>{item.count}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SQL/ES导出预览 */}
              {!isAnalysisPreview && safeData.columns && safeData.columns.length > 0 && (
                <div style={{ flex: 1, overflow: 'auto', minHeight: 0, height: 0 }}>
                  <table className="preview-table">
                    <thead>
                      <tr>
                        <th className="row-index">#</th>
                        {safeData.columns.map((col, idx) => (
                          <th key={idx}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewTableData.map((row, i) => (
                        <tr key={i}>
                          <td className="row-index">{(safeData.page - 1) * safeData.page_size + i + 1}</td>
                          {safeData.columns!.map((_, idx) => (
                            <td key={idx}>{row[`col${idx}`]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 分页 */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 16px',
                  borderTop: '1px solid var(--border-color)',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: 'var(--text-color)', fontSize: '13px', fontWeight: 500 }}>
                    总数: {isAnalysisPreview
                      ? (safeData.total ?? safeData.total_rows ?? 0)
                      : (safeData.total_rows ?? safeData.total ?? 0)}
                  </span>
                  {((safeData.total || safeData.total_rows) || 0) > 100 && (
                    <span style={{
                      color: 'var(--warning-color, #e6a23c)',
                      fontSize: '12px',
                      background: 'var(--warning-bg, rgba(230, 162, 60, 0.1))',
                      padding: '4px 8px',
                      borderRadius: '4px',
                    }}>
                      ⚠️ 预览只展示前 100 条数据，完整数据请下载
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {loading && <Loader2 size={14} className="spin" style={{ color: 'var(--primary-color)' }} />}
                  <button
                    className="pagination-btn"
                    disabled={safeData.page <= 1 || loading}
                    onClick={() => currentTask && onPageChange(currentTask, safeData.page - 1)}
                  >上一页</button>
                  <span style={{ color: 'var(--text-color)', fontSize: '13px' }}>
                    第 {safeData.page} / {Math.ceil(Math.min((safeData.cache_total || safeData.total_rows || safeData.total || 0), 100) / safeData.page_size)} 页
                  </span>
                  <button
                    className="pagination-btn"
                    disabled={safeData.page * safeData.page_size >= Math.min((safeData.cache_total || safeData.total_rows || safeData.total || 0), 100) || loading}
                    onClick={() => currentTask && onPageChange(currentTask, safeData.page + 1)}
                  >下一页</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PreviewModal;
