/**
 * 视图详情弹窗
 */

import type { ViewListItem } from '../../../../services/elfk/view';
import './ViewDetail.css';

interface DictItem {
  key: string;
  value: string;
}

interface ViewDetailProps {
  visible: boolean;
  data: ViewListItem;
  projectOptions: DictItem[];
  categoryOptions: DictItem[];
  onClose: () => void;
  onEdit: () => void;
}

const ViewDetail = ({ visible, data, projectOptions, categoryOptions, onClose, onEdit }: ViewDetailProps) => {
  if (!visible) return null;

  const getProjectName = (key: string) => {
    const item = projectOptions.find(p => p.key === key);
    return item?.value || key;
  };

  const getCategoryName = (key?: string) => {
    if (!key) return '未分类';
    const item = categoryOptions.find(c => c.key === key);
    return item?.value || key;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content view-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>视图详情</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="detail-grid">
            <div className="detail-item">
              <span className="label">视图名称</span>
              <span className="value">{data.name}</span>
            </div>

            <div className="detail-item">
              <span className="label">项目</span>
              <span className="value">{getProjectName(data.project)}</span>
            </div>

            <div className="detail-item">
              <span className="label">分类</span>
              <span className="value">{getCategoryName(data.category)}</span>
            </div>

            <div className="detail-item">
              <span className="label">日志类型</span>
              <span className="value">{data.log_type || 'elfk'}</span>
            </div>

            <div className="detail-item full">
              <span className="label">索引模式</span>
              <span className="value mono">{data.index_pattern}</span>
            </div>

            <div className="detail-item">
              <span className="label">时间字段</span>
              <span className="value mono">{data.time_field}</span>
            </div>

            <div className="detail-item">
              <span className="label">更新时间</span>
              <span className="value">{data.update_time || '-'}</span>
            </div>

            <div className="detail-item full">
              <span className="label">描述</span>
              <span className="value">{data.description || '-'}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>关闭</button>
          <button className="btn-submit" onClick={onEdit}>编辑</button>
        </div>
      </div>
    </div>
  );
};

export default ViewDetail;
