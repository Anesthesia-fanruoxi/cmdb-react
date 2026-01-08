/**
 * 更新提示弹窗
 * 启动时检测到新版本时显示
 */

import { Modal, Button } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import type { UpdateInfo } from '@/services/storage';
import { getDefaultTheme } from '@/services/storage';
import './style.css';

interface UpdateModalProps {
  open: boolean;
  updateInfo: UpdateInfo | null;
  onInstall: () => void;
  onSkip: () => void;
  installing?: boolean;
}

export function UpdateModal({
  open,
  updateInfo,
  onInstall,
  onSkip,
  installing = false,
}: UpdateModalProps) {
  // 直接从存储读取主题
  const isDark = getDefaultTheme() === 'dark';
  const shouldShow = open && !!updateInfo;
  const version = updateInfo?.downloadedVersion || updateInfo?.latestVersion || '';

  // 根据主题设置内联样式
  const bgColor = isDark ? '#1f1f1f' : '#fff';
  const textColor = isDark ? '#e5e5e5' : '#1a1a1a';
  const secondaryBg = isDark ? '#141414' : '#f5f5f5';
  const labelColor = isDark ? '#a0a0a0' : '#666';

  return (
    <Modal
      open={shouldShow}
      title={null}
      footer={null}
      closable={false}
      centered
      width={400}
      className={`update-modal ${isDark ? 'dark' : ''}`}
      maskClosable={false}
      styles={{
        container: {
          background: bgColor,
          padding: 0,
          borderRadius: 16,
        },
      }}
    >
      {updateInfo && (
        <div className="update-modal-content" style={{ background: bgColor }}>
          <div className="update-icon">
            <RocketOutlined />
          </div>
          
          <div className="update-title" style={{ color: textColor }}>
            发现新版本 v{version}
          </div>
          
          {updateInfo.changelog && (
            <div 
              className="update-changelog" 
              style={{ 
                background: isDark ? '#141414' : '#f5f5f5', 
                borderColor: isDark ? '#333' : '#e8e8e8' 
              }}
            >
              <div className="changelog-label" style={{ color: labelColor }}>
                更新内容：
              </div>
              <div className="changelog-text" style={{ color: textColor }}>
                {updateInfo.changelog}
              </div>
            </div>
          )}
          
          <div className="update-actions">
            <Button
              type="primary"
              size="large"
              onClick={onInstall}
              loading={installing}
              disabled={!updateInfo.downloadedPath}
              className="install-btn"
            >
              {installing ? '正在安装...' : updateInfo.downloadedPath ? '立即安装' : '等待下载...'}
            </Button>
            <Button
              size="large"
              onClick={onSkip}
              disabled={installing}
              style={{
                background: secondaryBg,
                borderColor: isDark ? '#444' : '#d9d9d9',
                color: textColor,
              }}
            >
              稍后提醒
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
