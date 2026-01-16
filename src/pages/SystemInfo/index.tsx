/**
 * 系统信息独立页面
 */

import { useState, useEffect, useRef } from 'react';
import { HardDrive, Database, RefreshCw, Download, Loader2 } from 'lucide-react';
import { isTauriEnv, getSystemInfo, type SystemInfo } from '../../services/machine';
import { checkUpdate, installUpdate, checkAndDownloadUpdate } from '../../services/updater';
import { getUpdateInfo, initAllStorage, type UpdateInfo } from '../../services/storage';
import { useAppStore } from '../../stores/appStore';
import { UpdateModal } from '../../components/UpdateModal';
import toast from '../../components/Toast';
import './style.css';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'v0.0.1';
declare const __BUILD_TIME__: string;

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const SystemInfoPage = () => {
  const { initTheme } = useAppStore();
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const timerRef = useRef<number | null>(null);

  // 判断是否是 Mac 系统
  const isMac = sysInfo?.os_name?.toLowerCase().includes('mac') || 
                sysInfo?.os_name?.toLowerCase().includes('darwin');

  useEffect(() => {
    const init = async () => {
      await initAllStorage();
      initTheme();
      
      const info = getUpdateInfo();
      if (info.downloadedVersion || info.latestVersion) {
        setUpdateInfo(info);
        // 如果正在下载中，恢复下载状态
        if (info.downloadStatus === 'downloading') {
          setDownloading(true);
        }
      }
    };
    
    init();
    
    const fetchSysInfo = async () => {
      if (!isTauriEnv()) return;
      try {
        setSysInfo(await getSystemInfo());
      } catch (err) {
        console.error('获取系统信息失败:', err);
      }
    };

    fetchSysInfo();
    timerRef.current = window.setInterval(fetchSysInfo, 2000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [initTheme]);

  const handleCheckUpdate = async () => {
    if (!isTauriEnv() || checking || downloading) return;
    setChecking(true);
    
    try {
      // 先检查是否有新版本
      const result = await checkUpdate();
      
      if (!result) {
        toast.info('当前已是最新版本');
        setChecking(false);
        return;
      }

      // 有新版本
      if (isMac) {
        // Mac：直接弹出提示，让用户手动下载
        setUpdateInfo({
          latestVersion: result.version,
          downloadedVersion: '',
          downloadedPath: '',
          downloadStatus: 'none',
          downloadProgress: 0,
          changelog: result.changelog,
          lastCheckTime: Date.now(),
        });
        setShowUpdateModal(true);
        setChecking(false);
      } else {
        // Windows：开始下载
        setChecking(false);
        setDownloading(true);
        setUpdateInfo({
          latestVersion: result.version,
          downloadedVersion: '',
          downloadedPath: '',
          downloadStatus: 'downloading',
          downloadProgress: 0,
          changelog: result.changelog,
          lastCheckTime: Date.now(),
        });

        // 开始下载
        const downloadedInfo = await checkAndDownloadUpdate();
        setDownloading(false);
        
        if (downloadedInfo && downloadedInfo.downloadStatus === 'completed') {
          setUpdateInfo(downloadedInfo);
          // 下载完成，弹出安装弹框
          setShowUpdateModal(true);
        } else {
          toast.error('下载更新失败');
        }
      }
    } catch (err: any) {
      const msg = err?.message || '检查更新失败';
      toast.error(msg);
      setChecking(false);
      setDownloading(false);
    }
  };

  const handleInstall = async () => {
    if (!updateInfo?.downloadedPath) return;
    setInstalling(true);
    try {
      await installUpdate(updateInfo.downloadedPath);
    } catch (err) {
      console.error('安装失败:', err);
      setInstalling(false);
    }
  };

  // 渲染版本信息行
  const renderVersionRow = () => {
    // 已下载完成，显示更新按钮
    if (updateInfo?.downloadedVersion && updateInfo.downloadStatus === 'completed') {
      return (
        <span className="info-value">
          {APP_VERSION}
          <button className="btn-update-now" onClick={() => setShowUpdateModal(true)} title="立即更新">
            <Download size={12} />
            <span>更新到 {updateInfo.downloadedVersion}</span>
          </button>
        </span>
      );
    }

    // 正在下载中
    if (downloading) {
      return (
        <span className="info-value">
          {APP_VERSION}
          <span className="download-status">
            <Loader2 size={12} className="spin" />
            <span>下载中 {updateInfo?.latestVersion}...</span>
          </span>
        </span>
      );
    }

    // 默认显示检查更新按钮
    return (
      <span className="info-value">
        {APP_VERSION}
        <button className="btn-check" onClick={handleCheckUpdate} disabled={checking} title="检查更新">
          <RefreshCw size={12} className={checking ? 'spin' : ''} />
        </button>
      </span>
    );
  };

  return (
    <div className="system-info-page">
      <div className="system-info-logo">
        <span className="logo-icon">🖥️</span>
        <span className="logo-text">CMDB 运维管理系统</span>
      </div>

      <div className="system-info-list">
        <div className="info-item">
          <span className="info-label">当前版本</span>
          {renderVersionRow()}
        </div>
        <div className="info-item">
          <span className="info-label">操作系统</span>
          <span className="info-value">{sysInfo ? `${sysInfo.os_name} ${sysInfo.os_version}` : '加载中...'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">构建时间</span>
          <span className="info-value">{__BUILD_TIME__ || '-'}</span>
        </div>
      </div>

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

      <UpdateModal
        open={showUpdateModal}
        updateInfo={updateInfo}
        onInstall={handleInstall}
        onSkip={() => setShowUpdateModal(false)}
        installing={installing}
      />
    </div>
  );
};

export default SystemInfoPage;
