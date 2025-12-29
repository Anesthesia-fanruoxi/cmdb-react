/**
 * 消息中心组件
 * 支持下拉模式和抽屉模式
 */

import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Trash2, X, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useMessageStore, type Message } from '../../stores/messageStore';
import './style.css';

const typeIcons = {
  success: <CheckCircle size={16} />,
  error: <AlertCircle size={16} />,
  warning: <AlertCircle size={16} />,
  info: <Info size={16} />,
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

interface MessageCenterProps {
  visible?: boolean;
  onClose?: () => void;
}

const MessageCenter = ({ visible: externalVisible, onClose }: MessageCenterProps) => {
  const [internalVisible, setInternalVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { messages, unreadCount, markAsRead, markAllAsRead, removeMessage, clearAll, rehydrate } = useMessageStore();

  // 是否是抽屉模式
  const isDrawerMode = onClose !== undefined;
  const visible = isDrawerMode ? externalVisible : internalVisible;

  useEffect(() => { rehydrate(); }, []);

  // 点击外部关闭（仅下拉模式）
  useEffect(() => {
    if (isDrawerMode) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setInternalVisible(false);
      }
    };
    if (internalVisible) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [internalVisible, isDrawerMode]);

  const handleItemClick = (msg: Message) => {
    if (!msg.read) markAsRead(msg.id);
  };

  // 抽屉模式
  if (isDrawerMode) {
    if (!visible) return null;
    return (
      <>
        <div className="msg-drawer-overlay" onClick={onClose} />
        <div className="msg-drawer">
          <div className="drawer-header">
            <h3>消息中心</h3>
            <div className="header-actions">
              {unreadCount > 0 && <button className="btn-action" onClick={markAllAsRead} title="全部已读"><CheckCheck size={16} /></button>}
              {messages.length > 0 && <button className="btn-action" onClick={clearAll} title="清空"><Trash2 size={16} /></button>}
              <button className="close-btn" onClick={onClose}><X size={18} /></button>
            </div>
          </div>
          <div className="drawer-content">
            {messages.length === 0 ? (
              <div className="msg-empty">暂无消息</div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`msg-item ${msg.read ? 'read' : 'unread'} msg-${msg.type}`} onClick={() => handleItemClick(msg)}>
                  <div className="msg-icon">{typeIcons[msg.type]}</div>
                  <div className="msg-content">
                    <div className="msg-title">{msg.title}</div>
                    <div className="msg-text">{msg.content}</div>
                    <div className="msg-time">{formatTime(msg.time)}</div>
                  </div>
                  <button className="btn-remove" onClick={e => { e.stopPropagation(); removeMessage(msg.id); }}><X size={14} /></button>
                </div>
              ))
            )}
          </div>
        </div>
      </>
    );
  }

  // 下拉模式（原有逻辑）
  return (
    <div className="message-center" ref={containerRef}>
      <button className={`msg-trigger ${unreadCount > 0 ? 'has-unread' : ''}`} onClick={() => setInternalVisible(!internalVisible)}>
        <Bell size={18} />
        {unreadCount > 0 && <span className="badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {internalVisible && (
        <div className="msg-dropdown">
          <div className="msg-header">
            <span className="title">消息中心</span>
            <div className="header-actions">
              {unreadCount > 0 && <button className="btn-action" onClick={markAllAsRead} title="全部已读"><CheckCheck size={16} /></button>}
              {messages.length > 0 && <button className="btn-action" onClick={clearAll} title="清空"><Trash2 size={16} /></button>}
            </div>
          </div>
          <div className="msg-list">
            {messages.length === 0 ? (
              <div className="msg-empty">暂无消息</div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`msg-item ${msg.read ? 'read' : 'unread'} msg-${msg.type}`} onClick={() => handleItemClick(msg)}>
                  <div className="msg-icon">{typeIcons[msg.type]}</div>
                  <div className="msg-content">
                    <div className="msg-title">{msg.title}</div>
                    <div className="msg-text">{msg.content}</div>
                    <div className="msg-time">{formatTime(msg.time)}</div>
                  </div>
                  <button className="btn-remove" onClick={e => { e.stopPropagation(); removeMessage(msg.id); }}><X size={14} /></button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageCenter;
