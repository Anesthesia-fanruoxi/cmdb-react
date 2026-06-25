/**
 * 内部文档页面
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { FileText, Plus, Edit, Trash2, Search, Upload, User, Clock } from 'lucide-react';
import { getDocumentList, getDocumentDetail, deleteDocument, getDocProjects, DocItem, ProjectOption } from '../../../services/knowledge';
import { getDictDetail } from '../../../services/system/dict';
import type { DictItem } from '../../../services/system/dict';
import toast from '../../../components/Toast';
import { confirm } from '../../../components/ConfirmModal';
import DocForm from '../components/DocForm';
import DocView from '../components/DocView';
import UploadDialog from './components/UploadDialog';
import './index.css';

const DocumentKnowledge = () => {
  const [loading, setLoading] = useState(false);
  const [docList, setDocList] = useState<DocItem[]>([]);
  const [currentDoc, setCurrentDoc] = useState<DocItem | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocItem | null>(null);
  
  // 选项数据
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<DictItem[]>([]);

  // 获取项目和分类选项
  const fetchOptions = useCallback(async () => {
    try {
      const [projectRes, categoryRes] = await Promise.all([
        getDocProjects(),
        getDictDetail('knowledge')
      ]);
      if (projectRes.code === 200 && projectRes.data) {
        const items = Array.isArray(projectRes.data) ? projectRes.data : (projectRes.data as any).items || [];
        setProjectOptions(items);
      }
      if (categoryRes.code === 200 && categoryRes.data?.items) {
        setCategoryOptions(categoryRes.data.items);
      }
    } catch (err) {
      console.error('获取选项失败:', err);
    }
  }, []);

  const fetchDocList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDocumentList();
      if (res.code === 200 && res.data) {
        setDocList(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      toast.error('获取文档列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDocDetail = useCallback(async (doc: DocItem) => {
    try {
      const res = await getDocumentDetail(doc.id);
      if (res.code === 200 && res.data) {
        setCurrentDoc({ ...res.data, creator: res.data.user_name });
      }
    } catch (err) {
      toast.error('获取文档详情失败');
    }
  }, []);

  useEffect(() => { fetchDocList(); fetchOptions(); }, []);

  // 过滤后的文档列表
  const filteredList = useMemo(() => {
    return docList.filter(doc => {
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const match = doc.title?.toLowerCase().includes(kw) || doc.creator?.toLowerCase().includes(kw);
        if (!match) return false;
      }
      if (filterProject && (doc as any).project !== filterProject) return false;
      if (filterCategory && doc.category !== filterCategory) return false;
      return true;
    });
  }, [docList, searchKeyword, filterProject, filterCategory]);

  const handleSelect = (doc: DocItem) => fetchDocDetail(doc);
  const handleAdd = () => { setEditingDoc(null); setShowForm(true); };

  const handleEdit = async (doc: DocItem) => {
    try {
      const res = await getDocumentDetail(doc.id);
      if (res.code === 200 && res.data) { setEditingDoc(res.data); setShowForm(true); }
    } catch (err) { toast.error('获取文档详情失败'); }
  };

  const handleDelete = async (doc: DocItem) => {
    if (!await confirm({ content: '确认要删除该文档吗？删除后可在回收站恢复', type: 'danger' })) return;
    try {
      const res = await deleteDocument(doc.id);
      if (res.code === 200) {
        toast.success('删除成功');
        if (currentDoc?.id === doc.id) setCurrentDoc(null);
        fetchDocList();
      }
    } catch (err) { toast.error('删除失败'); }
  };

  const handleFormSuccess = async (doc: DocItem) => {
    setShowForm(false);
    await fetchDocList();
    if (doc.id) { fetchDocDetail(doc); }
  };

  const handleUploadSuccess = async (doc: DocItem) => {
    setShowUpload(false);
    await fetchDocList();
    if (doc.id) { fetchDocDetail(doc); }
  };

  const handleRefresh = () => {
    fetchDocList();
    if (currentDoc) fetchDocDetail(currentDoc);
  };

  return (
    <div className="knowledge-page document-page">
      <div className="sidebar">
        <div className="action-bar">
          <button className="btn-primary" onClick={handleAdd}><Plus size={14} /> 新建文档</button>
          <button className="btn-info" onClick={() => setShowUpload(true)}><Upload size={14} /> 上传文件</button>
        </div>
        
        <div className="filter-section">
          <div className="search-box">
            <Search size={14} />
            <input type="text" value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} placeholder="搜索文档" />
          </div>
          <div className="filter-row">
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)}>
              <option value="">选择项目</option>
              {projectOptions.map(p => <option key={p.project} value={p.project}>{p.project_name}</option>)}
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">选择分类</option>
              {categoryOptions.map(c => <option key={c.key} value={c.key}>{c.value}</option>)}
            </select>
          </div>
        </div>

        <div className="doc-list" data-loading={loading}>
          {filteredList.map(doc => (
            <div key={doc.id} className={`doc-item ${currentDoc?.id === doc.id ? 'active' : ''}`} onClick={() => handleSelect(doc)}>
              <div className="doc-info">
                <div className="doc-title"><FileText size={14} /> {doc.title}</div>
                <div className="doc-meta">
                  <span><User size={12} /> {doc.creator || doc.user_name}</span>
                  <span><Clock size={12} /> {doc.updated_at}</span>
                </div>
              </div>
              <div className="doc-actions">
                <button onClick={e => { e.stopPropagation(); handleEdit(doc); }}><Edit size={14} /></button>
                <button onClick={e => { e.stopPropagation(); handleDelete(doc); }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {filteredList.length === 0 && !loading && <div className="empty-list">暂无文档</div>}
        </div>
      </div>

      <div className="content">
        {currentDoc ? (
          <DocView doc={currentDoc} onEdit={() => handleEdit(currentDoc)} onRefresh={handleRefresh} categoryOptions={categoryOptions} showHeader />
        ) : (
          <div className="empty-content">请选择或创建一个文档</div>
        )}
      </div>

      <DocForm visible={showForm} doc={editingDoc} onClose={() => setShowForm(false)} onSuccess={handleFormSuccess} type="document" projectOptions={projectOptions} categoryOptions={categoryOptions} />
      <UploadDialog visible={showUpload} onClose={() => setShowUpload(false)} onSuccess={handleUploadSuccess} projectOptions={projectOptions} categoryOptions={categoryOptions} />
    </div>
  );
};

export default DocumentKnowledge;