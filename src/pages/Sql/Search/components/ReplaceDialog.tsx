/**
 * 自定义替换对话框 - 可拖拽独立框
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import { message } from 'antd';
import './SearchDialog.css';

interface Props {
  visible: boolean;
  onClose: () => void;
  editor: any;
}

const ReplaceDialog = ({ visible, onClose, editor }: Props) => {
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);

  const countMatches = useCallback((text: string) => {
    if (!editor || !text) return 0;
    const content = editor.getValue();
    try {
      const flags = caseSensitive ? 'g' : 'gi';
      const pattern = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matches = content.match(new RegExp(pattern, flags));
      return matches ? matches.length : 0;
    } catch { return 0; }
  }, [editor, caseSensitive]);

  const doSearch = useCallback((direction: 'next' | 'prev' = 'next') => {
    if (!editor || !searchText) return;
    const count = countMatches(searchText);
    setTotalCount(count);
    editor.find(searchText, { backwards: direction === 'prev', wrap: true, caseSensitive, wholeWord: false, regExp: false });
    if (count > 0) {
      const content = editor.getValue();
      const pos = editor.getCursorPosition();
      const beforeText = content.substring(0, editor.session.doc.positionToIndex(pos));
      try {
        const flags = caseSensitive ? 'g' : 'gi';
        const pattern = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const beforeMatches = beforeText.match(new RegExp(pattern, flags));
        setCurrentIndex(beforeMatches ? beforeMatches.length : 1);
      } catch { setCurrentIndex(1); }
    } else { setCurrentIndex(0); }
  }, [editor, searchText, caseSensitive, countMatches]);

  const replaceOne = () => {
    if (!editor || !searchText) return;
    if (editor.getSelectedText()) {
      editor.replace(replaceText);
      doSearch('next');
      message.success('已替换 1 处');
    } else { doSearch('next'); }
  };

  const replaceAll = () => {
    if (!editor || !searchText) return;
    const count = countMatches(searchText);
    if (count === 0) { message.warning('没有找到匹配项'); return; }
    editor.replaceAll(replaceText);
    setTotalCount(0);
    setCurrentIndex(0);
    message.success(`已替换 ${count} 处`);
  };

  useEffect(() => {
    if (visible && searchText) {
      const count = countMatches(searchText);
      setTotalCount(count);
      if (count > 0) doSearch('next');
    } else { setTotalCount(0); setCurrentIndex(0); }
  }, [searchText, visible, caseSensitive]);

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 50);
      if (editor) {
        const selected = editor.getSelectedText();
        if (selected) setSearchText(selected);
      }
      if (!initialized) {
        setPosition({ x: window.innerWidth - 470, y: 80 });
        setInitialized(true);
      }
    }
  }, [visible, editor, initialized]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && visible) onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [visible, onClose]);

  // 拖拽（限制在可视区域内）
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'BUTTON') return;
    e.preventDefault();
    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;
    const dialogWidth = dialogRef.current?.offsetWidth || 430;
    const dialogHeight = dialogRef.current?.offsetHeight || 140;
    
    const handleMove = (ev: MouseEvent) => {
      const maxX = window.innerWidth - dialogWidth;
      const maxY = window.innerHeight - dialogHeight;
      const newX = Math.max(0, Math.min(maxX, ev.clientX - startX));
      const newY = Math.max(0, Math.min(maxY, ev.clientY - startY));
      setPosition({ x: newX, y: newY });
    };
    const handleUp = () => { document.removeEventListener('mousemove', handleMove); document.removeEventListener('mouseup', handleUp); };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? doSearch('prev') : doSearch('next'); }
  };

  if (!visible) return null;

  return (
    <div ref={dialogRef} className="search-dialog floating replace-dialog" style={{ left: position.x, top: position.y }} onMouseDown={handleMouseDown}>
      <div className="search-header">
        <span className="search-title">🔄 查找替换</span>
        <button className="close-btn" onClick={onClose}><X size={14} /></button>
      </div>
      <div className="search-body">
        <div className="search-input-row">
          <input ref={inputRef} type="text" className="search-input" placeholder="查找内容..." value={searchText} onChange={e => setSearchText(e.target.value)} onKeyDown={handleKeyDown} />
          <span className="search-count">{totalCount > 0 ? `${currentIndex}/${totalCount}` : '0'}</span>
          <button className="nav-btn" onClick={() => doSearch('prev')} title="上一个"><ChevronUp size={16} /></button>
          <button className="nav-btn" onClick={() => doSearch('next')} title="下一个"><ChevronDown size={16} /></button>
        </div>
        <div className="search-input-row">
          <input type="text" className="search-input" placeholder="替换为..." value={replaceText} onChange={e => setReplaceText(e.target.value)} />
          <button className="replace-btn" onClick={replaceOne}>替换</button>
          <button className="replace-btn replace-all" onClick={replaceAll}>全部</button>
        </div>
        <div className="search-options">
          <label><input type="checkbox" checked={caseSensitive} onChange={e => setCaseSensitive(e.target.checked)} /> 区分大小写</label>
        </div>
      </div>
    </div>
  );
};

export default ReplaceDialog;
