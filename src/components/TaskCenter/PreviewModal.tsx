/**
 * 任务数据预览弹框
 */

import { X, Loader2 } from 'lucide-react';
import { PreviewData, Task } from '../../services/task';

interface PreviewModalProps {
  visible: boolean;
  loading: boolean;
  data: PreviewData | null;
  currentTask: Task | null;
  onClose: () => void;
  onPageChange: (task: Task, page: number) => void;
}

const PreviewModal = ({ visible, loading, data, currentTask, onClose, onPageChange }: PreviewModalProps) => {
  if (!visible) return null;

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
          ) : data ? (
            <>
              <table className="preview-table">
                <thead><tr><th>值</th><th>数量</th></tr></thead>
                <tbody>
                  {data.items.map((item, i) => (
                    <tr key={i}><td>{item.value}</td><td>{item.count}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="preview-pagination">
                <span>共 {data.total} 条</span>
                <div className="pagination-btns">
                  <button 
                    disabled={data.page <= 1} 
                    onClick={() => currentTask && onPageChange(currentTask, data.page - 1)}
                  >上一页</button>
                  <span>第 {data.page} 页</span>
                  <button 
                    disabled={data.page * data.page_size >= data.total}
                    onClick={() => currentTask && onPageChange(currentTask, data.page + 1)}
                  >下一页</button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;
