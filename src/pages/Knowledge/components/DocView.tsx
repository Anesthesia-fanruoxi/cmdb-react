/**
 * 文档查看组件
 */

import { useState } from 'react';
import { User, Clock, Edit, History, Tag, Download, Share2, Link, Info, Copy } from 'lucide-react';
import { DocItem, getDocumentHistoryList, getDocumentHistoryDetail, restoreDocumentHistory, getPublicDocHistoryList, getPublicDocHistoryDetail, restorePublicDocHistory, DocHistoryItem, ShareInfo } from '../../../services/knowledge';
import type { DictItem } from '../../../services/system/dict';
import MarkdownView from '../../../components/Markdown';
import DocTocNav from './DocTocNav';
import toast from '../../../components/Toast';
import { confirm } from '../../../components/ConfirmModal';
import './DocView.css';

interface DocViewProps {
  doc: DocItem;
  onEdit?: () => void;
  onRefresh?: () => void;
  onShare?: () => void;
  categoryOptions?: DictItem[];
  showHeader?: boolean;
  type?: 'document' | 'public' | 'personal';
}

const DocView = ({ doc, onEdit, onRefresh, onShare, categoryOptions = [], showHeader = false, type = 'document' }: DocViewProps) => {
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<DocHistoryItem[]>([]);
  const [previewData, setPreviewData] = useState<DocHistoryItem | null>(null);
  const [showShareTip, setShowShareTip] = useState(false);

  const shareInfo = (doc as any).share as ShareInfo | undefined;

  const getRemainingTime = (expiredAt?: string | null) => {
    if (!expiredAt) return '永久';
    const diff = new Date(expiredAt).getTime() - Date.now();
    if (isNaN(diff)) return '永久';
    if (diff <= 0) return '已过期';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 24) return `${hours} 小时`;
    const days = Math.floor(hours / 24);
    const h = hours % 24;
    return h > 0 ? `${days} 天 ${h} 小时` : `${days} 天`;
  };

  const handleCopyShareUrl = async () => {
    if (shareInfo?.share_url) {
      await navigator.clipboard.writeText(shareInfo.share_url);
      toast.success('已复制分享链接');
    }
  };

  const formatTime = (timeStr?: string): string => {
    if (!timeStr) return '-';
    try { return new Date(timeStr).toLocaleString('zh-CN'); } catch { return timeStr; }
  };

  const getCategoryName = (key?: string) => categoryOptions.find(c => c.key === key)?.value || key || '未分类';

  const historyApi = {
    list: type === 'public' ? getPublicDocHistoryList : getDocumentHistoryList,
    detail: type === 'public' ? getPublicDocHistoryDetail : getDocumentHistoryDetail,
    restore: type === 'public' ? restorePublicDocHistory : restoreDocumentHistory,
  };

  const handleShowHistory = async () => {
    try {
      const res = await historyApi.list(doc.id);
      if (res.code === 200) {
        setHistoryList(Array.isArray(res.data) ? res.data : [res.data]);
        setShowHistory(true);
      }
    } catch (err) { toast.error('获取历史版本失败'); }
  };

  const handlePreview = async (item: DocHistoryItem) => {
    try {
      const res = await historyApi.detail(item.id);
      if (res.code === 200) setPreviewData({ ...res.data, version: item.version });
    } catch (err) { toast.error('获取版本详情失败'); }
  };

  const handleRestore = async (item: DocHistoryItem) => {
    if (!await confirm({ content: '确定要恢复到该版本吗？', type: 'warning' })) return;
    try {
      const res = await historyApi.restore(item.id);
      if (res.code === 200) { toast.success('恢复成功'); setShowHistory(false); onRefresh?.(); }
    } catch (err) { toast.error('恢复失败'); }
  };

  const handleDownload = () => {
    const blob = new Blob([doc.content || ''], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('下载成功');
  };

  const isShared = !!(doc as any).share;

  return (
    <div className="doc-view">
      {showHeader && (
        <div className="doc-header">
          <div className="header-top">
            <h2 className="doc-title">
              {doc.title}
              {isShared && (
                <span className="shared-badge" onMouseEnter={() => setShowShareTip(true)} onMouseLeave={() => setShowShareTip(false)}>
                  <Link size={12} /> 已分享 <Info size={12} />
                  {showShareTip && (
                    <span className="share-tooltip">
                      <p>分享码：{shareInfo?.share_code}</p>
                      <p className="share-url-line">
                        分享链接：{shareInfo?.share_url}
                        <button onClick={(e) => { e.stopPropagation(); handleCopyShareUrl(); }}><Copy size={12} /></button>
                      </p>
                      <p>剩余时间：{getRemainingTime(shareInfo?.expired_at)}</p>
                    </span>
                  )}
                </span>
              )}
            </h2>
          </div>
          <div className="doc-meta">
            <span className="meta-item"><User size={14} /> 创建人: {doc.creator || doc.user_name || '-'}</span>
            {doc.category && <span className="meta-item"><Tag size={14} /> 分类: {getCategoryName(doc.category)}</span>}
            <span className="meta-item"><Clock size={14} /> 更新时间: {formatTime(doc.updated_at)}</span>
            {(doc as any).version && <button className="version-btn" onClick={handleShowHistory}><History size={14} /> 版本: v{(doc as any).version}</button>}
            {onEdit && <button className="action-btn" onClick={onEdit}><Edit size={14} /> 编辑</button>}
            {type === 'public' && onShare && <button className="action-btn" onClick={onShare}><Share2 size={14} /> 分享</button>}
            <button className="action-btn" onClick={handleDownload}><Download size={14} /> 下载文档</button>
          </div>
        </div>
      )}
      <div className="doc-body">
        <div className="doc-content">{doc.content ? <MarkdownView content={doc.content} /> : <div className="doc-empty">暂无内容</div>}</div>
        {doc.content && <DocTocNav content={doc.content} contentSelector=".doc-content .markdown-view" containerSelector=".doc-content" />}
      </div>

      {showHistory && (
        <div className="modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="modal-content history-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>历史版本</h3><button onClick={() => setShowHistory(false)}>×</button></div>
            <div className="modal-body">
              <table className="history-table">
                <thead><tr><th>版本</th><th>修改时间</th><th>修改人</th><th>分类</th><th>操作</th></tr></thead>
                <tbody>
                  {historyList.map(h => (
                    <tr key={h.id}>
                      <td>v{h.version}</td><td>{h.created_at}</td><td>{h.user_name}</td><td>{getCategoryName(h.category)}</td>
                      <td><button onClick={() => handlePreview(h)}>预览</button><button onClick={() => handleRestore(h)}>恢复</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {previewData && (
        <div className="modal-overlay" onClick={() => setPreviewData(null)}>
          <div className="modal-content preview-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>版本预览 - v{previewData.version}</h3><button onClick={() => setPreviewData(null)}>×</button></div>
            <div className="modal-body"><MarkdownView content={previewData.content || ''} /></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocView;
