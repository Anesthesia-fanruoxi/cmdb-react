/**
 * 保存 SQL 共享记录弹框
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { createSqlSharedHistory } from '../../../../services/sql';
import './SaveSqlSharedDialog.css';

interface Props {
  visible: boolean;
  project: string;
  projectName: string;
  dbName: string;
  sql: string;
  onClose: () => void;
  onSuccess: () => void;
}

const SaveSqlSharedDialog = ({ visible, project, projectName, dbName, sql, onClose, onSuccess }: Props) => {
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isShared, setIsShared] = useState(true); // true=共享, false=个人收藏

  // 重置状态
  useEffect(() => {
    if (visible) {
      setRemark('');
      setError('');
      setIsShared(true);
    }
  }, [visible]);

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible) return;
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  const handleSave = async () => {
    if (!project || !dbName || !sql.trim()) {
      setError('缺少必要参数');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = isShared
        ? { project, db_name: dbName, query: sql.trim(), remark: remark.trim() }
        : { project, db_name: dbName, query: sql.trim(), remark: remark.trim(), is_personal: true };
      const res = await createSqlSharedHistory(payload);

      if (res.code === 200) {
        onSuccess();
        onClose();
      } else {
        setError(res.message || '保存失败');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('保存失败，请重试');
      console.error('[SaveSqlShared] 错误:', msg);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      <div className="save-sql-shared-overlay" onClick={onClose} />
      <div className="save-sql-shared-dialog">
        <div className="dialog-header">
          <h3>保存到共享记录</h3>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="dialog-body">
          <div className="form-item">
            <label>项目</label>
            <span className="form-value">{projectName || project || '-'}</span>
          </div>
          <div className="form-item">
            <label>数据库</label>
            <span className="form-value">{dbName || '-'}</span>
          </div>
          <div className="form-item">
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
          <div className="form-item">
            <label>SQL</label>
            <div className="sql-preview">{sql || '-'}</div>
          </div>
          <div className="form-item">
            <label>备注</label>
            <textarea
              placeholder="输入备注信息，方便理解这条SQL的用途"
              value={remark}
              onChange={e => setRemark(e.target.value)}
              rows={3}
            />
          </div>
          {error && <div className="error-tip">{error}</div>}
        </div>

        <div className="dialog-footer">
          <button className="btn-cancel" onClick={onClose}>取消</button>
          <button className="btn-save" onClick={handleSave} disabled={loading || !sql.trim()}>
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </>
  );
};

export default SaveSqlSharedDialog;
