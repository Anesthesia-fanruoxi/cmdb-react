/**
 * 分享对话框
 */

import { useState, useEffect } from 'react';
import { X, Copy } from 'lucide-react';
import { sharePublicDoc, closePublicShare, DocItem } from '../../../../services/knowledge';
import toast from '../../../../components/Toast';
import { confirm } from '../../../../components/ConfirmModal';

interface Props {
  visible: boolean;
  doc: DocItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

const ShareDialog = ({ visible, doc, onClose, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [expiredDays, setExpiredDays] = useState(7);
  const shareInfo = (doc as any)?.share as { share_url?: string; share_code?: string; expired_at?: string } | undefined;
  const isShared = !!shareInfo?.share_url;

  useEffect(() => {
    if (visible) setExpiredDays(7);
  }, [visible]);

  const getRemainingTime = () => {
    if (!shareInfo?.expired_at) return '未知';
    const diff = new Date(shareInfo.expired_at).getTime() - Date.now();
    if (diff <= 0) return '已过期';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 24) return `${hours} 小时`;
    const days = Math.floor(hours / 24);
    const h = hours % 24;
    return h > 0 ? `${days} 天 ${h} 小时` : `${days} 天`;
  };

  const handleCopy = async () => {
    if (shareInfo?.share_url) {
      await navigator.clipboard.writeText(shareInfo.share_url);
      toast.success('已复制分享链接');
    }
  };

  const handleSubmit = async () => {
    if (!doc) return;
    setLoading(true);
    try {
      const res = await sharePublicDoc({ doc_id: doc.id, expired_days: expiredDays });
      if (res.code === 200 && res.data?.share_url) {
        await navigator.clipboard.writeText(res.data.share_url);
        toast.success('已复制分享链接');
        onSuccess();
      }
    } catch (err) { toast.error('分享失败'); }
    finally { setLoading(false); }
  };

  const handleCloseShare = async () => {
    if (!shareInfo?.share_code) return;
    const confirmed = await confirm({
      title: '取消分享',
      content: '确定要取消分享吗？',
      type: 'warning'
    });
    if (!confirmed) return;
    setLoading(true);
    try {
      const res = await closePublicShare(shareInfo.share_code);
      if (res.code === 200) { toast.success('已取消分享'); onSuccess(); }
    } catch (err) { toast.error('取消分享失败'); }
    finally { setLoading(false); }
  };

  if (!visible) return null;

  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-popup" onClick={e => e.stopPropagation()}>
        <div className="share-header">
          <span>{isShared ? '分享详情' : '创建分享'}</span>
          <button className="close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="share-body">
          {isShared ? (
            <>
              <div className="share-field">
                <label>分享链接</label>
                <div className="share-url-row">
                  <input type="text" value={shareInfo?.share_url || ''} readOnly />
                  <button onClick={handleCopy}><Copy size={14} /></button>
                </div>
              </div>
              <div className="share-field">
                <label>分享码</label>
                <span className="share-code">{shareInfo?.share_code}</span>
              </div>
              <div className="share-field">
                <label>剩余时间</label>
                <span>{getRemainingTime()}</span>
              </div>
            </>
          ) : (
            <div className="share-field">
              <label>过期时间</label>
              <select value={expiredDays} onChange={e => setExpiredDays(Number(e.target.value))}>
                <option value={1}>1天</option>
                <option value={7}>7天</option>
                <option value={15}>15天</option>
                <option value={30}>30天</option>
              </select>
            </div>
          )}
        </div>
        <div className="share-footer">
          <button className="btn-cancel" onClick={onClose}>关闭</button>
          {isShared ? (
            <button className="btn-danger" onClick={handleCloseShare} disabled={loading}>{loading ? '处理中...' : '取消分享'}</button>
          ) : (
            <button className="btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? '处理中...' : '确认分享'}</button>
          )}
        </div>
      </div>
      <style>{`
        .share-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: flex-start; justify-content: center; padding-top: 15vh; }
        .share-popup { width: 360px; background: var(--bg-color, #1f1f1f); border-radius: 8px; border: 1px solid var(--border-color, #3a3a3a); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
        .share-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--border-color, #3a3a3a); font-size: 15px; font-weight: 500; color: var(--text-color, #e0e0e0); }
        .share-header .close-btn { background: none; border: none; cursor: pointer; color: var(--text-secondary, #888); padding: 4px; }
        .share-body { padding: 16px; }
        .share-field { margin-bottom: 16px; }
        .share-field:last-child { margin-bottom: 0; }
        .share-field label { display: block; font-size: 13px; color: var(--text-secondary, #888); margin-bottom: 8px; }
        .share-field select, .share-field input { width: 100%; padding: 10px 12px; border: 1px solid var(--border-color, #3a3a3a); border-radius: 6px; background: var(--bg-secondary, #2a2a2a); color: var(--text-color, #e0e0e0); font-size: 14px; }
        .share-url-row { display: flex; gap: 8px; }
        .share-url-row input { flex: 1; }
        .share-url-row button { padding: 10px 12px; background: var(--primary-color, #1890ff); color: #fff; border: none; border-radius: 6px; cursor: pointer; }
        .share-code { font-family: monospace; font-size: 14px; color: var(--text-color, #e0e0e0); }
        .share-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--border-color, #3a3a3a); }
        .share-footer button { padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; }
        .btn-cancel { background: var(--bg-secondary, #2a2a2a); color: var(--text-color, #e0e0e0); border: 1px solid var(--border-color, #3a3a3a); }
        .btn-primary { background: var(--primary-color, #1890ff); color: #fff; border: none; }
        .btn-danger { background: #ff4d4f; color: #fff; border: none; }
      `}</style>
    </div>
  );
};

export default ShareDialog;