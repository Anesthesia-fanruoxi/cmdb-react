/**
 * 任务数据预览弹框
 */

import { X, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
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
  // ESC 关闭（只在最顶层时响应）
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

  // 判断是否是数据分析预览
  const isAnalysisPreview = currentTask?.type === 'analysis';
  
  // 转换表格数据（SQL/ES导出）
  const previewTableData = data?.rows?.map(row => {
    const obj: Record<string, any> = {};
    row.forEach((val, idx) => {
      obj[`col${idx}`] = val;
    });
    return obj;
  }) || [];

  return (
    <div className="preview-modal-overlay" onClick={onClose}>
      <div className="preview-modal" onClick={e => e.stopPropagation()}>
        <div className="preview-header">
          <h3>数据预览</h3>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="preview-content">
          {loading ? (
            <div className="preview-loading"><Loader2 size={24} className="spin" /></div>
          ) : (
            <>
              {/* 数据分析预览 */}
              {isAnalysisPreview && data.items && data.items.length > 0 && (
                <div className="preview-table-wrapper">
                  <table className="preview-table">
                    <thead><tr><th>值</th><th>数量</th></tr></thead>
                    <tbody>
                      {data.items.map((item, i) => (
                        <tr key={i}><td>{item.value}</td><td>{item.count}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* SQL/ES导出预览 */}
              {!isAnalysisPreview && data.columns && data.columns.length > 0 && (
                <div className="preview-table-wrapper">
                  <table className="preview-table">
                    <thead>
                      <tr>
                        {data.columns.map((col, idx) => (
                          <th key={idx}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewTableData.map((row, i) => (
                        <tr key={i}>
                          {data.columns!.map((_, idx) => (
                            <td key={idx}>{row[`col${idx}`]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* 分页 */}
              <div className="preview-pagination">
                <div className="preview-info">
                  <span className="preview-total">
                    总数: {isAnalysisPreview
                      ? (data.total ?? data.total_rows ?? 0)
                      : (data.total_rows ?? data.total ?? 0)}
                  </span>
                  {((data.total || data.total_rows) || 0) > 100 && (
                    <span className="preview-tip">
                      ⚠️ 预览只展示前 100 条数据，完整数据请下载
                    </span>
                  )}
                </div>
                <div className="pagination-btns">
                  <button
                    disabled={data.page <= 1}
                    onClick={() => currentTask && onPageChange(currentTask, data.page - 1)}
                  >上一页</button>
                  <span>
                    第 {data.page} / {Math.ceil(Math.min((data.cache_total || data.total_rows || data.total || 0), 100) / data.page_size)} 页
                  </span>
                  <button
                    disabled={data.page * data.page_size >= Math.min((data.cache_total || data.total_rows || data.total || 0), 100)}
                    onClick={() => currentTask && onPageChange(currentTask, data.page + 1)}
                  >下一页</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;
