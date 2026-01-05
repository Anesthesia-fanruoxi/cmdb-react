/**
 * 应用根组件
 * 
 * 登录流程：
 * 1. 有 Token：显示流程动画（获取Token → 跳过登录 → 恢复工作区）→ 进入首页
 * 2. 无 Token：直接显示登录页
 * 3. 登录成功：显示流程动画（登录中 → 恢复工作区）→ 进入首页
 * 4. 退出登录：直接回到登录页（无动画）
 * 5. 清除缓存：显示清除流程动画 → 刷新页面
 * 
 * 状态保存：
 * - 每30秒自动保存一次当前状态
 * - 退出前触发保存一次
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { RouterProvider } from 'react-router-dom';
import { createAppRouter, preloadHome } from './router';
import { useAuthStore } from './stores/authStore';
import { useAppStore } from './stores/appStore';
import { usePageStateStore } from './stores/pageStateStore';
import { useMenuStore } from './stores/menuStore';
import { initSecurity } from './utils/security';
import { cleanupLegacyStorage, encryptedStorage } from './utils/persistStorage';
import { getUserName, loadAvatar } from './utils/storage';
import { StatusModalContainer } from './components/StatusModal';
import { startAutoCheck } from './services/updater';
import { useUpdateStore } from './stores/updateStore';
import { isTauriEnv } from './services/machine';
import './App.css';

// 流程类型
type FlowType = 'none' | 'token' | 'login' | 'clear';

// 流程步骤
const FLOW_STEPS: Record<FlowType, string[]> = {
  none: [],
  token: ['验证登录', '加载菜单', '恢复工作区', '准备就绪'],
  login: ['登录成功', '加载菜单', '恢复工作区', '准备就绪'],
  clear: ['开始清除', '清除数据', '清除完成', '启动中'],
};

function App() {
  const { isAuthenticated, initFromStorage } = useAuthStore();
  const { initTheme, theme } = useAppStore();
  const initRef = useRef(false);
  const saveIntervalRef = useRef<number | null>(null);
  
  // 状态
  const [ready, setReady] = useState(false);
  const [flowType, setFlowType] = useState<FlowType>('none');
  const [currentStep, setCurrentStep] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // 强制保存状态到存储
  const forceSaveState = useCallback(async () => {
    const hasToken = !!useAuthStore.getState().token;
    if (!hasToken) return;
    
    try {
      // 保存菜单状态
      const menuState = useMenuStore.getState();
      const menuData = JSON.stringify({
        state: {
          visitedViews: menuState.visitedViews,
          cachedViews: menuState.cachedViews,
          collapsed: menuState.collapsed,
        },
        version: 0,
      });
      await encryptedStorage.setItem('menu-state', menuData);
      
      // 保存页面状态
      const pageState = usePageStateStore.getState();
      const pageData = JSON.stringify({
        state: {
          pages: pageState.pages,
          lastRoute: pageState.lastRoute,
          lastSaveTime: Date.now(),
        },
        version: 0,
      });
      await encryptedStorage.setItem('page-state', pageData);
    } catch (e) {
      // 静默处理保存失败
    }
  }, []);

  // 设置定时保存和退出前保存
  useEffect(() => {
    const hasToken = !!useAuthStore.getState().token;
    if (!ready || !hasToken) return;

    // 每30秒自动保存一次
    saveIntervalRef.current = window.setInterval(() => {
      forceSaveState();
    }, 30000);

    // 退出前保存
    const handleBeforeUnload = () => {
      forceSaveState();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [ready, forceSaveState]);

  // 执行流程动画（带任务执行）
  const runFlowWithTasks = async (
    type: FlowType,
    tasks: Array<() => Promise<void>>
  ): Promise<void> => {
    const steps = FLOW_STEPS[type];
    if (steps.length === 0) return;
    
    setFlowType(type);
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      // 执行对应步骤的任务（如果有）
      if (tasks[i]) {
        await tasks[i]();
      }
      // 最小显示时间 300ms，让用户能看到步骤
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
      
      // 清理 URL 参数
      if (from || clear) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      
      // 场景1: 退出登录 - 快速显示登录页，不需要完整初始化
      if (from === 'logout') {
        initTheme();
        setReady(true);
        return;
      }
      
      // 独立窗口：跳过启动流程，直接显示
      if (isDetached) {
        initSecurity();
        initTheme();
        await initFromStorage();
        setReady(true);
        return;
      }

      // 初始化基础设置
      initSecurity();
      initTheme();
      
      // Tauri 环境下启动自动更新检查
      if (isTauriEnv()) {
        startAutoCheck(5, () => useUpdateStore.getState().checkForUpdate());
      }
      
      // 等待存储初始化完成
      await initFromStorage();
      
      // 加载用户头像
      const avatar = await loadAvatar();
      if (avatar) setAvatarUrl(avatar);
      
      // 获取最新的认证状态
      const hasToken = !!useAuthStore.getState().token;

      // 场景2: 清除缓存（清除完成后直接进入首页，不再跳转）
      if (clear === '1') {
        await runFlowWithTasks('clear', [
          async () => {}, // 开始清除
          async () => {
            usePageStateStore.getState().clearAllPageStates();
            useMenuStore.getState().delAllViews();
          }, // 清除数据
          async () => {}, // 清除完成
          async () => {}, // 启动中
        ]);
        setReady(true);
        return;
      }

      // 场景3: 登录成功后（有 token 且来自登录页）
      if (from === 'login' && hasToken) {
        await runFlowWithTasks('login', [
          async () => {
            // 清理旧的无前缀存储数据
            await cleanupLegacyStorage();
          }, // 登录成功
          async () => {
            // 加载菜单、用户信息，同时预加载 Home 组件
            await Promise.all([
              useMenuStore.getState().fetchUserMenus(),
              useAuthStore.getState().fetchProfile(),
              preloadHome(),
            ]);
          }, // 加载菜单
          async () => {
            // 恢复工作区状态
            await usePageStateStore.getState().rehydrate();
            await useMenuStore.getState().rehydrate();
          }, // 恢复工作区
          async () => {}, // 准备就绪
        ]);
        setReady(true);
        return;
      }

      // 场景4: 正常启动（有 token）
      if (hasToken) {
        await runFlowWithTasks('token', [
          async () => {}, // 验证登录
          async () => {
            // 加载菜单、用户信息，同时预加载 Home 组件
            await Promise.all([
              useMenuStore.getState().fetchUserMenus(),
              useAuthStore.getState().fetchProfile(),
              preloadHome(),
            ]);
          }, // 加载菜单
          async () => {
            // 恢复工作区状态
            await usePageStateStore.getState().rehydrate();
            await useMenuStore.getState().rehydrate();
          }, // 恢复工作区
          async () => {}, // 准备就绪
        ]);
      }
      setReady(true);
    };

    startup();
  }, [initFromStorage, initTheme]);

  // 路由 - 使用最新的认证状态
  const router = useMemo(
    () => createAppRouter(isAuthenticated),
    [isAuthenticated]
  );

  // 显示流程动画或初始化等待
  if (flowType !== 'none' || !ready) {
    const steps = flowType !== 'none' ? FLOW_STEPS[flowType] : [];
    const showProgress = flowType !== 'none' && steps.length > 0;
    const userName = getUserName();
    
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
