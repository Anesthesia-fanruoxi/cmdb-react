/**
 * 更新提示弹框 - 科技感设计
 */

import { useState, useEffect } from 'react';
import { X, Download, Sparkles, Rocket } from 'lucide-react';
import { downloadUpdate, installUpdate, onUpdateStatus, type VersionInfo } from '../../services/updater';
import './style.css';

interface Props {
  visible: boolean;
  versionInfo: VersionInfo | null;
  onClose: () => void;
}

const UpdateDialog = ({ visible, versionInfo, onClose }: Props) => {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloaded, setDownloaded] = useState(false);
  const [filePath, setFilePath] = useState('');

  // 重置状态当弹框关闭或版本信息变化
  useEffect(() => {
    if (!visible) {
      setDownloading(false);
      setProgress(0);
      setDownloaded(false);
      setFilePath('');
    }
  }, [visible]);

  // 监听下载进度
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    onUpdateStatus((status) => {
      if (status.type === 'Downloading') {
        setProgress(status.progress);
      } else if (status.type === 'Downloaded') {
        setDownloaded(true);
        setFilePath(status.path);
        setDownloading(false);
      }
    }).then(fn => { unlisten = fn; });
    return () => { if (unlisten) unlisten(); };
  }, []);

  const handleDownload = async () => {
    if (!versionInfo || downloading) return;
    setDownloading(true);
    setProgress(0);
    try {
      const path = await downloadUpdate(versionInfo);
      setFilePath(path);
      setDownloaded(true);
    } catch (err) {
      console.error('下载失败:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleInstall = async () => {
    if (!filePath) return;
    try {
      await installUpdate(filePath);
    } catch (err) {
      console.error('安装失败:', err);
    }
  };

  if (!visible || !versionInfo) return null;

  return (
    <div className="update-dialog-overlay">
      <div className="update-dialog">
        <div className="dialog-glow" />
        <button className="dialog-close" onClick={onClose}><X size={18} /></button>
        
        <div className="dialog-header">
          <div className="icon-wrapper">
            <Sparkles size={32} className="icon-sparkle" />
            <Rocket size={24} className="icon-rocket" />
          </div>
          <h2>发现新版本</h2>
          <div className="version-badge">{versionInfo.version}</div>
        </div>

        <div className="dialog-body">
          <div className="changelog-section">
            <h4>更新内容</h4>
            <div className="changelog-content">
              {versionInfo.changelog 
                ? versionInfo.changelog
                    .replace(/^##\s*/gm, '')  // 去掉 ## 标题
                    .replace(/```[\s\S]*?```/g, '')  // 去掉代码块
                    .replace(/`([^`]+)`/g, '$1')  // 去掉行内代码
                    .replace(/\*\*([^*]+)\*\*/g, '$1')  // 去掉加粗
                    .replace(/\n{3,}/g, '\n\n')  // 多个换行合并
                    .trim()
                : '性能优化与问题修复'}
            </div>
          </div>
        </div>

        <div className="dialog-footer">
          {!downloaded ? (
            <button className="btn-update" onClick={handleDownload} disabled={downloading}>
              {downloading ? (
                <>
                  <div className="progress-ring">
                    <svg viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                      <circle cx="18" cy="18" r="16" fill="none" stroke="#fff" strokeWidth="3"
                        strokeDasharray={`${progress} 100`} strokeLinecap="round" transform="rotate(-90 18 18)" />
                    </svg>
                  </div>
                  <span>下载中 {progress.toFixed(0)}%</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span>立即更新</span>
                </>
              )}
            </button>
          ) : (
            <button className="btn-install" onClick={handleInstall}>
              <Rocket size={18} />
              <span>安装并重启</span>
            </button>
          )}
          <button className="btn-later" onClick={onClose}>稍后提醒</button>
        </div>

        <div className="dialog-particles">
          {[...Array(6)].map((_, i) => <div key={i} className="particle" style={{ '--i': i } as any} />)}
        </div>
      </div>
    </div>
  );
};

export default UpdateDialog;
