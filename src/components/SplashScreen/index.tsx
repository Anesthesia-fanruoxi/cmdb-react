/**
 * 启动页组件
 * 显示应用启动时的加载状态
 */

import './style.css';

interface SplashScreenProps {
  message?: string;
}

const SplashScreen = ({ message = '启动中...' }: SplashScreenProps) => {
  return (
    <div className="splash-screen">
      <div className="splash-content">
        <div className="splash-logo">🖥️</div>
        <h1 className="splash-title">CMDB</h1>
        <p className="splash-subtitle">运维管理平台</p>
        <div className="splash-loader">
          <div className="splash-spinner"></div>
          <span className="splash-message">{message}</span>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
