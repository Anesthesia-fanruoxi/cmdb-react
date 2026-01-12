/**
 * 登录页面
 * 初始化由 App.tsx 完成，此处直接使用数据
 */

import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useAppStore } from '../../stores/appStore';
import { isTauriEnv, hasDeviceCredentials } from '../../services/machine';
import { getLoginHistory, getLastUser } from '../../services/loginHistory';
import {
  getDefaultTheme,
  setDefaultTheme,
  getActiveRoute,
} from '../../services/storage';
import './style.css';

type LoginType = 'password' | 'totp';

const Login = () => {
  const { login, autoLogin, bindDevice, setSaveLoginState, isAuthenticated, userName } = useAuthStore();
  const { setTheme: setGlobalTheme, theme: globalTheme } = useAppStore();
  
  const [loginType, setLoginType] = useState<LoginType>('totp');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpInputs, setTotpInputs] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [canAutoLogin, setCanAutoLogin] = useState(false);
  const [checkingAutoLogin, setCheckingAutoLogin] = useState(true);
  const [loginHistory, setLoginHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(true);
  
  // 重新绑定相关状态
  const [showRebindPrompt, setShowRebindPrompt] = useState(false);
  const [rebindError, setRebindError] = useState('');
  
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const passwordRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // 已登录则跳转到上次访问的路由
  useEffect(() => {
    if (isAuthenticated && userName) {
      const lastRoute = getActiveRoute(userName) || '/dashboard';
      window.location.href = lastRoute;
    }
  }, [isAuthenticated, userName]);

  // 初始化（App.tsx 已完成初始化，这里只加载数据）
  useEffect(() => {
    const init = async () => {
      // 使用全局主题
      setTheme(globalTheme);
      document.documentElement.classList.toggle('dark', globalTheme === 'dark');
      
      // 加载登录历史和最后用户（从 Rust 后端）
      const [history, lastUser] = await Promise.all([
        getLoginHistory(),
        getLastUser(),
      ]);
      
      setLoginHistory(history);
      if (lastUser) setUsername(lastUser);
      
      // 初始化窗口标题栏颜色
      if (isTauriEnv()) {
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke('set_window_theme', { dark: globalTheme === 'dark' }).catch(() => {});
        });
      }
    };
    init();
  }, [globalTheme]);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 检查是否可以自动登录
  useEffect(() => {
    const checkAutoLogin = async () => {
      if (isTauriEnv() && username.trim()) {
        setCheckingAutoLogin(true);
        try {
          const has = await hasDeviceCredentials(username.trim());
          setCanAutoLogin(has);
        } catch {
          setCanAutoLogin(false);
        }
        setCheckingAutoLogin(false);
      } else {
        setCanAutoLogin(false);
        setCheckingAutoLogin(false);
      }
    };
    
    const timer = setTimeout(checkAutoLogin, 300);
    return () => clearTimeout(timer);
  }, [username]);

  // 同步保存登录状态到 store
  useEffect(() => {
    setSaveLoginState(rememberLogin);
  }, [rememberLogin, setSaveLoginState]);

  // 切换主题
  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    await setDefaultTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    
    if (isTauriEnv()) {
      const { invoke } = await import('@tauri-apps/api/core');
      invoke('set_window_theme', { dark: newTheme === 'dark' }).catch(() => {});
    }
  };

  // 切换登录方式
  const switchLoginType = (e: React.MouseEvent) => {
    e.preventDefault();
    const newType = loginType === 'totp' ? 'password' : 'totp';
    setLoginType(newType);
    setError('');
    if (newType === 'totp') {
      setPassword('');
      setTotpInputs(['', '', '', '', '', '']);
      setTimeout(() => codeInputRefs.current[0]?.focus(), 50);
    } else {
      setTimeout(() => passwordRef.current?.focus(), 50);
    }
  };

  // 选择历史用户
  const selectHistoryUser = (user: string) => {
    setUsername(user);
    setShowHistory(false);
  };

  // 处理验证码输入
  const handleCodeInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newInputs = [...totpInputs];
    newInputs[index] = value.slice(-1);
    setTotpInputs(newInputs);

    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }

    if (newInputs.every(v => v) && newInputs.join('').length === 6) {
      handleLogin(newInputs.join(''));
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Backspace' && !totpInputs[index] && index > 0) {
      const newInputs = [...totpInputs];
      newInputs[index - 1] = '';
      setTotpInputs(newInputs);
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  // 处理粘贴
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    const digits = pasteData.replace(/\D/g, '').slice(0, 6).split('');
    
    const newInputs = ['', '', '', '', '', ''];
    digits.forEach((digit, i) => { newInputs[i] = digit; });
    setTotpInputs(newInputs);

    if (digits.length === 6) {
      handleLogin(newInputs.join(''));
    } else {
      codeInputRefs.current[digits.length]?.focus();
    }
  };

  // 登录成功后跳转
  const onLoginSuccess = () => {
    setGlobalTheme(theme);
    window.location.href = '/dashboard?from=login';
  };

  // 普通登录处理
  const handleLogin = async (totpCode?: string) => {
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }
    if (loginType === 'password' && !password) {
      setError('请输入密码');
      return;
    }
    if (loginType === 'totp' && (!totpCode || totpCode.length !== 6)) {
      setError('请输入6位验证码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await login({
        user_name: username,
        password: loginType === 'password' ? password : undefined,
        totp_code: loginType === 'totp' ? totpCode : undefined,
        login_type: loginType,
      }, rememberLogin);
      
      // 登录成功后更新历史（由 authStore 处理）
      
      if (result?.isDefaultPass) {
        window.location.href = '/force-two-factor';
      } else {
        onLoginSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
      if (loginType === 'totp') {
        setTotpInputs(['', '', '', '', '', '']);
        setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
      }
      setLoading(false);
    }
  };

  // 自动登录处理
  const handleAutoLogin = async () => {
    if (!username.trim()) {
      setError('请先输入用户名');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const success = await autoLogin(username.trim());
      if (success) {
        onLoginSuccess();
      } else {
        setError('自动登录失败');
        setLoading(false);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '自动登录失败';
      if (errorMsg.includes('版本') || errorMsg.includes('version')) {
        setError(errorMsg + '，请使用其他方式登录');
        setCanAutoLogin(false);
      } else {
        setRebindError(errorMsg);
        setShowRebindPrompt(true);
        setCanAutoLogin(false);
      }
      setLoading(false);
    }
  };

  // 重新绑定登录
  const handleRebindLogin = async (totpCode: string) => {
    if (!username.trim() || totpCode.length !== 6) return;
    
    setLoading(true);
    setError('');
    
    try {
      const result = await login({
        user_name: username,
        totp_code: totpCode,
        login_type: 'totp',
      }, rememberLogin);
      
      if (result?.isDefaultPass) {
        window.location.href = '/force-two-factor';
        return;
      }
      
      try {
        await bindDevice(totpCode);
      } catch (bindErr) {
        console.warn('[Login] 设备绑定失败:', bindErr);
      }
      
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
      setTotpInputs(['', '', '', '', '', '']);
      setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canAutoLogin) {
      handleAutoLogin();
    } else if (showRebindPrompt) {
      handleRebindLogin(totpInputs.join(''));
    } else {
      handleLogin(totpInputs.join(''));
    }
  };

  return (
    <div className={`login-container ${theme}`}>
      <button className="theme-switch" onClick={toggleTheme}>
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <div className="login-content">
        {/* 左侧品牌区 */}
        <div className="login-left">
          <div className="brand-content">
            <div className="brand-icon">🖥️</div>
            <h1 className="brand-title">CMDB</h1>
            <p className="brand-desc">运维管理平台</p>
            <div className="brand-features">
              {['资产管理', '资源监控', '运维自动化', 'MySQL查询', 'ELFK查询'].map(f => (
                <div key={f} className="feature-item">
                  <span className="feature-check">✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧登录表单 */}
        <div className="login-right">
          <form className="login-form" onSubmit={handleSubmit}>
            <h2 className="login-title">CMDB运维管理系统</h2>
            <p className="login-subtitle">欢迎回来，请登录您的账号</p>

            {/* 用户名输入 */}
            <div className="form-item" ref={historyRef}>
              <div className="input-wrapper has-dropdown">
                <span className="input-icon">👤</span>
                <input
                  ref={usernameRef}
                  type="text"
                  placeholder="用户名"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onFocus={() => loginHistory.length > 0 && setShowHistory(true)}
                  autoComplete="off"
                />
                {loginHistory.length > 0 && (
                  <button 
                    type="button" 
                    className="dropdown-toggle"
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    ▼
                  </button>
                )}
                {showHistory && loginHistory.length > 0 && (
                  <div className="history-dropdown">
                    {loginHistory.map(user => (
                      <div 
                        key={user} 
                        className={`history-item ${user === username ? 'active' : ''}`}
                        onClick={() => selectHistoryUser(user)}
                      >
                        <span className="history-icon">👤</span>
                        <span className="history-name">{user}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 登录内容区 */}
            {checkingAutoLogin ? (
              <div className="auto-login-section">
                <div className="auto-login-hint">
                  <span>🔍</span>
                  <span>正在检测登录方式...</span>
                </div>
              </div>
            ) : canAutoLogin ? (
              <div className="auto-login-section">
                <div className="auto-login-hint">
                  <span>🔐</span>
                  <span>检测到已绑定设备，点击下方按钮自动登录</span>
                </div>
              </div>
            ) : showRebindPrompt ? (
              <div className="rebind-section">
                <div className="rebind-hint">
                  <span>⚠️</span>
                  <span>{rebindError}，请输入验证码重新绑定</span>
                </div>
                <div className="totp-form">
                  <div className="verification-code-container">
                    {totpInputs.map((val, idx) => (
                      <input
                        key={idx}
                        ref={el => { codeInputRefs.current[idx] = el; }}
                        className="verification-code-input"
                        type="tel"
                        maxLength={1}
                        value={val}
                        onChange={e => {
                          handleCodeInput(idx, e.target.value);
                          const newInputs = [...totpInputs];
                          newInputs[idx] = e.target.value.slice(-1);
                          if (newInputs.every(v => v) && newInputs.join('').length === 6) {
                            handleRebindLogin(newInputs.join(''));
                          }
                        }}
                        onKeyDown={e => handleKeyDown(e, idx)}
                        onPaste={e => {
                          handlePaste(e);
                          const pasteData = e.clipboardData.getData('text');
                          const digits = pasteData.replace(/\D/g, '').slice(0, 6);
                          if (digits.length === 6) {
                            setTimeout(() => handleRebindLogin(digits), 100);
                          }
                        }}
                        autoComplete="off"
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="form-content">
                {loginType === 'totp' ? (
                  <div className="totp-form">
                    <div className="verification-code-container">
                      {totpInputs.map((val, idx) => (
                        <input
                          key={idx}
                          ref={el => { codeInputRefs.current[idx] = el; }}
                          className="verification-code-input"
                          type="tel"
                          maxLength={1}
                          value={val}
                          onChange={e => handleCodeInput(idx, e.target.value)}
                          onKeyDown={e => handleKeyDown(e, idx)}
                          onPaste={handlePaste}
                          autoComplete="off"
                        />
                      ))}
                    </div>
                    <div className="totp-hint">
                      <span>⏱️</span>
                      <span>验证码每30秒刷新一次</span>
                    </div>
                  </div>
                ) : (
                  <div className="form-item">
                    <div className="input-wrapper">
                      <span className="input-icon">🔒</span>
                      <input
                        ref={passwordRef}
                        type="password"
                        placeholder="密码"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit(e)}
                        autoComplete="current-password"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 保存登录状态开关 */}
            {!canAutoLogin && (
              <div className="remember-login">
                <label className="remember-checkbox">
                  <input
                    type="checkbox"
                    checked={rememberLogin}
                    onChange={e => setRememberLogin(e.target.checked)}
                  />
                  <span className="checkmark"></span>
                  <span className="remember-text">保存登录状态</span>
                </label>
                <span className="remember-hint">
                  {rememberLogin ? '下次启动自动登录' : '仅本次登录有效'}
                </span>
              </div>
            )}

            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? '登录中...' : (canAutoLogin ? '🔐 自动登录' : (showRebindPrompt ? '🔄 重新绑定登录' : '登录'))}
            </button>

            {/* 切换登录方式 */}
            {!canAutoLogin && !showRebindPrompt && (
              <div className="login-type-switch">
                <button type="button" className="switch-button" onClick={switchLoginType}>
                  {loginType === 'totp' ? '🔒 使用密码登录' : '🔑 使用双因子登录'}
                </button>
              </div>
            )}

            {canAutoLogin && (
              <div className="login-type-switch">
                <button type="button" className="switch-button" onClick={() => setCanAutoLogin(false)}>
                  使用其他方式登录
                </button>
              </div>
            )}
            
            {showRebindPrompt && (
              <div className="login-type-switch">
                <button 
                  type="button" 
                  className="switch-button" 
                  onClick={() => {
                    setShowRebindPrompt(false);
                    setRebindError('');
                    setTotpInputs(['', '', '', '', '', '']);
                  }}
                >
                  使用其他方式登录
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
