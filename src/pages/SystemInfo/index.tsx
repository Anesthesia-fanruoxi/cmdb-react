/**
 * 系统信息独立页面
 */

import { useState, useEffect, useRef } from 'react';
import { HardDrive, Database, RefreshCw, Download } from 'lucide-react';
import { isTauriEnv, getSystemInfo, type SystemInfo } from '../../services/machine';
import { checkUpdate, type VersionInfo } from '../../services/updater';
import { useAppStore } from '../../stores/appStore';
import { useUpdateStore } from '../../stores/updateStore';
import UpdateDialog from '../../components/UpdateDialog';
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
  const { hasUpdate, versionInfo: storeVersionInfo, checkForUpdate, clearUpdate } = useUpdateStore();
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [newVersion, setNewVersion] = useState<VersionInfo | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [checking, setChecking] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // 独立窗口需要初始化主题
    initTheme();
    
    // 独立窗口打开时检查更新状态
    checkForUpdate();
    
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
  }, [initTheme, checkForUpdate]);
  
  // 监听 store 中的更新状态变化
  useEffect(() => {
    if (hasUpdate && storeVersionInfo) {
      setNewVersion(storeVersionInfo);
    }
  }, [hasUpdate, storeVersionInfo]);

  const handleCheckUpdate = async () => {
    console.log('点击检查更新, isTauri:', isTauriEnv(), 'checking:', checking);
    if (!isTauriEnv() || checking) return;
    setChecking(true);
    try {
      console.log('开始检查更新，Token:', import.meta.env.VITE_GITHUB_TOKEN ? '已配置' : '未配置');
      const result = await checkUpdate();
      console.log('检查结果:', result);
      if (result) {
        setNewVersion(result);
        setShowUpdateDialog(true);
      } else {
        toast.info('当前已是最新版本');
      }
    } catch (err: any) {
      console.error('检查更新失败:', err);
      const msg = typeof err === 'string' ? err : err?.message || '检查更新失败';
      if (msg.includes('403') || msg.includes('rate limit')) {
        toast.warning('GitHub API 请求频率限制，请稍后再试');
      } else if (msg.includes('404')) {
        toast.info('当前已是最新版本');
      } else {
        toast.error(msg);
      }
    } finally {
      setChecking(false);
    }
  };

  const handleShowUpdate = () => {
    if (newVersion) {
      setShowUpdateDialog(true);
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
            {newVersion ? (
              <button className="btn-update-now" onClick={handleShowUpdate} title="立即更新">
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

      <UpdateDialog
        visible={showUpdateDialog}
        versionInfo={newVersion}
        onClose={() => setShowUpdateDialog(false)}
      />
    </div>
  );
};

export default SystemInfoPage;
