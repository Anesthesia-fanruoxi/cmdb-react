/**
 * ELFK 历史记录面板 - 本地历史 + 共享记录
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Search, Trash2, Clock, Users } from 'lucide-react';
import { getSharedKeywordList, deleteSharedKeyword, type SharedKeywordItem } from '../../../../services/elfk';
import EditSharedDialog from './EditSharedDialog';
import './HistoryPanel.css';

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
  onClose: () => void;
  onSelect: (keyword: string) => void;
  onAppend: (keyword: string) => void;
}

const LOCAL_HISTORY_KEY = 'elfk_search_history';
const MAX_LOCAL_HISTORY = 50;

// 读取本地历史
const loadLocalHistory = (): { keyword: string; time: string }[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]');
  } catch { return []; }
};

// 保存本地历史
export const saveLocalHistory = (keyword: string) => {
  if (!keyword.trim()) return;
  const history = loadLocalHistory().filter(h => h.keyword !== keyword);
  history.unshift({ keyword, time: new Date().toLocaleString() });
  localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_LOCAL_HISTORY)));
};

const HistoryPanel = ({ visible, projectInfo, viewId, viewName, onClose, onSelect, onAppend }: Props) => {
  const [activeTab, setActiveTab] = useState<'local' | 'shared'>('local');
  const [localHistory, setLocalHistory] = useState<{ keyword: string; time: string }[]>([]);
  const [sharedList, setSharedList] = useState<SharedKeywordItem[]>([]);
  const [sharedTotal, setSharedTotal] = useState(0);
  const [sharedPage, setSharedPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [editItem, setEditItem] = useState<SharedKeywordItem | null>(null);

  // 加载本地历史
  useEffect(() => {
    if (visible && activeTab === 'local') {
      setLocalHistory(loadLocalHistory());
    }
  }, [visible, activeTab]);

  // 加载共享记录
  const fetchSharedHistory = useCallback(async (page = 1, search = '') => {
    if (!projectInfo || !viewId) return;
    setLoading(true);
    try {
      const res = await getSharedKeywordList({
        project: projectInfo.project,
        category: projectInfo.category,
        view_id: viewId,
        search: search || undefined,
        page,
      });
      if (res.code === 200 && res.data) {
        setSharedList(res.data.list || []);
        setSharedTotal(res.data.total || 0);
        setSharedPage(page);
      }
    } catch (err) {
      console.error('获取共享记录失败:', err);
    } finally {
      setLoading(false);
    }
  }, [projectInfo, viewId]);

  useEffect(() => {
    if (visible && activeTab === 'shared' && projectInfo && viewId) {
      fetchSharedHistory(1, searchText);
    }
  }, [visible, activeTab, projectInfo, viewId]);

  // 搜索
  const handleSearch = () => {
    if (activeTab === 'local') {
      const all = loadLocalHistory();
      setLocalHistory(searchText ? all.filter(h => h.keyword.includes(searchText)) : all);
    } else {
      fetchSharedHistory(1, searchText);
    }
  };

  // 清空本地历史
  const handleClearLocal = () => {
    localStorage.removeItem(LOCAL_HISTORY_KEY);
    setLocalHistory([]);
  };

  // 删除共享记录
  const handleDeleteShared = async (id: number) => {
    try {
      await deleteSharedKeyword(id);
      fetchSharedHistory(sharedPage, searchText);
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <>
      <div className="history-panel-overlay" onClick={onClose} />
      <div className="history-panel">
        <div className="history-panel-header">
          <h3>历史记录</h3>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* 标签页 */}
        <div className="history-tabs">
          <button className={`tab-btn ${activeTab === 'local' ? 'active' : ''}`} onClick={() => setActiveTab('local')}>
            <Clock size={14} /> 本地历史
          </button>
          <button className={`tab-btn ${activeTab === 'shared' ? 'active' : ''}`} onClick={() => setActiveTab('shared')}>
            <Users size={14} /> 共享记录
          </button>
        </div>

        {/* 搜索框 */}
        <div className="history-search">
          <input
            type="text"
            placeholder={activeTab === 'local' ? '搜索本地历史...' : '搜索关键字/创建人/备注...'}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch}><Search size={16} /></button>
        </div>

        {/* 列表内容 */}
        <div className="history-content">
          {activeTab === 'local' ? (
            <LocalHistoryList
              list={localHistory}
              onSelect={onSelect}
              onAppend={onAppend}
              onClear={handleClearLocal}
            />
          ) : (
            <SharedHistoryList
              list={sharedList}
              total={sharedTotal}
              page={sharedPage}
              loading={loading}
              viewName={viewName}
              onSelect={onSelect}
              onDelete={handleDeleteShared}
              onEdit={setEditItem}
              onPageChange={(p) => fetchSharedHistory(p, searchText)}
            />
          )}
        </div>

        {/* 编辑共享记录弹框 */}
        <EditSharedDialog
          visible={!!editItem}
          item={editItem}
          onClose={() => setEditItem(null)}
          onSuccess={() => fetchSharedHistory(sharedPage, searchText)}
        />
      </div>
    </>
  );
};

