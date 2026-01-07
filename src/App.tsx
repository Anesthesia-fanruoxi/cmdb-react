/**
 * 应用根组件
 * 适配新存储架构
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { createAppRouter, preloadHome } from './router';
import { useAuthStore } from './stores/authStore';
import { useAppStore } from './stores/appStore';
import { usePageStateStore } from './stores/pageStateStore';
import { useMenuStore } from './stores/menuStore';
import { initSecurity } from './utils/security';
import { getUserAvatar, startAutoSave, stopAutoSave, forceSave } from './services/storage';
import { StatusModalContainer } from './components/StatusModal';
import { startAutoCheck } from './services/updater';
import { isTauriEnv } from './services/machine';
import './App.css';

type FlowType = 'none' | 'token' | 'login' | 'clear';

const FLOW_STEPS: Record<FlowType, string[]> = {
  none: [],
  token: ['验证登录', '加载菜单', '恢复工作区', '准备就绪'],
  login: ['登录成功', '加载菜单', '初始化工作区', '准备就绪'],
  clear: ['开始清除', '清除数据', '清除完成', '启动中'],
};

function App() {
  const { isAuthenticated, initFromStorage, userName } = useAuthStore();
  const { initTheme, theme } = useAppStore();
  const initRef = useRef(false);
  
  const [ready, setReady] = useState(false);
  const [flowType, setFlowType] = useState<FlowType>('none');
  const [currentStep, setCurrentStep] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // 自动保存管理
  useEffect(() => {
    const { token } = useAuthStore.getState();
    if (!ready || !token) return;

    // 启动自动保存
    void startAutoSave();

    return () => {
      // 组件卸载时强制保存并停止
      forceSave();
      stopAutoSave();
    };
  }, [ready]);

  // 执行流程动画
  const runFlowWithTasks = async (
    type: FlowType,
    tasks: Array<() => Promise<void>>
  ): Promise<void> => {
    const steps = FLOW_STEPS[type];
    if (steps.length === 0) return;
    
    setFlowType(type);
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      if (tasks[i]) {
        await tasks[i]();
      }
      await new Promise(r => setTimeout(r, 300));
    }
    setFlowType('none');
  };

  // 启动逻辑
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const startup = async () => {
      const params = new URLSearchParams(window.location.search);
      const from = params.get('from');
      const clear = params.get('clear');
      const isDetached = window.location.pathname === '/detached';
      
      if (from || clear) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      
      // 退出登录 - 快速显示登录页，但仍需初始化存储
      if (from === 'logout') {
        initTheme();
        await initFromStorage();
        setReady(true);
        return;
      }
      
      // 独立窗口
      if (isDetached) {
        initSecurity();
        initTheme();
        await initFromStorage();
        setReady(true);
        return;
      }

      initSecurity();
      
      // Tauri 环境下启动自动更新检查
      if (isTauriEnv()) {
        startAutoCheck(5);
      }
      
      // 初始化存储（会自动恢复主题和状态）
      await initFromStorage();
      
      // 加载用户头像
      const currentUser = useAuthStore.getState().userName;
      if (currentUser) {
        const avatar = getUserAvatar(currentUser);
        if (avatar) setAvatarUrl(avatar);
      }
      
      const hasToken = !!useAuthStore.getState().token;

      // 清除缓存
      if (clear === '1') {
        await runFlowWithTasks('clear', [
          async () => {},
          async () => {
            usePageStateStore.getState().clearAllPageStates();
            useMenuStore.getState().delAllViews();
          },
          async () => {},
          async () => {},
        ]);
        setReady(true);
        return;
      }

      // 登录成功后
      if (from === 'login' && hasToken) {
        await runFlowWithTasks('login', [
          async () => {},
          async () => {
            await Promise.all([
              useMenuStore.getState().fetchUserMenus(),
              useAuthStore.getState().fetchProfile(),
              preloadHome(),
            ]);
          },
          async () => {},
          async () => {},
        ]);
        setReady(true);
        return;
      }

      // 正常启动（有 token）
      if (hasToken) {
        await runFlowWithTasks('token', [
          async () => {},
          async () => {
            await Promise.all([
              useMenuStore.getState().fetchUserMenus(),
              useAuthStore.getState().fetchProfile(),
              preloadHome(),
            ]);
          },
          async () => {},
          async () => {},
        ]);
      }
      setReady(true);
    };

    startup();
  }, [initFromStorage, initTheme]);

  const router = useMemo(
    () => createAppRouter(isAuthenticated),
    [isAuthenticated]
  );

  // 启动画面
  if (flowType !== 'none' || !ready) {
    const steps = flowType !== 'none' ? FLOW_STEPS[flowType] : [];
    const showProgress = flowType !== 'none' && steps.length > 0;
    
    return (
      <div className={`startup-container ${theme === 'light' ? 'light' : ''}`}>
        <div className="startup-content">
          <div className="startup-logo">CMDB</div>
          {userName && <div className="startup-username">{userName}</div>}
          <div className="startup-spinner-wrapper">
            <div className="startup-spinner" />
            {avatarUrl && <img src={avatarUrl} alt="头像" className="startup-avatar" />}
          </div>
          <p className="startup-message">
            {showProgress ? `${steps[currentStep]}...` : '启动中...'}
          </p>
          {showProgress && (
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
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <RouterProvider router={router} />
      <StatusModalContainer />
    </>
  );
}

export default App;
