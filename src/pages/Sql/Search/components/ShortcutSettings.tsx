/**
 * SQL 快捷键设置组件
 */

import { useState, useEffect, useCallback } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { useUserPrefsStore, type SqlShortcuts } from '../../../../stores';
import './ShortcutSettings.css';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// 快捷键配置项
const SHORTCUT_ITEMS: { key: keyof SqlShortcuts; label: string; description: string }[] = [
  { key: 'execute', label: '执行查询', description: '执行当前 SQL 语句' },
  { key: 'format', label: '格式化 SQL', description: '格式化 SQL 代码' },
  { key: 'comment', label: '注释/取消注释', description: '切换行注释' },
  { key: 'find', label: '查找', description: '打开查找框' },
  { key: 'replace', label: '替换', description: '打开查找替换框' },
  { key: 'newTab', label: '新建标签页', description: '创建新的查询标签' },
  { key: 'history', label: '历史记录', description: '打开历史记录面板' },
  { key: 'saveShared', label: '保存共享', description: '保存当前SQL到共享记录' },
  { key: 'duplicateLine', label: '复制当前行', description: '复制当前行或选中内容到下一行' },
];

const ShortcutSettings = ({ visible, onClose }: Props) => {
  const { sqlShortcuts, setSqlShortcut, resetSqlShortcuts } = useUserPrefsStore();
  const [editingKey, setEditingKey] = useState<keyof SqlShortcuts | null>(null);
  const [tempShortcut, setTempShortcut] = useState('');

  // 检测快捷键冲突
  const getConflict = (shortcut: string, currentKey: keyof SqlShortcuts): string | null => {
    if (!shortcut) return null;
    for (const item of SHORTCUT_ITEMS) {
      if (item.key !== currentKey && sqlShortcuts[item.key] === shortcut) {
        return item.label;
      }
    }
    return null;
  };

  // 当前编辑的快捷键是否有冲突
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
      setSqlShortcut(editingKey, tempShortcut);
    }
    setEditingKey(null);
    setTempShortcut('');
  }, [editingKey, tempShortcut, currentConflict, setSqlShortcut]);

  // 处理键盘事件，捕获快捷键
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!editingKey) return;
    
    e.preventDefault();
    e.stopPropagation();

    // 如果已有快捷键，按回车直接保存
    if (e.key === 'Enter' && tempShortcut) {
      saveShortcut();
      return;
    }

    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');

    // 获取按键
    let key = e.key;
    if (key === ' ') key = 'Space';
    else if (key === 'Enter') key = 'Enter';
    else if (key === 'Escape') {
      setEditingKey(null);
      setTempShortcut('');
      return;
    }
    else if (key.length === 1) key = key.toUpperCase();
    else if (key.startsWith('F') && key.length <= 3) key = key; // F1-F12
    else if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return; // 忽略修饰键单独按下

    if (parts.length === 0 && !['Enter', 'Space'].includes(key) && !key.startsWith('F')) {
      return; // 需要至少一个修饰键（除了 Enter、Space、F 键）
    }

    parts.push(key);
    const shortcut = parts.join('-');
    setTempShortcut(shortcut);
  }, [editingKey, tempShortcut, saveShortcut]);

  // 监听键盘事件
  useEffect(() => {
    if (editingKey) {
      window.addEventListener('keydown', handleKeyDown, true);
      return () => window.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [editingKey, handleKeyDown]);

  // 开始编辑
  const startEditing = (key: keyof SqlShortcuts) => {
    setEditingKey(key);
    setTempShortcut('');
  };

  // 取消编辑
  const cancelEditing = () => {
    setEditingKey(null);
    setTempShortcut('');
  };

  if (!visible) return null;

  return (
    <>
      <div className="shortcut-overlay" onClick={onClose} />
      <div className="shortcut-dialog">
        <div className="shortcut-header">
          <h3>快捷键设置</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
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
                      <button className="btn-sm" onClick={saveShortcut} disabled={!tempShortcut || !!currentConflict}>
                        确定
                      </button>
                      <button className="btn-sm btn-cancel" onClick={cancelEditing}>
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      className="shortcut-btn"
                      onClick={() => startEditing(item.key)}
                    >
                      {formatShortcut(sqlShortcuts[item.key])}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="shortcut-footer">
          <button className="btn-reset" onClick={resetSqlShortcuts}>
            <RotateCcw size={14} />
            恢复默认
          </button>
          <button className="btn-primary" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </>
  );
};

export default ShortcutSettings;
