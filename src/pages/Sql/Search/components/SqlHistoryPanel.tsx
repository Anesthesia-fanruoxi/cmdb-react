/**
 * SQL 历史记录面板 - 抽屉式，本地历史 + 共享记录
 */

import { useState, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { getSqlSharedQueryList, deleteSqlSharedQuery, type SqlSharedQueryItem } from '../../../../services/sql';
import EditSqlSharedDialog from './EditSqlSharedDialog';

interface Props {
  visible: boolean;
  project: string;
  projectName: string;
  dbName: string;
  onClose: () => void;
  onSelect: (sql: string) => void;
  onAppend: (sql: string) => void;
}

const LOCAL_HISTORY_KEY = 'sql_local_history';
const MAX_LOCAL_HISTORY = 50;

interface LocalHistoryItem {
  sql: string;
  time: string;
  project: string;
  dbName: string;
}

// 读取本地历史
const loadLocalHistory = (): LocalHistoryItem[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]');
  } catch { return []; }
};

// 保存本地历史
export const saveSqlLocalHistory = (sql: string, project: string, dbName: string) => {
  if (!sql.trim()) return;
  const history = loadLocalHistory().filter(h => h.sql !== sql);
  history.unshift({ sql, time: new Date().toLocaleString(), project, dbName });
  localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_LOCAL_HISTORY)));
};

const SqlHistoryPanel = ({ visible, project, projectName, dbName, onClose, onSelect, onAppend }: Props) => {
  const [activeTab, setActiveTab] = useState<'local' | 'shared'>('local');
  const [localHistory, setLocalHistory] = useState<LocalHistoryItem[]>([]);
  const [sharedList, setSharedList] = useState<SqlSharedQueryItem[]>([]);
  const [sharedTotal, setSharedTotal] = useState(0);
  const [sharedPage, setSharedPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedItem, setSelectedItem] = useState<LocalHistoryItem | SqlSharedQueryItem | null>(null);
  const [editItem, setEditItem] = useState<SqlSharedQueryItem | null>(null);

  // 加载本地历史
  useEffect(() => {
    if (visible && activeTab === 'local') {
      const all = loadLocalHistory();
      setLocalHistory(project && dbName ? all.filter(h => h.project === project && h.dbName === dbName) : all);
    }
  }, [visible, activeTab, project, dbName]);

  // 加载共享记录
  const fetchShared = useCallback(async (page = 1, search = '') => {
    if (!project || !dbName) return;
    setLoading(true);
    try {
      const res = await getSqlSharedQueryList({ project, db_name: dbName, search: search || undefined, page });
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
  }, [project, dbName]);

  useEffect(() => {
    if (visible && activeTab === 'shared' && project && dbName) {
      fetchShared(1, searchText);
    }
  }, [visible, activeTab, project, dbName]);

  const handleSearch = () => {
    if (activeTab === 'local') {
      const all = loadLocalHistory().filter(h => h.project === project && h.dbName === dbName);
      setLocalHistory(searchText ? all.filter(h => h.sql.toLowerCase().includes(searchText.toLowerCase())) : all);
    } else {
      fetchShared(1, searchText);
    }
  };

  const handleClearLocal = () => {
    const all = loadLocalHistory().filter(h => !(h.project === project && h.dbName === dbName));
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(all));
    setLocalHistory([]);
  };

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

  const getSqlContent = (item: LocalHistoryItem | SqlSharedQueryItem): string => {
    return 'query' in item ? item.query : item.sql;
  };

  if (!visible) return null;

  const totalPages = Math.ceil(sharedTotal / 20);

  return (
    <>
      <div className="drawer-overlay" onClick={onClose}>
        <div className="drawer history-drawer" onClick={e => e.stopPropagation()}>
          <div className="drawer-header">
            <h4>📋 SQL 历史记录</h4>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>

          {/* 标签页 */}
          <div className="modal-tabs" style={{ background: 'transparent', padding: '8px 16px' }}>
            <button className={`tab-btn ${activeTab === 'local' ? 'active' : ''}`} onClick={() => setActiveTab('local')}>
              🕐 本地历史
            </button>
            <button className={`tab-btn ${activeTab === 'shared' ? 'active' : ''}`} onClick={() => setActiveTab('shared')}>
              👥 共享记录
            </button>
          </div>

          {/* 搜索框 */}
          <div style={{ display: 'flex', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--border-color)' }}>
            <input
              type="text"
              placeholder={activeTab === 'local' ? '搜索SQL...' : '搜索备注/创建人...'}
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
            {activeTab === 'local' ? (
              <div className="history-list">
                {localHistory.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                    <span>{localHistory.length} 条 | {projectName} - {dbName}</span>
                    <button onClick={handleClearLocal} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 12 }}>
                      <Trash2 size={14} /> 清空
                    </button>
                  </div>
                )}
                {localHistory.length === 0 ? (
                  <div className="empty-tip">暂无本地历史记录</div>
                ) : (
                  localHistory.map((item, idx) => (
                    <div key={idx} className="history-card" onClick={() => setSelectedItem(item)}>
                      <div className="history-card-header">
                        <span className="history-time">🕐 {item.time}</span>
                        <div className="history-card-actions">
                          <button className="btn-icon" title="替换" onClick={e => { e.stopPropagation(); onSelect(item.sql); }}>📋</button>
                          <button className="btn-icon" title="追加" onClick={e => { e.stopPropagation(); onAppend(item.sql); }}>➕</button>
                        </div>
                      </div>
                      <div className="history-sql-preview">
                        {item.sql?.replace(/\s+/g, ' ').slice(0, 120)}{(item.sql?.length || 0) > 120 ? '...' : ''}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="history-list">
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                  {projectName} - {dbName} | 共 {sharedTotal} 条
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
