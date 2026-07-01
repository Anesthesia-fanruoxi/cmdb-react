/**
 * 应用根组件
 * 使用启动动画组件管理各场景
 */

import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';
import { createAppRouter, preloadHome } from './router';
import { useAuthStore } from './stores/authStore';
import { useAppStore } from './stores/appStore';
import { usePageStateStore } from './stores/pageStateStore';
import { useMenuStore } from './stores/menuStore';
import { initSecurity } from './utils/security';
import { startAutoSave, stopAutoSave, forceSave, initAllStorage, getDefaultTheme, scheduler, removeStorageFile } from './services/storage';
import { useSqlApplyStore } from './stores/sqlApplyStore';
import { useTaskCenterStore } from './stores/taskCenterStore';
import { getLoginHistory, getLastUser } from './services/loginHistory';
import type { UpdateInfo } from './services/storage';
import { StatusModalContainer } from './components/StatusModal';
import { UpdateModal } from './components/UpdateModal';
import StartupScreen from './components/StartupScreen';
import { type FlowType, FLOW_STEPS } from './components/StartupScreen/constants';
import Watermark from './components/Watermark';
import { installUpdate, cleanupOldUpdate, saveInstallPath } from './services/updater';
import { listen } from '@tauri-apps/api/event';
import { isTauriEnv } from './services/machine';
import './App.css';

// 工具窗口组件懒加载
const ToolWindowMap: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  'tool-json':     lazy(() => import('./pages/Home/tools/JsonFormatter').then(m => ({ default: m.JsonFormatterWindow }))),
  'tool-password': lazy(() => import('./pages/Home/tools/PasswordGen').then(m => ({ default: m.PasswordGenWindow }))),
  'tool-case':     lazy(() => import('./pages/Home/tools/CaseConvert').then(m => ({ default: m.CaseConvertWindow }))),
  'tool-cron':     lazy(() => import('./pages/Home/tools/CronExpr').then(m => ({ default: m.CronExprWindow }))),
  'tool-time':     lazy(() => import('./pages/Home/tools/TimeConvert').then(m => ({ default: m.TimeConvertWindow }))),
  'tool-qps':      lazy(() => import('./pages/Home/tools/QpsCalc').then(m => ({ default: m.QpsCalcWindow }))),
  'tool-byte':     lazy(() => import('./pages/Home/tools/ByteConvert').then(m => ({ default: m.ByteConvertWindow }))),
};

// 检测当前是否为小工具独立窗口，完全跳过初始化
function getToolWindowType(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type') ?? '';
    return type.startsWith('tool-') ? type : null;
  } catch {
    return null;
  }
}

const toolWindowType = getToolWindowType();

/** 工具窗口容器 */
function ToolWindowContainer({ toolType }: { toolType: string }) {
  const ToolComponent = ToolWindowMap[toolType];
  return (
    <Suspense fallback={<div style={{ width: '100vw', height: '100vh', background: 'var(--bg-color)' }} />}>
      <ToolComponent />
    </Suspense>
  );
}

function App() {
  // 小工具独立窗口：完全跳过所有初始化，直接渲染
  if (toolWindowType && ToolWindowMap[toolWindowType]) {
    return <ToolWindowContainer toolType={toolWindowType} />;
  }

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

      // ========== 清除缓存 ==========
      // 设计原则：
      // ✅ 清除: states.dat（标签页/页面快照/SQL元数据）、profiles.dat（用户信息/权限/菜单快照）
      // ❌ 保留: app.dat、tokens.dat、preferences.dat、credentials.dat
      if (clear === '1') {
        // 校验前置条件：必须有 token，否则直接跳登录
        const initToken = useAuthStore.getState().token;
        const initUser = useAuthStore.getState().userName;

        if (!initToken || !initUser) {
          window.location.href = '/login';
          return;
        }

        await runFlow('clear', [
          async () => {},
          async () => {
            // 取消所有未完成的防抖保存任务
            scheduler.dispose();

            // 停止 SSE
            try { useSqlApplyStore.getState().stop(); } catch (_) {}

            // 清除内存 store
            useMenuStore.getState().clearMenus();
            usePageStateStore.getState().clearAllPageStates();
            useMenuStore.getState().delAllViews();

            // 物理删除 states.dat + profiles.dat
            await Promise.allSettled([
              removeStorageFile('states.dat'),
              removeStorageFile('profiles.dat'),
            ]);
          },
          async () => {
            // 重新拉取菜单与用户信息
            await Promise.allSettled([
              useMenuStore.getState().fetchUserMenus(),
              useAuthStore.getState().fetchProfile(),
            ]);

            // 重建 SSE
            try { useSqlApplyStore.getState().start(); } catch (_) {}
            try { useTaskCenterStore.getState().start(); } catch (_) {}
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
