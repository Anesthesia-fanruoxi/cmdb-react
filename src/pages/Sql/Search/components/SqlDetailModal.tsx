import { useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  visible: boolean;
  sql: string;
  remark?: string;
  onAppend: (sql: string) => void;
  onSelect: (sql: string) => void;
  onClose: () => void;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeReg = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SqlDetailModal = ({ visible, sql, remark, onAppend, onSelect, onClose }: Props) => {
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  // 计算匹配总数
  const matchCount = useMemo(() => {
    if (!findText) return 0;
    try {
      const re = new RegExp(escapeReg(findText), 'gi');
      return (sql.match(re) || []).length;
    } catch {
      return 0;
    }
  }, [sql, findText]);

  useEffect(() => {
    setActiveIdx(0);
  }, [findText, sql]);

  // 渲染高亮 HTML
  const highlightedHtml = useMemo(() => {
    const safe = escapeHtml(sql);
    if (!findText) return safe;
    try {
      const re = new RegExp(escapeReg(findText), 'gi');
      let i = 0;
      return safe.replace(re, (m) => {
        const idx = i++;
        const cls = idx === activeIdx ? 'sql-mark sql-mark-active' : 'sql-mark';
        return `<mark class="${cls}" data-mark-idx="${idx}">${m}</mark>`;
      });
    } catch {
      return safe;
    }
  }, [sql, findText, activeIdx]);

  // 监听 Ctrl+F / Esc
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        e.stopPropagation();
        setFindOpen(true);
        setTimeout(() => findInputRef.current?.focus(), 0);
        return;
      }
      if (e.key === 'Escape' && findOpen) {
        e.preventDefault();
        e.stopPropagation();
        setFindOpen(false);
        setFindText('');
        return;
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [visible, findOpen]);

  // 滚动到当前高亮
  useEffect(() => {
    if (!findText || !preRef.current) return;
    const el = preRef.current.querySelector<HTMLElement>(`[data-mark-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeIdx, highlightedHtml, findText]);

  if (!visible) return null;

  const goNext = () => {
    if (matchCount === 0) return;
    setActiveIdx((p) => (p + 1) % matchCount);
  };
  const goPrev = () => {
    if (matchCount === 0) return;
    setActiveIdx((p) => (p - 1 + matchCount) % matchCount);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="sql-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <h4>SQL 详情</h4>
            {remark && <span className="modal-header-remark">💬 {remark}</span>}
          </div>
          <div className="modal-header-actions">
            <button
              className="btn btn-default btn-sm"
              title="查找 (Ctrl+F)"
              onClick={() => {
                setFindOpen(true);
                setTimeout(() => findInputRef.current?.focus(), 0);
              }}
            >🔍 查找</button>
            <button className="btn btn-default btn-sm" onClick={() => { onAppend(sql); onClose(); }}>➕ 追加填入编辑器</button>
            <button className="btn btn-primary btn-sm" onClick={() => { onSelect(sql); onClose(); }}>📋 替换填入编辑器</button>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        {findOpen && (
          <div className="sql-find-bar">
            <input
              ref={findInputRef}
              type="text"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.shiftKey ? goPrev() : goNext();
                }
              }}
              placeholder="查找关键字..."
              className="sql-find-input"
            />
            <span className="sql-find-count">
              {findText ? `${matchCount === 0 ? 0 : activeIdx + 1}/${matchCount}` : '0/0'}
            </span>
            <button className="sql-find-btn" onClick={goPrev} disabled={matchCount === 0} title="上一个 (Shift+Enter)">↑</button>
            <button className="sql-find-btn" onClick={goNext} disabled={matchCount === 0} title="下一个 (Enter)">↓</button>
            <button className="sql-find-btn" onClick={() => { setFindOpen(false); setFindText(''); }} title="关闭 (Esc)">×</button>
          </div>
        )}

        <div className="sql-detail-body">
          <pre ref={preRef} dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        </div>
      </div>
    </div>
  );
};

export default SqlDetailModal;
