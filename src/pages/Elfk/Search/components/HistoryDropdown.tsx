/**
 * ELFK 历史记录下拉框 - 本地历史 + 共享记录
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Trash2, Clock, Users } from 'lucide-react';
import { getSharedKeywordList, deleteSharedKeyword, type SharedKeywordItem } from '../../../../services/elfk';
import './HistoryDropdown.css';

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

// 保存本地历史
export const saveLocalHistory = (keyword: string) => {
  if (!keyword.trim()) return;
  const history = loadLocalHistory().filter(h => h.keyword !== keyword);
  history.unshift({ keyword, time: new Date().toLocaleString() });
  localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_LOCAL_HISTORY)));
};

const HistoryDropdown = ({ visible, projectInfo, viewId, onClose, onSelect, onAppend }: Props) => {
  const [activeTab, setActiveTab] = useState<'local' | 'shared'>('local');
  const [localHistory, setLocalHistory] = useState<{ keyword: string; time: string }[]>([]);
  const [sharedList, setSharedList] = useState<SharedKeywordItem[]>([]);
  const [sharedTotal, setSharedTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 加载本地历史
  useEffect(() => {
    if (visible && activeTab === 'local') {
      setLocalHistory(loadLocalHistory());
    }
  }, [visible, activeTab]);

  // 加载共享记录
  const fetchShared = useCallback(async () => {
    if (!projectInfo || !viewId) return;
    setLoading(true);
    try {
      const res = await getSharedKeywordList({
        project: projectInfo.project,
        category: projectInfo.category,
        view_id: viewId,
      });
      if (res.code === 200 && res.data) {
        setSharedList(res.data.list || []);
        setSharedTotal(res.data.total || 0);
      }
    } catch (err) {
      console.error('获取共享记录失败:', err);
    } finally {
      setLoading(false);
    }
  }, [projectInfo, viewId]);

  useEffect(() => {
    if (visible && activeTab === 'shared' && projectInfo && viewId) {
      fetchShared();
    }
  }, [visible, activeTab, projectInfo, viewId, fetchShared]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [visible, onClose]);

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  // 清空本地历史
  const handleClearLocal = () => {
    localStorage.removeItem(LOCAL_HISTORY_KEY);
    setLocalHistory([]);
  };

  // 删除共享记录
  const handleDeleteShared = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteSharedKeyword(id);
      fetchShared();
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  if (!visible) return null;

  return (
    <div className="history-dropdown" ref={dropdownRef}>
      {/* 标签页 */}
      <div className="dropdown-tabs">
        <button className={activeTab === 'local' ? 'active' : ''} onClick={() => setActiveTab('local')}>
          <Clock size={12} /> 本地历史
        </button>
        <button className={activeTab === 'shared' ? 'active' : ''} onClick={() => setActiveTab('shared')}>
          <Users size={12} /> 共享 {sharedTotal > 0 && `(${sharedTotal})`}
        </button>
        {activeTab === 'local' && localHistory.length > 0 && (
          <span className="clear-btn" onClick={handleClearLocal}>清空</span>
        )}
      </div>

      {/* 列表内容 */}
      <div className="dropdown-content">
        {activeTab === 'local' ? (
          localHistory.length === 0 ? (
            <div className="empty-tip">暂无本地历史</div>
          ) : (
            <ul className="history-list">
              {localHistory.slice(0, 10).map((item, idx) => (
                <li key={idx} onClick={() => onSelect(item.keyword)}>
                  <span className="keyword">{item.keyword}</span>
                  <span className="time">{item.time}</span>
                  <span className="append-btn" onClick={(e) => { e.stopPropagation(); onAppend(item.keyword); }}>追加</span>
                </li>
              ))}
            </ul>
          )
        ) : loading ? (
          <div className="empty-tip">加载中...</div>
        ) : sharedList.length === 0 ? (
          <div className="empty-tip">暂无共享记录</div>
        ) : (
          <ul className="history-list shared">
            {sharedList.map(item => (
              <li key={item.id} onClick={() => onSelect(item.keyword)}>
                <div className="line1">{item.remark || item.keyword}</div>
                <div className="line2">
                  <span className="creator">{item.creator}</span>
                  <span className="keyword">{item.keyword}</span>
                  <span className="delete-btn" onClick={(e) => handleDeleteShared(item.id, e)}><Trash2 size={12} /></span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default HistoryDropdown;
