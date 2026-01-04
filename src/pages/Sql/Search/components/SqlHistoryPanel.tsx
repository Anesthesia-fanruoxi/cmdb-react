/**
 * SQL 历史记录面板 - 抽屉式，个人记录 + 共享记录
 */

import { useState, useEffect, useCallback } from 'react';
import { getSqlSharedQueryList, deleteSqlSharedQuery, type SqlSharedQueryItem } from '../../../../services/sql';
import { getHistoryList, type HistoryItem } from '../../../../services/sql/search';
import EditSqlSharedDialog from './EditSqlSharedDialog';

interface Props {
  visible: boolean;
  project: string;
  projectName: string;
  onClose: () => void;
  onSelect: (sql: string) => void;
  onAppend: (sql: string) => void;
}

const SqlHistoryPanel = ({ visible, project, projectName, onClose, onSelect, onAppend }: Props) => {
  const [activeTab, setActiveTab] = useState<'personal' | 'shared'>('personal');
  const [personalHistory, setPersonalHistory] = useState<HistoryItem[]>([]);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [sharedList, setSharedList] = useState<SqlSharedQueryItem[]>([]);
  const [sharedTotal, setSharedTotal] = useState(0);
  const [sharedPage, setSharedPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedItem, setSelectedItem] = useState<HistoryItem | SqlSharedQueryItem | null>(null);
  const [editItem, setEditItem] = useState<SqlSharedQueryItem | null>(null);

  // ESC 键关闭：优先关闭详情弹框，其次关闭抽屉
  useEffect(() => {
    if (!visible) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        if (editItem) {
          setEditItem(null);
        } else if (selectedItem) {
          setSelectedItem(null);
        } else {
          onClose();
        }
      }
    };
    // 使用 capture 阶段拦截，防止父组件也响应
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [visible, selectedItem, editItem, onClose]);

  // 处理抽屉遮罩层点击：如果详情弹框打开，先关闭详情
  const handleOverlayClick = () => {
    if (selectedItem) {
      setSelectedItem(null);
    } else {
      onClose();
    }
  };

  // 加载个人记录（从数据库）
  const fetchPersonalHistory = useCallback(async () => {
    setPersonalLoading(true);
    try {
      const res = await getHistoryList();
      if (res.code === 200 && res.data) {
        setPersonalHistory(res.data);
      }
    } catch (err) {
      console.error('获取个人记录失败:', err);
    } finally {
      setPersonalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible && activeTab === 'personal') {
      fetchPersonalHistory();
    }
  }, [visible, activeTab, fetchPersonalHistory]);

  // 加载共享记录（只依赖项目，不依赖库名）
  const fetchShared = useCallback(async (page = 1, search = '') => {
    if (!project) return;
    setLoading(true);
    try {
      const res = await getSqlSharedQueryList({ project, search: search || undefined, page });
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
  }, [project]);

  useEffect(() => {
    if (visible && activeTab === 'shared' && project) {
      fetchShared(1, searchText);
    }
  }, [visible, activeTab, project]);

  const handleSearch = () => {
    if (activeTab === 'personal') {
      // 个人记录前端过滤
      fetchPersonalHistory();
    } else {
      fetchShared(1, searchText);
    }
  };

  // 过滤后的个人记录
  const filteredPersonalHistory = searchText
    ? personalHistory.filter(h => h.query_sql?.toLowerCase().includes(searchText.toLowerCase()))
    : personalHistory;

  const handleDeleteShared = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteSqlSharedQuery(id);
      fetchShared(sharedPage, searchText);
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  const handleEditShared = (item: SqlSharedQueryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditItem(item);
  };

  const getSqlContent = (item: HistoryItem | SqlSharedQueryItem): string => {
    return 'query' in item ? item.query : item.query_sql;
  };

  if (!visible) return null;

  const totalPages = Math.ceil(sharedTotal / 20);

  return (
    <>
      <div className="drawer-overlay" onClick={handleOverlayClick}>
        <div className="drawer history-drawer" onClick={e => e.stopPropagation()}>
          <div className="drawer-header">
            <h4>📋 SQL 历史记录</h4>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>

          {/* 标签页 */}
          <div className="modal-tabs" style={{ background: 'transparent', padding: '8px 16px' }}>
            <button className={`tab-btn ${activeTab === 'personal' ? 'active' : ''}`} onClick={() => setActiveTab('personal')}>
              👤 个人记录
            </button>
            <button className={`tab-btn ${activeTab === 'shared' ? 'active' : ''}`} onClick={() => setActiveTab('shared')}>
              👥 共享记录
            </button>
          </div>

          {/* 搜索框 */}
          <div style={{ display: 'flex', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--border-color)' }}>
            <input
              type="text"
              placeholder={activeTab === 'personal' ? '搜索SQL...' : '搜索备注/创建人...'}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              style={{ flex: 1, height: 32, padding: '0 12px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 13 }}
            />
            <button onClick={handleSearch} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary-color)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 14 }}>
              🔍
            </button>
          </div>

          <div className="drawer-body">
            {activeTab === 'personal' ? (
              <div className="history-list">
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                  共 {filteredPersonalHistory.length} 条记录
                </div>
                {personalLoading ? (
                  <div className="empty-tip">加载中...</div>
                ) : filteredPersonalHistory.length === 0 ? (
                  <div className="empty-tip">暂无个人记录</div>
                ) : (
                  filteredPersonalHistory.map((item) => (
                    <div key={item.id} className="history-card" onClick={() => setSelectedItem(item)}>
                      <div className="history-card-header">
                        <span className="history-time">🕐 {item.created_at?.replace('T', ' ').slice(0, 19)}</span>
                        <div className="history-card-actions">
                          <button className="btn-icon" title="替换" onClick={e => { e.stopPropagation(); onSelect(item.query_sql); }}>📋</button>
                          <button className="btn-icon" title="追加" onClick={e => { e.stopPropagation(); onAppend(item.query_sql); }}>➕</button>
                        </div>
                      </div>
                      <div className="history-sql-preview">
                        {item.query_sql?.replace(/\s+/g, ' ').slice(0, 120)}{(item.query_sql?.length || 0) > 120 ? '...' : ''}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="history-list">
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                  {projectName} | 共 {sharedTotal} 条
                </div>
                {loading ? (
                  <div className="empty-tip">加载中...</div>
                ) : sharedList.length === 0 ? (
                  <div className="empty-tip">暂无共享记录</div>
                ) : (
                  <>
                    {sharedList.map(item => (
                      <div key={item.id} className="history-card" onClick={() => setSelectedItem(item)}>
                        <div className="history-card-header">
                          <span className="history-time">👤 {item.creator} · {item.created_at?.split('T')[0]}</span>
                          <div className="history-card-actions">
                            <button className="btn-icon" title="替换" onClick={e => { e.stopPropagation(); onSelect(item.query); }}>📋</button>
                            <button className="btn-icon" title="追加" onClick={e => { e.stopPropagation(); onAppend(item.query); }}>➕</button>
                            <button className="btn-icon" title="编辑" onClick={e => handleEditShared(item, e)}>✏️</button>
                            <button className="btn-icon" title="删除" onClick={e => handleDeleteShared(item.id, e)}>🗑️</button>
                          </div>
                        </div>
                        {item.remark && <div style={{ fontSize: 12, color: 'var(--primary-color)', marginBottom: 6 }}>💬 {item.remark}</div>}
                        <div className="history-sql-preview">
                          {item.query?.replace(/\s+/g, ' ').slice(0, 120)}{(item.query?.length || 0) > 120 ? '...' : ''}
                        </div>
                      </div>
                    ))}
                    {totalPages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                        <button disabled={sharedPage <= 1} onClick={() => fetchShared(sharedPage - 1, searchText)} style={{ padding: '6px 12px', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 13, cursor: 'pointer', opacity: sharedPage <= 1 ? 0.5 : 1 }}>上一页</button>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{sharedPage} / {totalPages}</span>
                        <button disabled={sharedPage >= totalPages} onClick={() => fetchShared(sharedPage + 1, searchText)} style={{ padding: '6px 12px', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 13, cursor: 'pointer', opacity: sharedPage >= totalPages ? 0.5 : 1 }}>下一页</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SQL 详情弹框 */}
      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="sql-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>SQL 详情</h4>
              <button className="close-btn" onClick={() => setSelectedItem(null)}>×</button>
            </div>
            {'remark' in selectedItem && selectedItem.remark && (
              <div className="modal-meta">备注：{selectedItem.remark}</div>
            )}
            <div className="modal-content">
              <pre>{getSqlContent(selectedItem)}</pre>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => { onAppend(getSqlContent(selectedItem)); setSelectedItem(null); }}>➕ 追加填入</button>
              <button className="btn btn-primary" onClick={() => { onSelect(getSqlContent(selectedItem)); setSelectedItem(null); }}>📋 替换填入</button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑共享记录弹框 */}
      <EditSqlSharedDialog
        visible={!!editItem}
        item={editItem}
        onClose={() => setEditItem(null)}
        onSuccess={() => fetchShared(sharedPage, searchText)}
      />
    </>
  );
};

export default SqlHistoryPanel;
