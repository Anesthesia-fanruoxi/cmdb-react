/**
 * 文档查看组件
 */

import { User, Clock } from 'lucide-react';
import { DocItem } from '../../../services/knowledge';
import MarkdownView from '../../../components/Markdown';
import './DocView.css';

interface DocViewProps {
  doc: DocItem;
}

const DocView = ({ doc }: DocViewProps) => {
  // 格式化时间
  const formatTime = (timeStr?: string): string => {
    if (!timeStr) return '-';
    try {
      const date = new Date(timeStr);
      return date.toLocaleString('zh-CN');
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="doc-view">
      {/* 文档头部 */}
      <div className="doc-header">
        <h2 className="doc-title">{doc.title}</h2>
        <div className="doc-meta">
          {doc.category && (
            <span className="category-tag">{doc.category}</span>
          )}
          <span className="meta-item">
            <User size={14} />
            创建人：{doc.creator || doc.user_name || '-'}
          </span>
          <span className="meta-item">
            <Clock size={14} />
            更新时间：{formatTime(doc.updated_at)}
          </span>
        </div>
      </div>

      {/* 文档内容 */}
      <div className="doc-content">
        {doc.content ? (
          <MarkdownView content={doc.content} />
        ) : (
          <div className="doc-empty">暂无内容</div>
        )}
      </div>
    </div>
  );
};

export default DocView;
