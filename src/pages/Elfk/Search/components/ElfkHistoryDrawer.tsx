/**
 * ELFK 历史记录抽屉 - 右侧侧边栏，本地历史 + 共享记录 + 个人收藏
 * 与 SqlHistoryPanel 一致的交互体验
 */

import { useState, useEffect, useCallback } from 'react';
import { Trash2, Edit2, Clock, Users, Star } from 'lucide-react';
import {
  getSharedKeywordList,
  deleteSharedKeyword,
  type SharedKeywordItem,
} from '../../../../services/elfk';
import EditSharedDialog from './EditSharedDialog';
import './ElfkHistoryDrawer.css';

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

// 清空本地历史
export const clearLocalHistory = () => {
  localStorage.removeItem(LOCAL_HISTORY_KEY);
};

// 保存本地历史
export const saveLocalHistory = (keyword: string) => {
  if (!keyword.trim()) return;
  const history = loadLocalHistory().filter(h => h.keyword !== keyword);
  history.unshift({ keyword, time: new Date().toLocaleString() });
  localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_LOCAL_HISTORY)));
};

const ElfkHistoryDrawer = ({ visible, projectInfo, viewId, onClose, onSelect, onAppend }: Props) => {
  const [activeTab, setActiveTab] = useState<'local' | 'shared' | 'favorite'>('local');
  const [localHistory, setLocalHistory] = useState<{ keyword: string; time: string }[]>([]);
  const [sharedList, setSharedList] = useState<SharedKeywordItem[]>([]);
  const [sharedTotal, setSharedTotal] = useState(0);
  const [sharedPage, setSharedPage] = useState(1);
  const [favoriteList, setFavoriteList] = useState<SharedKeywordItem[]>([]);
  const [favoriteTotal, setFavoriteTotal] = useState(0);
  const [favoritePage, setFavoritePage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [editItem, setEditItem] = useState<SharedKeywordItem | null>(null);

  const PAGE_SIZE = 100;

  // ESC 键关闭：优先关闭编辑弹框，其次关闭抽屉
  useEffect(() => {
    if (!visible) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        if (editItem) {
          setEditItem(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [visible, editItem, onClose]);

  // 加载本地历史
  useEffect(() => {
    if (visible && activeTab === 'local') {
      setLocalHistory(loadLocalHistory());
    }
  }, [visible, activeTab]);

  // 加载共享记录
  const fetchShared = useCallback(async (page = 1, search = '') => {
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

  // 加载个人收藏
  const fetchFavorite = useCallback(async (page = 1, search = '') => {
    if (!projectInfo || !viewId) return;
    setLoading(true);
    try {
      const res = await getSharedKeywordList({
        project: projectInfo.project,
        category: projectInfo.category,
        view_id: viewId,
        is_personal: true,
        search: search || undefined,
        page,
      });
      if (res.code === 200 && res.data) {
        setFavoriteList(res.data.list || []);
        setFavoriteTotal(res.data.total || 0);
        setFavoritePage(page);
      }
    } catch (err) {
      console.error('获取个人收藏失败:', err);
    } finally {
      setLoading(false);
    }
  }, [projectInfo, viewId]);

  useEffect(() => {
    if (visible && activeTab === 'shared' && projectInfo && viewId) {
      fetchShared(1, searchText);
    }
    if (visible && activeTab === 'favorite' && projectInfo && viewId) {
      fetchFavorite(1, searchText);
    }
  }, [visible, activeTab, projectInfo, viewId]);

  const handleSearch = () => {
    if (activeTab === 'local') {
      setLocalHistory(loadLocalHistory());
    } else if (activeTab === 'shared') {
      fetchShared(1, searchText);
    } else {
      fetchFavorite(1, searchText);
    }
  };

  // 过滤本地历史
  const filteredLocalHistory = searchText
    ? localHistory.filter(h => h.keyword.toLowerCase().includes(searchText.toLowerCase()))
    : localHistory;

  const handleClearLocal = () => {
    clearLocalHistory();
    setLocalHistory([]);
  };

  const handleDeleteShared = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteSharedKeyword(id);
      fetchShared(sharedPage, searchText);
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  const handleDeleteFavorite = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteSharedKeyword(id);
      fetchFavorite(favoritePage, searchText);
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  const handleEditShared = (item: SharedKeywordItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditItem(item);
  };

  // 处理遮罩层点击
  const handleOverlayClick = () => {
    if (editItem) {
      setEditItem(null);
    } else {
      onClose();
    }
  };

  const renderPager = (page: number, total: number, onPage: (p: number) => void) => {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (totalPages <= 1) return null;
    return (
      <div className="drawer-pager">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)}>上一页</button>
        <span>{page} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => onPage(page + 1)}>下一页</button>
      </div>
    );
  };

  if (!visible) return null;

  return (
    <>
      <div className="drawer-overlay" onClick={handleOverlayClick}>
        <div className="drawer drawer-sm elfk-history-drawer" onClick={e => e.stopPropagation()}>
          <div className="drawer-header">
            <h4>🔍 ES 搜索历史</h4>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>

          {/* 标签页 */}
          <div className="modal-tabs">
            <button
              className={`tab-btn ${activeTab === 'local' ? 'active' : ''}`}
              onClick={() => { setActiveTab('local'); setSearchText(''); }}
            >
              <Clock size={12} /> 本地
            </button>
            <button
              className={`tab-btn ${activeTab === 'shared' ? 'active' : ''}`}
              onClick={() => { setActiveTab('shared'); setSearchText(''); }}
            >
              <Users size={12} /> 共享 {sharedTotal > 0 && `(${sharedTotal})`}
            </button>
            <button
              className={`tab-btn ${activeTab === 'favorite' ? 'active' : ''}`}
              onClick={() => { setActiveTab('favorite'); setSearchText(''); }}
            >
              <Star size={12} /> 收藏 {favoriteTotal > 0 && `(${favoriteTotal})`}
            </button>
            {activeTab === 'local' && localHistory.length > 0 && (
              <span className="clear-local-btn" onClick={handleClearLocal}>清空</span>
            )}
          </div>

          {/* 搜索框 */}
          <div className="drawer-search">
            <input
              type="text"
              placeholder={activeTab === 'local' ? '搜索本地历史' : '搜索备注（支持拼音首字母）'}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            />
            <button className="search-btn" onClick={handleSearch}>🔍</button>
          </div>

          {/* 内容区 */}
          <div className="drawer-body">
            {activeTab === 'local' ? (
              filteredLocalHistory.length === 0 ? (
                <div className="empty-tip">暂无本地历史</div>
              ) : (
                <div className="history-list">
                  {filteredLocalHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className="history-card local"
                      onClick={() => onSelect(item.keyword)}
                    >
                      <div className="card-keyword">{item.keyword}</div>
                      <div className="card-footer">
                        <span className="card-time">{item.time}</span>
                        <span
                          className="append-btn"
                          onClick={(e) => { e.stopPropagation(); onAppend(item.keyword); }}
                        >
                          追加
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : loading ? (
              <div className="empty-tip">加载中...</div>
            ) : activeTab === 'shared' ? (
              sharedList.length === 0 ? (
                <div className="empty-tip">暂无共享记录</div>
              ) : (
                <>
                  <div className="history-list">
                    {sharedList.map(item => (
                      <div
                        key={item.id}
                        className="history-card shared"
                        onClick={() => onSelect(item.keyword)}
                      >
                        <div className="card-title">{item.remark || '(无备注)'}</div>
                        <div className="card-keyword">{item.keyword}</div>
                        <div className="card-footer">
                          <span className="card-creator">{item.creator}</span>
                          <div className="card-actions">
                            <span
                              className="icon-btn"
                              title="编辑"
                              onClick={(e) => handleEditShared(item, e)}
                            >
                              <Edit2 size={12} />
                            </span>
                            <span
                              className="icon-btn danger"
                              title="删除"
                              onClick={(e) => handleDeleteShared(item.id, e)}
                            >
                              <Trash2 size={12} />
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {renderPager(sharedPage, sharedTotal, fetchShared)}
                </>
              )
            ) : (
              favoriteList.length === 0 ? (
                <div className="empty-tip">暂无个人收藏</div>
              ) : (
                <>
                  <div className="history-list">
                    {favoriteList.map(item => (
                      <div
                        key={item.id}
                        className="history-card shared"
                        onClick={() => onSelect(item.keyword)}
                      >
                        <div className="card-title">{item.remark || '(无备注)'}</div>
                        <div className="card-keyword">{item.keyword}</div>
                        <div className="card-footer">
                          <span className="card-creator">{item.creator}</span>
                          <div className="card-actions">
                            <span
                              className="icon-btn"
                              title="编辑"
                              onClick={(e) => handleEditShared(item, e)}
                            >
                              <Edit2 size={12} />
                            </span>
                            <span
                              className="icon-btn danger"
                              title="删除"
                              onClick={(e) => handleDeleteFavorite(item.id, e)}
                            >
                              <Trash2 size={12} />
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {renderPager(favoritePage, favoriteTotal, fetchFavorite)}
                </>
              )
            )}
          </div>
        </div>
      </div>

      {editItem && (
        <EditSharedDialog
          visible={!!editItem}
          item={editItem}
          onClose={() => setEditItem(null)}
          onSuccess={() => {
            setEditItem(null);
            if (activeTab === 'shared') fetchShared(sharedPage, searchText);
            else fetchFavorite(favoritePage, searchText);
          }}
        />
      )}
    </>
  );
};

export default ElfkHistoryDrawer;
