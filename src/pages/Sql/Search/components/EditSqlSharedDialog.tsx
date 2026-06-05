/**
 * 编辑 SQL 共享记录弹框
 */

import { useState, useEffect } from 'react';
import { updateSqlSharedQuery, type SqlSharedQueryItem } from '../../../../services/sql';

interface Props {
  visible: boolean;
  item: SqlSharedQueryItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

const EditSqlSharedDialog = ({ visible, item, onClose, onSuccess }: Props) => {
  const [query, setQuery] = useState('');
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isShared, setIsShared] = useState(true);

  useEffect(() => {
    if (visible && item) {
      setQuery(item.query || '');
      setRemark(item.remark || '');
      setIsShared(!item.is_personal);
      setError('');
    }
  }, [visible, item]);

  // 快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible) return;
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!loading && query.trim()) handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, loading, query, onClose]);

  const handleSave = async () => {
    if (!item || !query.trim()) {
      setError('SQL 不能为空');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await updateSqlSharedQuery({
        id: item.id,
        query: query.trim(),
        remark: remark.trim(),
        is_personal: !isShared,
      });

      if (res.code === 200) {
        onSuccess();
        onClose();
      } else {
        setError(res.message || '更新失败');
      }
    } catch (err) {
      setError('更新失败，请重试');
      console.error('更新共享记录失败:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!visible || !item) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="sql-edit-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h4>✏️ 编辑共享记录</h4>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="sql-edit-body">
          <div className="edit-row edit-row-grow">
            <label>SQL 查询</label>
            <textarea
              className="edit-textarea"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          <div className="edit-row edit-row-inline">
            <div className="edit-row-half">
              <label>保存位置</label>
              <div className="share-toggle">
                <button
                  type="button"
                  className={`toggle-btn ${isShared ? 'active' : ''}`}
                  onClick={() => setIsShared(true)}
                >👥 共享记录</button>
                <button
                  type="button"
                  className={`toggle-btn ${!isShared ? 'active' : ''}`}
                  onClick={() => setIsShared(false)}
                >⭐ 个人收藏</button>
              </div>
            </div>
            <div className="edit-row-half">
              <label>备注</label>
              <input
                className="edit-input"
                type="text"
                value={remark}
                onChange={e => setRemark(e.target.value)}
                placeholder="输入备注信息"
              />
            </div>
          </div>

          {error && <div className="edit-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-default" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading || !query.trim()}>
            {loading ? '保存中...' : '💾 保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditSqlSharedDialog;
