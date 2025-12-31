/**
 * 更新通知组件
 */

import { useState, useEffect } from 'react';
import {
  onUpdateStatus,
  downloadUpdate,
  installUpdate,
  formatSize,
  type UpdateStatus,
  type VersionInfo,
} from '../services/updater';
import './UpdateNotification.css';

const UpdateNotification = () => {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [visible, setVisible] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [downloadPath, setDownloadPath] = useState<string>('');

  useEffect(() => {
    const unlisten = onUpdateStatus((s) => {
      setStatus(s);
      
      if (s.type === 'Available') {
        setVersionInfo(s.info);
        setVisible(true);
      } else if (s.type === 'Downloaded') {
        setDownloadPath(s.path);
      } else if (s.type === 'NotAvailable') {
        // 没有更新时不显示
        setVisible(false);
      }
    });

    return () => { unlisten.then(fn => fn()); };
  }, []);

  const handleDownload = async () => {
    if (!versionInfo) return;
    try {
      await downloadUpdate(versionInfo);
    } catch (err) {
      console.error('下载失败:', err);
    }
  };

  const handleInstall = async () => {
    if (!downloadPath) return;
    try {
      await installUpdate(downloadPath);
    } catch (err) {
      console.error('安装失败:', err);
    }
  };

  const handleClose = () => {
    if (versionInfo?.mandatory) return; // 强制更新不能关闭
    setVisible(false);
  };

  if (!visible || !status) return null;

  return (
    <div className="update-notification-overlay">
      <div className="update-notification">
        <div className="update-header">
          <h3>🎉 发现新版本</h3>
          {!versionInfo?.mandatory && (
            <button className="close-btn" onClick={handleClose}>×</button>
          )}
        </div>

        <div className="update-body">
          {status.type === 'Available' && versionInfo && (
            <>
              <div className="version-info">
                <span className="version-tag">v{versionInfo.version}</span>
                <span className="release-date">{versionInfo.release_date}</span>
              </div>
              <div className="changelog">
                <h4>更新内容：</h4>
                <pre>{versionInfo.changelog}</pre>
              </div>
            </>
          )}

          {status.type === 'Downloading' && (
            <div className="download-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${status.progress}%` }} />
              </div>
              <div className="progress-text">
                下载中... {status.progress.toFixed(1)}%
                <span className="progress-size">
                  {formatSize(status.downloaded)} / {formatSize(status.total)}
                </span>
              </div>
            </div>
          )}

          {status.type === 'Downloaded' && (
            <div className="download-complete">
              ✅ 下载完成，点击安装开始更新
            </div>
          )}

          {status.type === 'Installing' && (
            <div className="installing">
              ⏳ 正在安装更新...
            </div>
          )}

          {status.type === 'Error' && (
            <div className="error-message">
              ❌ {status.message}
            </div>
          )}
        </div>

        <div className="update-footer">
          {status.type === 'Available' && (
            <>
              {!versionInfo?.mandatory && (
                <button className="btn-later" onClick={handleClose}>稍后提醒</button>
              )}
              <button className="btn-download" onClick={handleDownload}>
                立即下载
              </button>
            </>
          )}

          {status.type === 'Downloaded' && (
            <button className="btn-install" onClick={handleInstall}>
              立即安装
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
