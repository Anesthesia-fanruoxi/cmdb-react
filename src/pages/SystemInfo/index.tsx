/**
 * 系统信息独立页面
 */

import { useState, useEffect, useRef } from 'react';
import { HardDrive, Database, RefreshCw, Download } from 'lucide-react';
import { isTauriEnv, getSystemInfo, type SystemInfo } from '../../services/machine';
import { checkUpdate, installUpdate } from '../../services/updater';
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
  const [installing, setInstalling] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const init = async () => {
      // 独立窗口需要先初始化存储
      await initAllStorage();
      initTheme();
      
      // 检查是否有已下载的更新
      const info = getUpdateInfo();
      console.log('[SystemInfo] 更新信息:', info);
      if (info.downloadedVersion || info.latestVersion) {
        setUpdateInfo(info);
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
    if (!isTauriEnv() || checking) return;
    setChecking(true);
    try {
      const result = await checkUpdate();
      if (result) {
        // 有新版本，获取完整的更新信息
        const info = getUpdateInfo();
        setUpdateInfo({
          ...info,
          latestVersion: result.version,
          downloadedVersion: info.downloadedVersion || result.version,
          changelog: result.changelog,
        });
        setShowUpdateModal(true);
      } else {
        toast.info('当前已是最新版本');
      }
    } catch (err: any) {
      const msg = err?.message || '检查更新失败';
      toast.error(msg);
    } finally {
      setChecking(false);
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

  return (
    <div className="system-info-page">
      <div className="system-info-logo">
        <span className="logo-icon">🖥️</span>
        <span className="logo-text">CMDB 运维管理系统</span>
      </div>

      <div className="system-info-list">
        <div className="info-item">
          <span className="info-label">当前版本</span>
          <span className="info-value">
            {APP_VERSION}
            {updateInfo?.downloadedVersion ? (
              <button className="btn-update-now" onClick={() => setShowUpdateModal(true)} title="立即更新">
                <Download size={12} />
                <span>更新</span>
              </button>
            ) : (
              <button className="btn-check" onClick={handleCheckUpdate} disabled={checking} title="检查更新">
                <RefreshCw size={12} className={checking ? 'spin' : ''} />
              </button>
            )}
          </span>
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
