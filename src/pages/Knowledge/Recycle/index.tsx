/**
 * 回收站页面
 */

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { getRecycleList, restoreDoc, removeDoc, RecycleDocItem } from '../../../services/knowledge';
import toast from '../../../components/Toast';
import './index.css';

type DocType = 'doc' | 'personal' | 'public';

const RecycleKnowledge = () => {
  const [loading, setLoading] = useState(false);
  const [docType, setDocType] = useState<DocType>('doc');
  const [documents, setDocuments] = useState<RecycleDocItem[]>([]);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRecycleList(docType);
      if (res.code === 200 && res.data) {
        setDocuments(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      toast.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  }, [docType]);

  useEffect(() => { fetchDocuments(); }, [docType]);

  const handleRestore = async (doc: RecycleDocItem) => {
    if (!confirm('确定要恢复该文档吗？')) return;
    try {
      const res = await restoreDoc({ id: doc.id, type: docType });
      if (res.code === 200) {
        toast.success('恢复成功');
        fetchDocuments();
      }
    } catch (err) {
      toast.error('恢复失败');
    }
  };

  const handleRemove = async (doc: RecycleDocItem) => {
    if (!confirm('彻底删除后将无法恢复，是否继续？')) return;
    try {
      const res = await removeDoc(doc.id, docType);
      if (res.code === 200) {
        toast.success('删除成功');
        fetchDocuments();
      }
    } catch (err) {
      toast.error('删除失败');
    }
  };

  const formatTime = (timeStr?: string): string => {
    if (!timeStr) return '-';
    try {
      return new Date(timeStr).toLocaleString('zh-CN');
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="recycle-page">
      <div className="recycle-header">
        <div className="type-tabs">
          <button className={docType === 'doc' ? 'active' : ''} onClick={() => setDocType('doc')}>
            公共文档
          </button>
          <button className={docType === 'personal' ? 'active' : ''} onClick={() => setDocType('personal')}>
            个人文档
          </button>
          <button className={docType === 'public' ? 'active' : ''} onClick={() => setDocType('public')}>
            公开文档
          </button>
        </div>
        <button className="btn-icon" onClick={fetchDocuments} title="刷新">
          <RefreshCw size={14} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      <div className="recycle-content">
        {loading ? (
          <div className="loading-state">加载中...</div>
        ) : documents.length === 0 ? (
          <div className="empty-state">暂无数据</div>
        ) : (
          <table className="recycle-table">
            <thead>
              <tr>
                <th>标题</th>
                {docType !== 'personal' && <th>分类</th>}
                <th>操作人</th>
                <th>删除时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {documents.map(doc => (
                <tr key={doc.id}>
                  <td className="doc-title">{doc.title}</td>
                  {docType !== 'personal' && <td>{doc.category || '-'}</td>}
                  <td>{doc.deleter_name || doc.user_name || '-'}</td>
                  <td>{formatTime(doc.deleted_at)}</td>
                  <td className="actions">
                    <button className="btn-restore" onClick={() => handleRestore(doc)}>
                      <RotateCcw size={14} />
                      恢复
                    </button>
                    <button className="btn-remove" onClick={() => handleRemove(doc)}>
                      <Trash2 size={14} />
                      彻底删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default RecycleKnowledge;
