/**
 * 系统信息独立页面
 * 用于分离窗口显示
 */

import { useState, useEffect, useRef } from 'react';
import { HardDrive, Database } from 'lucide-react';
import { isTauriEnv, getSystemInfo, type SystemInfo } from '../../services/machine';
import './style.css';
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
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const getOsDisplay = () => {
    if (!sysInfo) return '加载中...';
    return `${sysInfo.os_name} ${sysInfo.os_version}`;
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
