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
import { createAppRouter } from './router';
import { useAuthStore } from './stores/authStore';
import { useAppStore } from './stores/appStore';
import { usePageStateStore } from './stores/pageStateStore';
import { useMenuStore } from './stores/menuStore';
import { initSecurity } from './utils/security';
import { cleanupLegacyStorage, encryptedStorage } from './utils/persistStorage';
import { StatusModalContainer } from './components/StatusModal';
import './App.css';

// 流程类型
type FlowType = 'none' | 'token' | 'login' | 'clear';

// 流程步骤
const FLOW_STEPS: Record<FlowType, string[]> = {
  none: [],
  token: ['获取Token', '跳过登录', '恢复工作区'],
  login: ['登录中', '恢复工作区'],
  clear: ['开始清除', '清除数据', '清除完成', '启动中'],
};

function App() {
  const { isAuthenticated, initFromStorage } = useAuthStore();
  const { initTheme } = useAppStore();
  const initRef = useRef(false);
  const saveIntervalRef = useRef<number | null>(null);
  
  // 状态
  const [ready, setReady] = useState(false);
  const [flowType, setFlowType] = useState<FlowType>('none');
  const [currentStep, setCurrentStep] = useState(0);

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

  // 执行流程动画
  const runFlow = async (type: FlowType): Promise<void> => {
    const steps = FLOW_STEPS[type];
    if (steps.length === 0) return;
    
    setFlowType(type);
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      await new Promise(r => setTimeout(r, 500));
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
      
      // 独立窗口：跳过启动流程，直接显示
      if (isDetached) {
        initSecurity();
        initTheme();
        await initFromStorage();
        setReady(true);
        return;
      }
      
      // 清理 URL 参数
      if (from || clear) {
        window.history.replaceState({}, '', window.location.pathname);
      }

      // 初始化基础设置
      initSecurity();
      initTheme();
      
      // 等待存储初始化完成
      await initFromStorage();
      
      // 获取最新的认证状态
      const hasToken = !!useAuthStore.getState().token;

      // 场景1: 退出登录 - 直接显示登录页
      if (from === 'logout') {
        setReady(true);
        return;
      }

      // 场景2: 清除缓存（清除完成后直接进入首页，不再跳转）
      if (clear === '1') {
        await runFlow('clear');
        usePageStateStore.getState().clearAllPageStates();
        useMenuStore.getState().delAllViews();
        setReady(true);
        return;
      }

      // 场景3: 登录成功后（有 token 且来自登录页）
      if (from === 'login' && hasToken) {
        // 清理旧的无前缀存储数据
        await cleanupLegacyStorage();
        await runFlow('login');
        // 登录后重新加载页面状态和菜单状态
        await usePageStateStore.getState().rehydrate();
        await useMenuStore.getState().rehydrate();
        setReady(true);
        return;
      }

      // 场景4: 正常启动
      if (hasToken) {
        await runFlow('token');
        // 确保页面状态和菜单状态已加载
        await usePageStateStore.getState().rehydrate();
        await useMenuStore.getState().rehydrate();
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

  // 显示流程动画
  if (flowType !== 'none') {
    const steps = FLOW_STEPS[flowType];
    return (
      <div className="startup-container">
        <div className="startup-content">
          <div className="startup-logo">CMDB</div>
          <div className="startup-spinner" />
          <p className="startup-message">{steps[currentStep]}...</p>
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
  }

  // 等待初始化完成
  if (!ready) {
    return null;
  }

  return (
    <>
      <RouterProvider router={router} />
      <StatusModalContainer />
    </>
  );
}

export default App;
