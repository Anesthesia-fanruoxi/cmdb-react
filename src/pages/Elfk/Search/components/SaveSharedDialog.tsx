/**
 * 保存共享记录弹框
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { createSharedKeyword } from '../../../../services/elfk';
import './SaveSharedDialog.css';

interface ProjectInfo {
  project: string;
  projectName: string;
  category: string;
  categoryName: string;
}

interface Props {
  visible: boolean;
  projectInfo: ProjectInfo | null;
  viewId: number;
  viewName: string;
  keyword: string;
  onClose: () => void;
  onSuccess: () => void;
}

const SaveSharedDialog = ({ visible, projectInfo, viewId, viewName, keyword, onClose, onSuccess }: Props) => {
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
    if (!projectInfo || !viewId || !keyword.trim()) {
      setError('缺少必要参数');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await createSharedKeyword({
        project: projectInfo.project,
        category: projectInfo.category,
        view_id: viewId,
        keyword: keyword.trim(),
        remark: remark.trim(),
        is_shared: isShared,
      });

      if (res.code === 200) {
        onSuccess();
        onClose();
      } else {
        setError(res.message || '保存失败');
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '保存失败，请重试';
      setError(errorMsg);
      console.error('保存共享记录失败:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      <div className="save-shared-overlay" onClick={onClose} />
      <div className="save-shared-dialog">
        <div className="dialog-header">
          <h3>保存到共享记录</h3>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="dialog-body">
          <div className="form-item">
            <label>项目</label>
            <span className="form-value">{projectInfo?.projectName || '-'}</span>
          </div>
          <div className="form-item">
            <label>分类</label>
            <span className="form-value">{projectInfo?.categoryName || '-'}</span>
          </div>
          <div className="form-item">
            <label>视图</label>
            <span className="form-value">{viewName || '-'}</span>
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
            <label>关键词</label>
            <div className="keyword-preview">{keyword || '-'}</div>
          </div>
          <div className="form-item">
            <label>备注</label>
            <textarea
              placeholder="输入备注信息（可选）"
              value={remark}
              onChange={e => setRemark(e.target.value)}
              rows={3}
            />
          </div>
          {error && <div className="error-tip">{error}</div>}
        </div>

        <div className="dialog-footer">
          <button className="btn-cancel" onClick={onClose}>取消</button>
          <button className="btn-save" onClick={handleSave} disabled={loading || !keyword.trim()}>
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </>
  );
};

export default SaveSharedDialog;
