/**
 * 个人知识库页面
 */

import { useEffect, useState, useCallback } from 'react';
import { FileText, Plus, Edit, Trash2, Search, RefreshCw } from 'lucide-react';
import { getPersonalDocList, getPersonalDocDetail, deletePersonalDoc, DocItem } from '../../../services/knowledge';
import toast from '../../../components/Toast';
import DocForm from '../components/DocForm';
import DocView from '../components/DocView';
import './index.css';

const PersonalKnowledge = () => {
  const [loading, setLoading] = useState(false);
  const [docList, setDocList] = useState<DocItem[]>([]);
  const [currentDoc, setCurrentDoc] = useState<DocItem | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocItem | null>(null);

  // 获取文档列表
  const fetchDocList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPersonalDocList();
      if (res.code === 200 && res.data) {
        setDocList(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      toast.error('获取文档列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取文档详情
  const fetchDocDetail = useCallback(async (doc: DocItem) => {
    try {
      const res = await getPersonalDocDetail(doc.id);
      if (res.code === 200 && res.data) {
        setCurrentDoc({
          ...res.data,
          creator: res.data.user_name
        });
      }
    } catch (err) {
      toast.error('获取文档详情失败');
    }
  }, []);

  useEffect(() => {
    fetchDocList();
  }, []);

  // 选择文档
  const handleSelect = (doc: DocItem) => {
    fetchDocDetail(doc);
  };

  // 新建文档
  const handleAdd = () => {
    setEditingDoc(null);
    setShowForm(true);
  };

  // 编辑文档
  const handleEdit = async (doc: DocItem) => {
    try {
      const res = await getPersonalDocDetail(doc.id);
      if (res.code === 200 && res.data) {
        setEditingDoc(res.data);
        setShowForm(true);
      }
    } catch (err) {
      toast.error('获取文档详情失败');
    }
  };

  // 删除文档
  const handleDelete = async (doc: DocItem) => {
    if (!confirm('确认要删除该文档吗？')) return;
    
    try {
      const res = await deletePersonalDoc(doc.id);
      if (res.code === 200) {
        toast.success('删除成功');
        if (currentDoc?.id === doc.id) {
          setCurrentDoc(null);
        }
        fetchDocList();
      }
    } catch (err) {
      toast.error('删除失败');
    }
  };

  // 表单提交成功
  const handleFormSuccess = async (doc: DocItem) => {
    setShowForm(false);
    await fetchDocList();
    // 如果是编辑当前文档，刷新详情
    if (doc.id && currentDoc?.id === doc.id) {
      fetchDocDetail(doc);
    }
  };

  // 过滤文档列表
  const filteredList = docList.filter(doc => {
    if (!searchKeyword.trim()) return true;
    return doc.title.toLowerCase().includes(searchKeyword.toLowerCase());
  });

  return (
    <div className="knowledge-page">
      {/* 左侧边栏 */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              placeholder="搜索文档"
            />
          </div>
          <div className="header-actions">
            <button className="btn-icon" onClick={fetchDocList} title="刷新">
              <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            </button>
            <button className="btn-primary flex-1" onClick={handleAdd}>
              <Plus size={14} />
              新建文档
            </button>
          </div>
        </div>

        <div className="doc-list" data-loading={loading}>
          {filteredList.map(doc => (
            <div
              key={doc.id}
              className={`doc-item ${currentDoc?.id === doc.id ? 'active' : ''}`}
              onClick={() => handleSelect(doc)}
            >
              <FileText size={16} />
              <span className="title">{doc.title}</span>
              <div className="actions">
                <button onClick={e => { e.stopPropagation(); handleEdit(doc); }}>
                  <Edit size={14} />
                </button>
                <button onClick={e => { e.stopPropagation(); handleDelete(doc); }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {filteredList.length === 0 && !loading && (
            <div className="empty-list">暂无文档</div>
          )}
        </div>
      </div>

      {/* 右侧内容区 */}
      <div className="content">
        {currentDoc ? (
          <DocView doc={currentDoc} />
        ) : (
          <div className="empty-content">请选择或创建一个文档</div>
        )}
      </div>

      {/* 文档表单 */}
      <DocForm
        visible={showForm}
        doc={editingDoc}
        onClose={() => setShowForm(false)}
        onSuccess={handleFormSuccess}
        type="personal"
      />
    </div>
  );
};

export default PersonalKnowledge;
