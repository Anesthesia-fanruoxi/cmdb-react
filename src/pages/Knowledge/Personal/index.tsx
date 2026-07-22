/**
 * 个人知识库页面
 */

import { useEffect, useState, useCallback } from 'react';
import { FileText, Plus, Edit, Trash2, Search, RefreshCw, X, BookOpen, FilePlus2, Clock, Sparkles } from 'lucide-react';
import { getPersonalDocList, getPersonalDocDetail, deletePersonalDoc, DocItem } from '../../../services/knowledge';
import { getDictDetail, DictItem } from '../../../services/system/dict';
import toast from '../../../components/Toast';
import { confirm } from '../../../components/ConfirmModal';
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
  const [recentDocIds, setRecentDocIds] = useState<Set<number>>(new Set());
  const [categoryOptions, setCategoryOptions] = useState<DictItem[]>([]);

  // 加载分类字典（与 Vue 实现保持一致）
  const fetchCategories = useCallback(async () => {
    try {
      const res = await getDictDetail('knowledge');
      if (res.code === 200 && res.data?.items) {
        setCategoryOptions(res.data.items);
      }
    } catch {
      toast.error('获取分类字典失败');
    }
  }, []);

  // 获取文档列表
  const fetchDocList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPersonalDocList();
      if (res.code === 200 && res.data) {
        const newList = Array.isArray(res.data) ? res.data : [];
        // 检测新增的文档
        if (docList.length > 0) {
          const oldIds = new Set(docList.map(d => d.id));
          const newIds = new Set(newList.filter(d => !oldIds.has(d.id)).map(d => d.id));
          if (newIds.size > 0) {
            setRecentDocIds(prev => new Set([...prev, ...newIds]));
            // 3秒后移除新增标记
            setTimeout(() => {
              setRecentDocIds(prev => {
                const next = new Set(prev);
                newIds.forEach(id => next.delete(id));
                return next;
              });
            }, 3000);
          }
        }
        setDocList(newList);
      }
    } catch (err) {
      toast.error('获取文档列表失败');
    } finally {
      setLoading(false);
    }
  }, [docList]);

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
    fetchCategories();
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
    if (!await confirm({ content: '确认要删除该文档吗？', type: 'danger' })) return;
    
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

  // 刷新当前文档
  const handleRefresh = () => {
    fetchDocList();
    if (currentDoc) fetchDocDetail(currentDoc);
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

  // 格式化时间
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    try {
      const date = new Date(timeStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return '刚刚';
      if (diffMin < 60) return `${diffMin} 分钟前`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour} 小时前`;
      const diffDay = Math.floor(diffHour / 24);
      if (diffDay < 7) return `${diffDay} 天前`;
      return date.toLocaleDateString('zh-CN');
    } catch {
      return timeStr;
    }
  };

  // 过滤文档列表
  const filteredList = docList.filter(doc => {
    if (!searchKeyword.trim()) return true;
    return doc.title.toLowerCase().includes(searchKeyword.toLowerCase());
  });

  return (
    <div className="knowledge-page personal-kb-page">
      {/* 左侧边栏 */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="header-title-row">
            <h3 className="sidebar-title">
              <BookOpen size={16} />
              个人文档
            </h3>
            <div className="header-stats">
              <span className="doc-count">{docList.length} 篇</span>
            </div>
          </div>
          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              placeholder="搜索文档标题..."
            />
            {searchKeyword && (
              <button className="search-clear" onClick={() => setSearchKeyword('')}>
                <X size={12} />
              </button>
            )}
          </div>
          <div className="header-actions">
            <button className="btn-icon" onClick={fetchDocList} title="刷新列表" disabled={loading}>
              <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            </button>
            <button className="btn-primary flex-1" onClick={handleAdd}>
              <Plus size={14} />
              新建文档
            </button>
          </div>
        </div>

        <div className="doc-list" data-loading={loading}>
          {loading && docList.length === 0 ? (
            <div className="loading-skeleton">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton-item" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="skeleton-icon" />
                  <div className="skeleton-text">
                    <div className="skeleton-line long" />
                    <div className="skeleton-line short" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {filteredList.map((doc, index) => (
                <div
                  key={doc.id}
                  className={`doc-item ${currentDoc?.id === doc.id ? 'active' : ''} ${recentDocIds.has(doc.id) ? 'recent' : ''}`}
                  onClick={() => handleSelect(doc)}
                  style={{ animationDelay: `${index * 0.03}s` }}
                >
                  <div className="doc-item-icon">
                    <FileText size={16} />
                  </div>
                  <div className="doc-item-info">
                    <span className="title">
                      {doc.title}
                      {recentDocIds.has(doc.id) && (
                        <span className="new-badge">
                          <Sparkles size={10} />
                          NEW
                        </span>
                      )}
                    </span>
                    <span className="time">
                      <Clock size={10} />
                      {formatTime(doc.updated_at)}
                    </span>
                  </div>
                  <div className="actions">
                    <button onClick={e => { e.stopPropagation(); handleEdit(doc); }} title="编辑" className="btn-edit">
                      <Edit size={14} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(doc); }} title="删除" className="btn-danger">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {filteredList.length === 0 && !loading && (
                <div className="empty-list">
                  {searchKeyword ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <Search size={28} strokeWidth={1.5} />
                      </div>
                      <p className="empty-title">未找到匹配文档</p>
                      <p className="empty-hint">尝试使用其他关键词搜索</p>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <FilePlus2 size={28} strokeWidth={1.5} />
                      </div>
                      <p className="empty-title">还没有文档</p>
                      <p className="empty-hint">创建你的第一个个人文档</p>
                      <button className="empty-add-btn" onClick={handleAdd}>
                        <Plus size={14} />
                        立即创建
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 右侧内容区 */}
      <div className="content">
        {currentDoc ? (
          <DocView 
            doc={currentDoc} 
            onEdit={() => handleEdit(currentDoc)} 
            onRefresh={handleRefresh}
            showHeader 
            type="personal" 
          />
        ) : (
          <div className="empty-content">
            <div className="empty-content-inner">
              <div className="empty-content-visual">
                <div className="visual-circle c1" />
                <div className="visual-circle c2" />
                <div className="visual-circle c3" />
                <FileText size={40} strokeWidth={1.2} className="visual-icon" />
              </div>
              <h3>选择或创建文档</h3>
              <p>从左侧列表选择一个文档查看详情，<br />或创建新文档开始记录你的想法</p>
              <button className="empty-content-btn" onClick={handleAdd}>
                <Plus size={16} />
                新建文档
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 文档表单 */}
      <DocForm
        visible={showForm}
        doc={editingDoc}
        onClose={() => setShowForm(false)}
        onSuccess={handleFormSuccess}
        type="personal"
        categoryOptions={categoryOptions}
      />
    </div>
  );
};

export default PersonalKnowledge;
