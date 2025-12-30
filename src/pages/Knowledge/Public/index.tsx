/**
 * 公开知识库页面
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { FileText, Plus, Edit, Trash2, Search, Upload, User, Clock, Share2, Link } from 'lucide-react';
import { getPublicDocList, getPublicDocDetail, deletePublicDoc, DocItem } from '../../../services/knowledge';
import { getDictDetail } from '../../../services/system/dict';
import type { DictItem } from '../../../services/system/dict';
import toast from '../../../components/Toast';
import DocForm from '../components/DocForm';
import DocView from '../components/DocView';
import ShareDialog from './components/ShareDialog';
import UploadDialog from './components/UploadDialog';
import './index.css';

const PublicKnowledge = () => {
  const [loading, setLoading] = useState(false);
  const [docList, setDocList] = useState<DocItem[]>([]);
  const [currentDoc, setCurrentDoc] = useState<DocItem | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'shared'>('all');
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocItem | null>(null);
  const [sharingDoc, setSharingDoc] = useState<DocItem | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<DictItem[]>([]);
  const [onlyMine, setOnlyMine] = useState(false);

  const fetchOptions = useCallback(async () => {
    try {
      const res = await getDictDetail('sys_category_dict');
      if (res.code === 200 && res.data?.items) setCategoryOptions(res.data.items);
    } catch (err) { console.error('获取分类失败:', err); }
  }, []);

  const fetchDocList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPublicDocList({ category: filterCategory || undefined });
      if (res.code === 200 && res.data) setDocList(Array.isArray(res.data) ? res.data : []);
    } catch (err) { toast.error('获取文档列表失败'); }
    finally { setLoading(false); }
  }, [filterCategory]);

  const fetchDocDetail = useCallback(async (doc: DocItem) => {
    try {
      const res = await getPublicDocDetail(doc.id);
      if (res.code === 200 && res.data) setCurrentDoc({ ...res.data, creator: res.data.user_name });
    } catch (err) { toast.error('获取文档详情失败'); }
  }, []);

  useEffect(() => { fetchDocList(); fetchOptions(); }, [fetchDocList]);

  const filteredList = useMemo(() => {
    return docList.filter(doc => {
      if (viewMode === 'shared' && !doc.share) return false;
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        if (!doc.title?.toLowerCase().includes(kw) && !doc.creator?.toLowerCase().includes(kw)) return false;
      }
      return true;
    });
  }, [docList, searchKeyword, viewMode]);

  const handleSelect = (doc: DocItem) => fetchDocDetail(doc);
  const handleAdd = () => { setEditingDoc(null); setShowForm(true); };

  const handleEdit = async (doc: DocItem) => {
    try {
      const res = await getPublicDocDetail(doc.id);
      if (res.code === 200 && res.data) { setEditingDoc(res.data); setShowForm(true); }
    } catch (err) { toast.error('获取文档详情失败'); }
  };

  const handleDelete = async (doc: DocItem) => {
    if (!confirm('确认要删除该文档吗？')) return;
    try {
      const res = await deletePublicDoc(doc.id);
      if (res.code === 200) {
        toast.success('删除成功');
        if (currentDoc?.id === doc.id) setCurrentDoc(null);
        fetchDocList();
      }
    } catch (err) { toast.error('删除失败'); }
  };

  const handleShare = (doc: DocItem) => { setSharingDoc(doc); setShowShare(true); };

  const handleFormSuccess = async (doc: DocItem) => {
    setShowForm(false);
    await fetchDocList();
    if (doc.id) fetchDocDetail(doc);
  };

  const handleUploadSuccess = async (doc: DocItem) => {
    setShowUpload(false);
    await fetchDocList();
    if (doc.id) fetchDocDetail(doc);
  };

  const handleShareSuccess = () => { setShowShare(false); fetchDocList(); if (currentDoc) fetchDocDetail(currentDoc); };
  const handleRefresh = () => { fetchDocList(); if (currentDoc) fetchDocDetail(currentDoc); };

  return (
    <div className="knowledge-page public-page">
      <div className="sidebar">
        <div className="filter-section">
          <div className="search-row">
            <div className="search-box">
              <Search size={14} />
              <input type="text" value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} placeholder="搜索文档" />
            </div>
            <button className="btn-upload" onClick={() => setShowUpload(true)}><Upload size={16} /></button>
          </div>
          <div className="filter-row">
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">选择分类</option>
              {categoryOptions.map(c => <option key={c.key} value={c.key}>{c.value}</option>)}
            </select>
            <label className="switch-label">
              <span className={`switch ${onlyMine ? 'on' : ''}`} onClick={() => setOnlyMine(!onlyMine)}><span className="switch-dot" /></span>
              <span>只看自己</span>
            </label>
          </div>
          <div className="action-row">
            <button className="btn-primary" onClick={handleAdd}><Plus size={14} /> 新建文档</button>
            <div className="view-tabs">
              <button className={viewMode === 'all' ? 'active' : ''} onClick={() => setViewMode('all')}>全部</button>
              <button className={viewMode === 'shared' ? 'active' : ''} onClick={() => setViewMode('shared')}>已分享</button>
            </div>
          </div>
        </div>

        <div className="doc-list" data-loading={loading}>
          {filteredList.map(doc => (
            <div key={doc.id} className={`doc-item ${currentDoc?.id === doc.id ? 'active' : ''}`} onClick={() => handleSelect(doc)}>
              <div className="doc-info">
                <div className="doc-title">
                  <FileText size={14} />
                  <span>{doc.title}</span>
                  {doc.share && <span className="share-badge"><Link size={10} /></span>}
                </div>
                <div className="doc-meta">
                  <span><User size={12} /> {doc.creator || doc.user_name}</span>
                  <span><Clock size={12} /> {doc.updated_at}</span>
                </div>
              </div>
              <div className="doc-actions">
                <button onClick={e => { e.stopPropagation(); handleShare(doc); }} title="分享"><Share2 size={14} /></button>
                <button onClick={e => { e.stopPropagation(); handleEdit(doc); }} title="编辑"><Edit size={14} /></button>
                <button onClick={e => { e.stopPropagation(); handleDelete(doc); }} title="删除"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {filteredList.length === 0 && !loading && <div className="empty-list">暂无文档</div>}
        </div>
      </div>

      <div className="content">
        {currentDoc ? (
          <DocView doc={currentDoc} onEdit={() => handleEdit(currentDoc)} onRefresh={handleRefresh} onShare={() => handleShare(currentDoc)} categoryOptions={categoryOptions} showHeader type="public" />
        ) : (
          <div className="empty-content">请选择或创建一个文档</div>
        )}
      </div>

      <DocForm visible={showForm} doc={editingDoc} onClose={() => setShowForm(false)} onSuccess={handleFormSuccess} type="public" categoryOptions={categoryOptions} />
      <UploadDialog visible={showUpload} onClose={() => setShowUpload(false)} onSuccess={handleUploadSuccess} categoryOptions={categoryOptions} />
      <ShareDialog visible={showShare} doc={sharingDoc} onClose={() => setShowShare(false)} onSuccess={handleShareSuccess} />
    </div>
  );
};

export default PublicKnowledge;