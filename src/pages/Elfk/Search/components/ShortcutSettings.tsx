/**
 * ELFK 快捷键设置组件
 */

import { useState, useEffect, useCallback } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { useUserPrefsStore, type ElfkShortcuts } from '../../../../stores';
import './ShortcutSettings.css';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// 快捷键配置项
const SHORTCUT_ITEMS: { key: keyof ElfkShortcuts; label: string; description: string }[] = [
  { key: 'search', label: '搜索', description: '执行搜索查询' },
  { key: 'history', label: '历史记录', description: '打开历史记录面板' },
  { key: 'saveShared', label: '保存共享', description: '保存当前关键词到共享记录' },
  { key: 'newTab', label: '新建标签页', description: '创建新的搜索标签' },
];

const ShortcutSettings = ({ visible, onClose }: Props) => {
  const { elfkShortcuts, setElfkShortcut, resetElfkShortcuts } = useUserPrefsStore();
  const [editingKey, setEditingKey] = useState<keyof ElfkShortcuts | null>(null);
  const [tempShortcut, setTempShortcut] = useState('');

  // 检测快捷键冲突
  const getConflict = (shortcut: string, currentKey: keyof ElfkShortcuts): string | null => {
    if (!shortcut) return null;
    for (const item of SHORTCUT_ITEMS) {
      if (item.key !== currentKey && elfkShortcuts[item.key] === shortcut) {
        return item.label;
      }
    }
    return null;
  };

  const currentConflict = editingKey ? getConflict(tempShortcut, editingKey) : null;

  // 格式化快捷键显示
  const formatShortcut = (shortcut: string) => {
    return shortcut
      .replace('Ctrl', '⌃ Ctrl')
      .replace('Shift', '⇧ Shift')
      .replace('Alt', '⌥ Alt')
      .replace('Enter', '↵ Enter')
      .replace(/-/g, ' + ');
  };

  // 保存快捷键
  const saveShortcut = useCallback(() => {
    if (editingKey && tempShortcut && !currentConflict) {
      setElfkShortcut(editingKey, tempShortcut);
    }
    setEditingKey(null);
    setTempShortcut('');
  }, [editingKey, tempShortcut, currentConflict, setElfkShortcut]);

  // 处理键盘事件
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!editingKey) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Enter' && tempShortcut) {
      saveShortcut();
      return;
    }

    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');

    let key = e.key;
    if (key === ' ') key = 'Space';
    else if (key === 'Enter') key = 'Enter';
    else if (key === 'Escape') {
      setEditingKey(null);
      setTempShortcut('');
      return;
    }
    else if (key.length === 1) key = key.toUpperCase();
    else if (key.startsWith('F') && key.length <= 3) key = key;
    else if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return;

    if (parts.length === 0 && !['Enter', 'Space'].includes(key) && !key.startsWith('F')) {
      return;
    }

    parts.push(key);
    setTempShortcut(parts.join('-'));
  }, [editingKey, tempShortcut, saveShortcut]);

  useEffect(() => {
    if (editingKey) {
      window.addEventListener('keydown', handleKeyDown, true);
      return () => window.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [editingKey, handleKeyDown]);

  if (!visible) return null;

  return (
    <>
      <div className="elfk-shortcut-overlay" onClick={onClose} />
      <div className="elfk-shortcut-dialog">
        <div className="shortcut-header">
          <h3>快捷键设置</h3>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        
        <div className="shortcut-body">
          <div className="shortcut-list">
            {SHORTCUT_ITEMS.map((item) => (
              <div key={item.key} className="shortcut-item">
                <div className="shortcut-info">
                  <span className="shortcut-label">{item.label}</span>
                  <span className="shortcut-desc">{item.description}</span>
                </div>
                <div className="shortcut-value">
                  {editingKey === item.key ? (
                    <div className="shortcut-editing">
                      <div className="shortcut-input-wrapper">
                        <input
                          type="text"
                          className={`shortcut-input ${currentConflict ? 'conflict' : ''}`}
                          value={tempShortcut ? formatShortcut(tempShortcut) : '按下快捷键...'}
                          readOnly
                          autoFocus
                        />
                        {currentConflict && (
                          <span className="conflict-tip">与「{currentConflict}」冲突</span>
                        )}
                      </div>
                      <button className="btn-sm" onClick={saveShortcut} disabled={!tempShortcut || !!currentConflict}>确定</button>
                      <button className="btn-sm btn-cancel" onClick={() => { setEditingKey(null); setTempShortcut(''); }}>取消</button>
                    </div>
                  ) : (
                    <button className="shortcut-btn" onClick={() => { setEditingKey(item.key); setTempShortcut(''); }}>
                      {formatShortcut(elfkShortcuts[item.key])}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="shortcut-footer">
          <button className="btn-reset" onClick={resetElfkShortcuts}>
            <RotateCcw size={14} />恢复默认
          </button>
          <button className="btn-primary" onClick={onClose}>完成</button>
        </div>
      </div>
    </>
  );
};

export default ShortcutSettings;
