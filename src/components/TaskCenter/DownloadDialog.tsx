/**
 * 下载对话框组件
 * 显示临时下载链接（60秒有效）并支持进度显示
 */

import { useEffect, useState } from 'react';
import { X, Download, Clock, Loader2, Copy, Check, FolderOpen, FileText } from 'lucide-react';
import { dialogStackManager } from '../../utils/dialogStack';
import { downloadWithProgress, formatFileSize, formatSpeed, type DownloadProgress, type DownloadResult } from '../../utils/download';
import { openFolder, showInFolder, openFile, getDownloadDir } from '../../utils/fileSystem';
import { formatDateTime } from '../../utils/datetime';
import { isTauriEnv } from '../../services/machine';
import { useMessageStore } from '../../stores/messageStore';
import { toast } from '../Toast';

interface DownloadDialogProps {
  visible: boolean;
  downloadUrl: string;
  taskType?: string;    // 任务类型
  taskId?: string;      // 任务ID
  onClose: () => void;
}

const DownloadDialog = ({ visible, downloadUrl, taskType, taskId, onClose }: DownloadDialogProps) => {
  const [countdown, setCountdown] = useState(60);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(null);
  const [downloadDir, setDownloadDir] = useState('');
  const addMessage = useMessageStore(state => state.addMessage);

  // 倒计时
  useEffect(() => {
    if (!visible) {
      setCountdown(60);
      setDownloading(false);
      setProgress(null);
      setCopied(false);
      setDownloadResult(null);
      return;
    }

    // 获取下载目录
    if (isTauriEnv()) {
      getDownloadDir().then(dir => setDownloadDir(dir));
    }

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!downloading && !downloadResult) {
            onClose();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible, onClose, downloading, downloadResult]);

  // ESC 关闭
  useEffect(() => {
    const dialogId = 'download-dialog';
    
    if (!visible) {
      dialogStackManager.pop(dialogId);
      return;
    }
    
    dialogStackManager.push(dialogId);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dialogStackManager.isTop(dialogId)) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      dialogStackManager.pop(dialogId);
    };
  }, [visible, onClose]);

  // 处理下载
  const handleDownload = async () => {
    if (downloading) return;
    
    // 生成文件名：type-任务id-yymmddhhmmss.xlsx
    const timestamp = formatDateTime();
    const type = taskType || 'download';
    const id = taskId || 'unknown';
    const filename = `${type}-${id}-${timestamp}.xlsx`;
    
    // 立即关闭对话框
    onClose();
    
    // 显示 toast 提示
    toast.info('开始下载...');
    
    // 后台下载（不添加到消息中心）
    setDownloading(true);
    setProgress({ loaded: 0, total: 0, percentage: 0, speed: 0 });
    
    await downloadWithProgress({
      url: downloadUrl,
      filename: filename,
      onProgress: (prog) => {
        setProgress(prog);
      },
      onSuccess: (result) => {
        setDownloading(false);
        setDownloadResult(result);
        
        // 构建完整文件路径
        const dir = downloadDir || '';
        const separator = dir.includes('\\') ? '\\' : '/';
        const fullPath = dir ? `${dir}${separator}${result.filename}` : result.filename;
        
        // 下载成功后添加消息到消息中心
        addMessage({
          type: 'success',
          title: '下载完成',
          content: `文件已保存: ${result.filename}`,
          action: {
            type: 'download',
          },
          extra: {
            filename: result.filename,
            filePath: fullPath,
            downloadDir: dir,
          },
        });
        
        toast.success('下载完成');
      },
      onError: (error) => {
        setDownloading(false);
        setProgress(null);
        
        // 下载失败后添加消息
        addMessage({
          type: 'error',
          title: '下载失败',
          content: error.message || '下载文件时发生错误',
        });
        
        toast.error(`下载失败: ${error.message}`);
      },
    });
  };

  // 复制下载链接
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(downloadUrl);
      setCopied(true);
      toast.success('下载链接已复制');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('复制失败');
    }
  };

  // 打开下载文件夹
  const handleOpenFolder = async () => {
    if (!downloadDir) {
      toast.error('无法获取下载目录');
      return;
    }
    
    try {
      await openFolder(downloadDir);
    } catch (error) {
      console.error('打开文件夹失败:', error);
      toast.error('打开文件夹失败');
    }
  };

  // 在文件夹中显示文件
  const handleShowInFolder = async () => {
    if (!downloadResult) return;
    
    try {
      // 构建完整文件路径
      let filePath: string;
      if (downloadDir) {
        const separator = downloadDir.includes('\\') ? '\\' : '/';
        filePath = `${downloadDir}${separator}${downloadResult.filename}`;
      } else {
        filePath = downloadResult.filePath;
      }
      
      await showInFolder(filePath);
    } catch (error) {
      console.error('在文件夹中显示失败:', error);
      toast.error('在文件夹中显示失败');
    }
  };

  // 打开文件
  const handleOpenFile = async () => {
    if (!downloadResult) return;
    
    try {
      // 构建完整文件路径
      let filePath: string;
      if (downloadDir) {
        const separator = downloadDir.includes('\\') ? '\\' : '/';
        filePath = `${downloadDir}${separator}${downloadResult.filename}`;
      } else {
        filePath = downloadResult.filePath;
      }
      
      await openFile(filePath);
    } catch (error) {
      console.error('打开文件失败:', error);
      toast.error('打开文件失败');
    }
  };

  if (!visible) return null;

  return (
    <div className="download-dialog-overlay" onClick={onClose}>
      <div className="download-dialog" onClick={e => e.stopPropagation()}>
        <div className="download-dialog-header">
          <h3>下载文件</h3>
          <button className="close-btn" onClick={onClose} disabled={downloading}>
            <X size={18} />
          </button>
        </div>
        <div className="download-dialog-content">
          {downloadResult ? (
            // 下载完成状态
            <div className="download-success-container">
              <div className="success-icon">✓</div>
              <h4>下载完成</h4>
              
              <div className="file-info-section">
                <label className="file-info-label">文件名</label>
                <div className="file-info-value">{downloadResult.filename}</div>
              </div>
              
              {downloadDir && (
                <div className="file-info-section">
                  <label className="file-info-label">保存位置</label>
                  <div className="file-info-value file-path">{downloadDir}</div>
                </div>
              )}
              
              <div className="success-actions">
                {isTauriEnv() && (
                  <>
                    <button className="btn-action" onClick={handleOpenFolder}>
                      <FolderOpen size={20} />
                      <span>打开文件夹</span>
                    </button>
                    <button className="btn-action" onClick={handleShowInFolder}>
                      <FileText size={20} />
                      <span>定位文件</span>
                    </button>
                    <button className="btn-action" onClick={handleOpenFile}>
                      <Download size={20} />
                      <span>打开文件</span>
                    </button>
                  </>
                )}
                <button className="btn-action btn-close" onClick={onClose}>
                  <X size={20} />
                  <span>关闭</span>
                </button>
              </div>
            </div>
          ) : downloading ? (
            // 下载中状态
            <div className="download-progress-container">
              <div className="progress-header">
                <Loader2 size={20} className="spin" />
                <span>正在下载...</span>
              </div>
              
              {progress && (
                <>
                  <div className="progress-bar-wrapper">
                    <div className="progress-bar">
                      <div 
                        className="progress-bar-fill" 
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                    <span className="progress-percentage">{progress.percentage}%</span>
                  </div>
                  
                  <div className="progress-info">
                    <span className="progress-size">
                      {formatFileSize(progress.loaded)}
                      {progress.total > 0 && ` / ${formatFileSize(progress.total)}`}
                    </span>
                    {progress.speed > 0 && (
                      <span className="progress-speed">{formatSpeed(progress.speed)}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            // 初始状态
            <>
              <div className="download-info">
                <Clock size={20} />
                <span>下载链接有效期：<strong>{countdown}</strong> 秒</span>
              </div>
              
              <div className="download-url-section">
                <label className="download-url-label">下载链接</label>
                <div className="download-url-box">
                  <input 
                    type="text" 
                    className="download-url-input" 
                    value={downloadUrl} 
                    readOnly 
                  />
                  <button 
                    className="btn-copy" 
                    onClick={handleCopyLink}
                    title="复制链接"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
              
              <p className="download-tip">
                链接在有效期内可多次使用
              </p>
              
              <button className="btn-download" onClick={handleDownload}>
                <Download size={16} />
                立即下载
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DownloadDialog;
