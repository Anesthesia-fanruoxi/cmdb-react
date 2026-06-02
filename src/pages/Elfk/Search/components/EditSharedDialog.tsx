/**
 * 编辑 ELFK 共享关键词弹框
 */

import { useState, useEffect } from 'react';
import { updateSharedKeyword, type SharedKeywordItem } from '../../../../services/elfk';
import './SaveSharedDialog.css';

interface Props {
  visible: boolean;
  item: SharedKeywordItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

const EditSharedDialog = ({ visible, item, onClose, onSuccess }: Props) => {
  const [keyword, setKeyword] = useState('');
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && item) {
      setKeyword(item.keyword || '');
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
        if (!loading && keyword.trim()) handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, loading, keyword, onClose]);

  const handleSave = async () => {
    if (!item || !keyword.trim()) {
      setError('关键词不能为空');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await updateSharedKeyword({
        id: item.id,
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
    <>
      <div className="save-shared-overlay" onClick={onClose} />
      <div className="save-shared-dialog" style={{ width: 550 }}>
        <div className="dialog-header">
          <h3>✏️ 编辑共享记录</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="dialog-body">
          <div className="form-item">
            <label>关键词</label>
            <textarea
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              rows={4}
              placeholder="输入搜索关键词"
              style={{ fontFamily: "'Monaco', 'Consolas', monospace" }}
            />
          </div>

          <div className="form-item">
            <label>备注</label>
            <input
              type="text"
              value={remark}
              onChange={e => setRemark(e.target.value)}
              placeholder="输入备注信息（可选）"
              style={{ height: 36, padding: '0 12px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          {error && <div className="error-tip">{error}</div>}
        </div>

        <div className="dialog-footer">
          <button className="btn-cancel" onClick={onClose}>取消</button>
          <button className="btn-save" onClick={handleSave} disabled={loading || !keyword.trim()}>
            {loading ? '保存中...' : '💾 保存'}
          </button>
        </div>
      </div>
    </>
  );
};

export default EditSharedDialog;
