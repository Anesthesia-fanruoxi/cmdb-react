/**
 * 消息中心组件
 * 支持下拉模式和抽屉模式
 */

import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Trash2, X, AlertCircle, CheckCircle, Info, ExternalLink, FolderOpen, FileText, Download } from 'lucide-react';
import { useMessageStore, type Message } from '../../stores/messageStore';
import { useTaskCenterStore } from '../../stores/taskCenterStore';
import { openFolder, showInFolder, openFile } from '../../utils/fileSystem';
import { isTauriEnv } from '../../services/machine';
import { toast } from '../Toast';
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
  const openTaskCenter = useTaskCenterStore(state => state.open);

  // 是否是抽屉模式
  const isDrawerMode = onClose !== undefined;
  const visible = isDrawerMode ? externalVisible : internalVisible;

  // 调试信息
  useEffect(() => {
    if (visible) {
      console.log('[MessageCenter] 显示模式:', isDrawerMode ? '抽屉模式' : '下拉模式');
      console.log('[MessageCenter] visible:', visible);
      console.log('[MessageCenter] onClose:', onClose);
    }
  }, [visible, isDrawerMode, onClose]);

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
    
    // 处理点击跳转
    if (msg.action) {
      if (msg.action.type === 'task-center') {
        if (isDrawerMode) onClose?.();
        else setInternalVisible(false);
        openTaskCenter();
      } else if (msg.action.type === 'download') {
        // 下载类型的消息不自动跳转，由按钮处理
        return;
      }
    }
  };

  // 处理下载消息的文件操作
  const handleOpenFolder = async (msg: Message, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!msg.extra?.downloadDir) return;
    
    try {
      await openFolder(msg.extra.downloadDir as string);
    } catch (error) {
      toast.error('打开文件夹失败');
    }
  };

  const handleShowInFolder = async (msg: Message, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!msg.extra?.filePath) return;
    
    try {
      await showInFolder(msg.extra.filePath as string);
    } catch (error) {
      toast.error('定位文件失败');
    }
  };

  const handleOpenFile = async (msg: Message, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!msg.extra?.filePath) return;
    
    try {
      await openFile(msg.extra.filePath as string);
    } catch (error) {
      toast.error('打开文件失败');
    }
  };

  const renderMessageItem = (msg: Message) => (
    <div key={msg.id} className={`msg-item ${msg.read ? 'read' : 'unread'} msg-${msg.type} ${msg.action && msg.action.type !== 'download' ? 'clickable' : ''}`} onClick={() => handleItemClick(msg)}>
      <div className="msg-icon">{typeIcons[msg.type]}</div>
      <div className="msg-content">
        <div className="msg-title">{msg.title}</div>
        <div className="msg-text">{msg.content}</div>
        <div className="msg-footer">
          <span className="msg-time">{formatTime(msg.time)}</span>
          {msg.action && msg.action.type !== 'download' && <span className="msg-action-hint"><ExternalLink size={12} /> 点击查看</span>}
        </div>
        {msg.action?.type === 'download' && isTauriEnv() && msg.extra?.filePath && (
          <div className="msg-download-actions">
            <button className="btn-download-action" onClick={(e) => handleOpenFolder(msg, e)} title="打开文件夹">
              <FolderOpen size={14} />
              <span>打开文件夹</span>
            </button>
            <button className="btn-download-action" onClick={(e) => handleShowInFolder(msg, e)} title="定位文件">
              <FileText size={14} />
              <span>定位文件</span>
            </button>
            <button className="btn-download-action" onClick={(e) => handleOpenFile(msg, e)} title="打开文件">
              <Download size={14} />
              <span>打开文件</span>
            </button>
          </div>
        )}
      </div>
      <button className="btn-remove" onClick={e => { e.stopPropagation(); removeMessage(msg.id); }} title="删除">🗑️</button>
    </div>
  );

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
              {unreadCount > 0 && <button className="btn-action btn-text" onClick={markAllAsRead}>全部已读</button>}
              {messages.length > 0 && <button className="btn-action btn-text" onClick={clearAll}>全部清空</button>}
              <button className="close-btn" onClick={onClose}><X size={18} /></button>
            </div>
          </div>
          <div className="drawer-content">
            {messages.length === 0 ? (
              <div className="msg-empty">暂无消息</div>
            ) : messages.map(renderMessageItem)}
          </div>
        </div>
      </>
    );
  }

  // 下拉模式
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
              {unreadCount > 0 && <button className="btn-action btn-text" onClick={markAllAsRead}>全部已读</button>}
              {messages.length > 0 && <button className="btn-action btn-text" onClick={clearAll}>全部清空</button>}
            </div>
          </div>
          <div className="msg-list">
            {messages.length === 0 ? (
              <div className="msg-empty">暂无消息</div>
            ) : messages.map(renderMessageItem)}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageCenter;
