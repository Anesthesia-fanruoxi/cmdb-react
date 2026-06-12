/**
 * SSH reload 结果弹框
 */

import type { ReloadResult } from '../../../services/assets/domainMap';

interface ReloadResultModalProps {
  visible: boolean;
  title: string;
  results: ReloadResult[];
  onClose: () => void;
}

const ReloadResultModal = ({ visible, title, results, onClose }: ReloadResultModalProps) => {
  if (!visible) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content dm-reload-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="dm-reload-tip">SSH 远程 reload nginx 节点结果：</div>
          <table className="data-table">
            <thead>
              <tr><th>节点名称</th><th>主机</th><th>状态</th><th>错误信息</th></tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <td>{r.name}</td>
                  <td>{r.host}</td>
                  <td>
                    <span className={`status-tag ${r.status === 'success' ? 'success' : 'danger'}`}>
                      {r.status === 'success' ? '成功' : '失败'}
                    </span>
                  </td>
                  <td title={r.error}>{r.error || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>知道了</button>
        </div>
      </div>
    </div>
  );
};

export default ReloadResultModal;
