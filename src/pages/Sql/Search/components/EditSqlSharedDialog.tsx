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

  useEffect(() => {
    if (visible && item) {
      setQuery(item.query || '');
      setRemark(item.remark || '');
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
        project: item.project,
        db_name: item.db_name,
        query: query.trim(),
        remark: remark.trim(),
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
      <div className="sql-detail-modal" style={{ width: 700 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h4>✏️ 编辑共享记录</h4>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>SQL 查询</label>
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              rows={8}
              style={{
                width: '100%',
                padding: 12,
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                fontSize: 13,
                fontFamily: "'Monaco', 'Consolas', monospace",
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>备注</label>
            <input
              type="text"
              value={remark}
              onChange={e => setRemark(e.target.value)}
              placeholder="输入备注信息"
              style={{
                width: '100%',
                height: 36,
                padding: '0 12px',
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                fontSize: 13,
                boxSizing: 'border-box'
              }}
            />
          </div>

          {error && <div style={{ color: '#e74c3c', fontSize: 13, marginBottom: 12 }}>{error}</div>}
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