// 本地历史列表
const LocalHistoryList = ({ list, onSelect, onAppend, onClear }: {
  list: { keyword: string; time: string }[];
  onSelect: (k: string) => void;
  onAppend: (k: string) => void;
  onClear: () => void;
}) => (
  <div className="local-history">
    {list.length > 0 && (
      <div className="list-header">
        <span>{list.length} 条记录</span>
        <button onClick={onClear}><Trash2 size={14} /> 清空</button>
      </div>
    )}
    {list.length === 0 ? (
      <div className="empty-tip">暂无本地历史记录</div>
    ) : (
      <ul className="history-list">
        {list.map((item, idx) => (
          <li key={idx} className="history-item">
            <div className="item-content" onClick={() => onSelect(item.keyword)}>
              <span className="item-keyword">{item.keyword}</span>
              <span className="item-time">{item.time}</span>
            </div>
            <button className="btn-append" onClick={() => onAppend(item.keyword)}>追加</button>
          </li>
        ))}
      </ul>
    )}
  </div>
);

// 共享记录列表
const SharedHistoryList = ({ list, total, page, loading, viewName, onSelect, onDelete, onEdit, onPageChange }: {
  list: SharedKeywordItem[];
  total: number;
  page: number;
  loading: boolean;
  viewName: string;
  onSelect: (k: string) => void;
  onDelete: (id: number) => void;
  onEdit: (item: SharedKeywordItem) => void;
  onPageChange: (p: number) => void;
}) => {
  const totalPages = Math.ceil(total / 20);
  
  return (
    <div className="shared-history">
      <div className="list-header">
        <span>视图: {viewName} | 共 {total} 条</span>
      </div>
      {loading ? (
        <div className="loading-tip">加载中...</div>
      ) : list.length === 0 ? (
        <div className="empty-tip">暂无共享记录</div>
      ) : (
        <>
          <ul className="history-list">
            {list.map(item => (
              <li key={item.id} className="history-item shared">
                <div className="item-content" onClick={() => onSelect(item.keyword)}>
                  {item.remark && <span className="item-remark">{item.remark}</span>}
                  <span className="item-keyword">{item.keyword}</span>
                  <div className="item-meta">
                    <span className="item-creator">{item.creator}</span>
                    <span className="item-time">{item.created_at?.split('T')[0]}</span>
                  </div>
                </div>
                <div className="item-actions">
                  <button className="btn-edit" onClick={() => onEdit(item)} title="编辑">✏️</button>
                  <button className="btn-delete" onClick={() => onDelete(item.id)} title="删除"><Trash2 size={14} /></button>
                </div>
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>上一页</button>
              <span>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>下一页</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HistoryPanel;
