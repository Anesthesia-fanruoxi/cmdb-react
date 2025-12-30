/**
 * 文档查看组件
 */

import { useState } from 'react';
import { User, Clock, Edit, History, Tag, Download, Share2, Link } from 'lucide-react';
import { DocItem, getDocumentHistoryList, getDocumentHistoryDetail, restoreDocumentHistory, DocHistoryItem } from '../../../services/knowledge';
import type { DictItem } from '../../../services/system/dict';
import MarkdownView from '../../../components/Markdown';
import DocTocNav from './DocTocNav';
import toast from '../../../components/Toast';
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

  const formatTime = (timeStr?: string): string => {
    if (!timeStr) return '-';
    try { return new Date(timeStr).toLocaleString('zh-CN'); } catch { return timeStr; }
  };

  const getCategoryName = (key?: string) => categoryOptions.find(c => c.key === key)?.value || key || '未分类';

  const handleShowHistory = async () => {
    try {
      const res = await getDocumentHistoryList(doc.id);
      if (res.code === 200) {
        setHistoryList(Array.isArray(res.data) ? res.data : [res.data]);
        setShowHistory(true);
      }
    } catch (err) { toast.error('获取历史版本失败'); }
  };

  const handlePreview = async (item: DocHistoryItem) => {
    try {
      const res = await getDocumentHistoryDetail(item.id);
      if (res.code === 200) setPreviewData({ ...res.data, version: item.version });
    } catch (err) { toast.error('获取版本详情失败'); }
  };

  const handleRestore = async (item: DocHistoryItem) => {
    if (!confirm('确定要恢复到该版本吗？')) return;
    try {
      const res = await restoreDocumentHistory(item.id);
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
              {isShared && <span className="shared-badge"><Link size={12} /> 已分享</span>}
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
