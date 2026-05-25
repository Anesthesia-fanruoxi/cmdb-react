/**
 * 应用根组件
 * 使用启动动画组件管理各场景
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { createAppRouter, preloadHome } from './router';
import { useAuthStore } from './stores/authStore';
import { useAppStore } from './stores/appStore';
import { usePageStateStore } from './stores/pageStateStore';
import { useMenuStore } from './stores/menuStore';
import { initSecurity } from './utils/security';
import { startAutoSave, stopAutoSave, forceSave, initAllStorage, getDefaultTheme } from './services/storage';
import { getLoginHistory, getLastUser } from './services/loginHistory';
import type { UpdateInfo } from './services/storage';
import { StatusModalContainer } from './components/StatusModal';
import { UpdateModal } from './components/UpdateModal';
import StartupScreen, { type FlowType, FLOW_STEPS } from './components/StartupScreen';
import Watermark from './components/Watermark';
import { installUpdate, cleanupOldUpdate, saveInstallPath } from './services/updater';
import { listen } from '@tauri-apps/api/event';
import { isTauriEnv } from './services/machine';
import './App.css';

function App() {
  const { isAuthenticated, initFromStorage, userName } = useAuthStore();
  const { theme, setTheme } = useAppStore();
  const initRef = useRef(false);
  const isDesktopNotifyDetached = useMemo(() => {
    try {
      const href = window.location.href || '';
      const params = new URLSearchParams(window.location.search);
      return params.get('type') === 'desktop-notify' || href.includes('type=desktop-notify');
    } catch {
      return false;
    }
  }, []);
  
  // 通知窗强制所有中间态背景透明，防止白框闪烁
  useEffect(() => {
    if (!isDesktopNotifyDetached) return;
    const style = document.createElement('style');
    style.id = 'notify-override';
    style.textContent = `
      html, body, #root, .loading-container, .loading-state,
      .detached-loading, .startup-screen { background: transparent !important; }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, [isDesktopNotifyDetached]);

  const [ready, setReady] = useState(false);
  const [flowType, setFlowType] = useState<FlowType>('none');
  const [currentStep, setCurrentStep] = useState(0);
  
  // 更新弹窗状态（从 store 获取）
  const { updateModalOpen, openUpdateModal, closeUpdateModal } = useAppStore();
  const [pendingUpdate, setPendingUpdate] = useState<UpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);

  // 监听后端推送的更新事件
  useEffect(() => {
    if (!isTauriEnv()) return;
    
    let unlistenModal: (() => void) | undefined;
    let unlistenSilent: (() => void) | undefined;
    
    listen<{ version: string; changelog: string; msi_path: string }>('update-available', (event) => {
      setPendingUpdate({
        latestVersion: event.payload.version,
        downloadedVersion: event.payload.version,
        downloadedPath: event.payload.msi_path,
        downloadStatus: 'completed',
        downloadProgress: 100,
        changelog: event.payload.changelog,
        lastCheckTime: Date.now(),
      });
      openUpdateModal();
      useAppStore.getState().setUpdateInfo({
        version: event.payload.version,
        changelog: event.payload.changelog,
        msiPath: event.payload.msi_path,
      });
    }).then(fn => { unlistenModal = fn; });
    
    listen<{ version: string; changelog: string; msi_path: string }>('update-available-silent', (event) => {
      setPendingUpdate({
        latestVersion: event.payload.version,
        downloadedVersion: event.payload.version,
        downloadedPath: event.payload.msi_path,
        downloadStatus: 'completed',
        downloadProgress: 100,
        changelog: event.payload.changelog,
        lastCheckTime: Date.now(),
      });
      useAppStore.getState().setUpdateInfo({
        version: event.payload.version,
        changelog: event.payload.changelog,
        msiPath: event.payload.msi_path,
      });
    }).then(fn => { unlistenSilent = fn; });
    
    return () => {
      unlistenModal?.();
      unlistenSilent?.();
    };
  }, []);

  // 自动保存管理
  useEffect(() => {
    const { token } = useAuthStore.getState();
    if (!ready || !token) return;
    void startAutoSave();
    return () => {
      forceSave();
      stopAutoSave();
    };
  }, [ready]);

  // 定时刷新权限
  useEffect(() => {
    const { token } = useAuthStore.getState();
    if (!ready || !token) return;
    const timer = setInterval(() => {
      const { isAuthenticated, fetchProfile } = useAuthStore.getState();
      if (isAuthenticated) {
        fetchProfile().catch(() => {});
      }
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, [ready]);

  // 执行流程动画
  const runFlow = async (type: FlowType, tasks: Array<() => Promise<void>>) => {
    const steps = FLOW_STEPS[type];
    if (steps.length === 0) return;
    
    setFlowType(type);
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      if (tasks[i]) {
        try {
          await tasks[i]();
        } catch (e) {
          console.error(`[App] 步骤 ${i} 失败:`, e);
        }
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
      
      // 独立窗口 - 快速初始化
      if (isDetached) {
        initSecurity();
        await initFromStorage();
        setReady(true);
        return;
      }

      initSecurity();

      // ========== 退出登录 - 直接播放 logout 动画（跳过 init）==========
      if (from === 'logout') {
        // 先读取主题，确保动画显示正确的主题
        const savedTheme = localStorage.getItem('login-theme') as 'light' | 'dark' | null;
        if (savedTheme) {
          setTheme(savedTheme);
          localStorage.removeItem('login-theme');
        }
        
        const { prepareLogout, executeLogout } = useAuthStore.getState();
        
        await runFlow('logout', [
          async () => {
            // 保存工作区
            await prepareLogout();
          },
          async () => {
            // 执行退出登录
            await executeLogout();
          },
          async () => {
            // 初始化中 - 重新读取公共数据
            await initAllStorage();
            const defaultTheme = getDefaultTheme();
            setTheme(defaultTheme);
            
            if (isTauriEnv()) {
              await getLoginHistory();
              await getLastUser();
            }
          },
        ]);
        setReady(true);
        return;
      }

      // ========== 登录成功 - 直接播放 login 动画（跳过 init）==========
      if (from === 'login') {

        // 不再从 URL 读取主题，让 initFromStorage 从用户偏好恢复
        // 主题由用户在应用中切换，保存到 preferences.dat
        
        // 设置 flowType 为 login
        setFlowType('login');
        setCurrentStep(0);
        
        // 初始化存储
        await initAllStorage();
        await initFromStorage();
        
        const hasToken = !!useAuthStore.getState().token;
        if (hasToken) {
          await runFlow('login', [
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
        } else {
          setFlowType('none');
        }
        setReady(true);
        return;
      }

      // ========== 场景1：初始化（首次启动）==========

      await runFlow('init', [
        async () => {
          // 初始化存储
          await initAllStorage();
          
          // 读取登录历史（Rust 后端）
          if (isTauriEnv()) {
            await getLoginHistory();
            await getLastUser();
          }
          
          // Tauri 环境初始化更新相关
          if (isTauriEnv()) {
            try {
              await saveInstallPath();
              await cleanupOldUpdate();
            } catch (e) {
              console.error('[App] 更新初始化失败:', e);
            }
          }
        },
        async () => {
          // 准备就绪 - 初始化存储并恢复用户数据（包括主题）
          await initFromStorage();
        },
      ]);

      const hasToken = !!useAuthStore.getState().token;

      // 清除缓存
      if (clear === '1') {
        await runFlow('clear', [
          async () => {},
          async () => {
            usePageStateStore.getState().clearAllPageStates();
            useMenuStore.getState().delAllViews();
          },
          async () => {
            await Promise.all([
              useMenuStore.getState().fetchUserMenus(),
              useAuthStore.getState().fetchProfile(),
            ]);
          },
          async () => {},
        ]);
        setReady(true);
        return;
      }

      // ========== 场景2：Token 自动登录 ==========
      if (hasToken) {
        // 恢复用户数据（包括主题）
        await initFromStorage();
        
        await runFlow('token', [
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
  }, [initFromStorage, setTheme]);

  const router = useMemo(
    () => createAppRouter(isAuthenticated),
    [isAuthenticated]
  );

  // 处理安装更新
  const handleInstallUpdate = async () => {
    if (!pendingUpdate?.downloadedPath) return;
    setInstalling(true);
    closeUpdateModal();
    
    try {
      forceSave();
      await installUpdate(pendingUpdate.downloadedPath);
    } catch (e) {
      console.error('[更新] 安装失败:', e);
      setInstalling(false);
      openUpdateModal();
    }
  };

  // 启动画面
  if (!isDesktopNotifyDetached && (flowType !== 'none' || !ready)) {
    return (
      <StartupScreen
        flowType={flowType !== 'none' ? flowType : 'init'}
        currentStep={currentStep}
        userName={userName}
        theme={theme}
      />
    );
  }

  return (
    <>
      <RouterProvider router={router} />
      <StatusModalContainer />
      <UpdateModal
        open={updateModalOpen}
        updateInfo={pendingUpdate}
        onInstall={handleInstallUpdate}
        onSkip={closeUpdateModal}
        installing={installing}
      />
      {ready && isAuthenticated && <Watermark />}
    </>
  );
}

export default App;
