/**
 * 系统信息独立页面
 * 用于分离窗口显示
 */

import { useState, useEffect, useRef } from 'react';
import { HardDrive, Database, RefreshCw, Download, CheckCircle } from 'lucide-react';
import { isTauriEnv, getSystemInfo, type SystemInfo } from '../../services/machine';
import { checkUpdate, downloadUpdate, installUpdate, onUpdateStatus, formatSize, type VersionInfo, type UpdateStatus } from '../../services/updater';
import toast from '../../components/Toast';
import './style.css';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'v0.0.1';

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

declare const __BUILD_TIME__: string;

const SystemInfoPage = () => {
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [newVersion, setNewVersion] = useState<VersionInfo | null>(null);
  const [downloadedPath, setDownloadedPath] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const fetchSysInfo = async () => {
    if (!isTauriEnv()) return;
    try {
      const info = await getSystemInfo();
      setSysInfo(info);
    } catch (err) {
      console.error('获取系统信息失败:', err);
    }
  };

  useEffect(() => {
    fetchSysInfo();
    timerRef.current = window.setInterval(fetchSysInfo, 2000);
    
    // 监听更新状态
    let unlisten: (() => void) | null = null;
    if (isTauriEnv()) {
      onUpdateStatus((status) => {
        setUpdateStatus(status);
        if (status.type === 'Available') {
          setNewVersion(status.info);
        } else if (status.type === 'Downloaded') {
          setDownloadedPath(status.path);
        }
      }).then(fn => { unlisten = fn; });
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (unlisten) unlisten();
    };
  }, []);

  const handleCheckUpdate = async () => {
    if (!isTauriEnv()) return;
    try {
      const result = await checkUpdate();
      if (result) {
        setNewVersion(result);
        toast.success(`发现新版本: ${result.version}`);
      } else {
        toast.info('当前已是最新版本');
      }
    } catch (err) {
      toast.error('检查更新失败');
    }
  };

  const handleDownload = async () => {
    if (!newVersion) return;
    try {
      const path = await downloadUpdate(newVersion);
      setDownloadedPath(path);
      toast.success('下载完成');
    } catch (err) {
      toast.error('下载失败');
    }
  };

  const handleInstall = async () => {
    if (!downloadedPath) return;
    try {
      await installUpdate(downloadedPath);
    } catch (err) {
      toast.error('安装失败');
    }
  };

  const getOsDisplay = () => {
    if (!sysInfo) return '加载中...';
    return `${sysInfo.os_name} ${sysInfo.os_version}`;
  };

  const isChecking = updateStatus?.type === 'Checking';
  const isDownloading = updateStatus?.type === 'Downloading';

  return (
    <div className="system-info-page">
      <div className="system-info-logo">
        <span className="logo-icon">🖥️</span>
        <span className="logo-text">CMDB 运维管理系统</span>
      </div>
      
      <div className="system-info-list">
        <div className="info-item">
          <span className="info-label">当前版本</span>
          <span className="info-value">{APP_VERSION}</span>
        </div>
        <div className="info-item">
          <span className="info-label">操作系统</span>
          <span className="info-value">{getOsDisplay()}</span>
        </div>
        <div className="info-item">
          <span className="info-label">构建时间</span>
          <span className="info-value">{__BUILD_TIME__ || '-'}</span>
        </div>
      </div>

      {/* 更新检查区域 */}
      {isTauriEnv() && (
        <div className="update-section">
          <h4>版本更新</h4>
          {!newVersion ? (
            <button className="btn-check-update" onClick={handleCheckUpdate} disabled={isChecking}>
              <RefreshCw size={14} className={isChecking ? 'spin' : ''} />
              {isChecking ? '检查中...' : '检查更新'}
            </button>
          ) : !downloadedPath ? (
            <div className="update-available">
              <div className="version-info">
                <span className="new-version">新版本: {newVersion.version}</span>
                {newVersion.changelog && <p className="changelog">{newVersion.changelog}</p>}
              </div>
              <button className="btn-download" onClick={handleDownload} disabled={isDownloading}>
                <Download size={14} />
                {isDownloading ? `下载中 ${(updateStatus as any).progress?.toFixed(0) || 0}%` : '下载更新'}
              </button>
            </div>
          ) : (
            <div className="update-ready">
              <span className="ready-text"><CheckCircle size={14} /> 下载完成，准备安装</span>
              <button className="btn-install" onClick={handleInstall}>立即安装</button>
            </div>
          )}
        </div>
      )}
      
      {isTauriEnv() && (
        <div className="resource-section">
          <h4>应用资源</h4>
          <div className="info-item">
            <span className="info-label"><HardDrive size={14} /> 内存占用</span>
            <span className="info-value realtime">{sysInfo ? formatBytes(sysInfo.process_memory) : '-'}</span>
          </div>
          <div className="info-item">
            <span className="info-label"><Database size={14} /> 数据存储</span>
            <span className="info-value">{sysInfo ? formatBytes(sysInfo.storage_size) : '-'}</span>
          </div>
        </div>
      )}
      
      <div className="system-info-footer">
        <p>© 2024-2025 CMDB Team. All rights reserved.</p>
      </div>
    </div>
  );
};

export default SystemInfoPage;
