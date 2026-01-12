/**
 * 启动动画组件
 * 显示各场景的启动动画
 */

import { useEffect, useState } from 'react';
import { getUserAvatar } from '../../services/storage';
import './style.css';

export type FlowType = 'none' | 'init' | 'token' | 'credential' | 'login' | 'clear' | 'logout';

export const FLOW_STEPS: Record<FlowType, string[]> = {
  none: [],
  init: ['初始化中', '准备就绪'],
  token: ['验证登录', '加载菜单', '恢复工作区', '准备就绪'],
  credential: ['验证凭据', '登录成功', '加载菜单', '恢复工作区', '准备就绪'],
  login: ['登录成功', '加载菜单', '恢复工作区', '准备就绪'],
  clear: ['开始清除缓存', '清除完成', '重新获取权限', '启动中'],
  logout: ['保存工作区', '退出登录', '初始化中'],
};

interface StartupScreenProps {
  flowType: FlowType;
  currentStep: number;
  userName?: string | null;
  theme?: 'light' | 'dark';
}

const StartupScreen = ({ flowType, currentStep, userName, theme = 'dark' }: StartupScreenProps) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const steps = FLOW_STEPS[flowType];

  // 加载用户头像
  useEffect(() => {
    if (userName) {
      const avatar = getUserAvatar(userName);
      if (avatar) setAvatarUrl(avatar);
    }
  }, [userName]);

  if (flowType === 'none' || steps.length === 0) {
    return null;
  }

  return (
    <div className={`startup-screen ${theme === 'light' ? 'light' : ''}`}>
      <div className="startup-content">
        <div className="startup-logo">CMDB</div>
        
        {userName && <div className="startup-username">{userName}</div>}
        
        <div className="startup-spinner-wrapper">
          <div className="startup-spinner" />
          {avatarUrl && <img src={avatarUrl} alt="头像" className="startup-avatar" />}
        </div>
        
        <p className="startup-message">
          {steps[currentStep] || '启动中'}...
        </p>
        
        <div className="startup-progress">
          {steps.map((step, i) => (
            <div 
              key={step} 
              className={`progress-step ${i < currentStep ? 'done' : i === currentStep ? 'active' : ''}`}
            >
              {step}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StartupScreen;
