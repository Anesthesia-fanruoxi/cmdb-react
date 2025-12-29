/**
 * 登录页面
 * - 有设备凭证：只显示用户名 + 自动登录按钮
 * - 无设备凭证：显示用户名 + 密码/双因子切换
 */

import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { isTauriEnv, hasDeviceCredentials } from '../../services/machine';
import './style.css';

type LoginType = 'password' | 'totp';

const Login = () => {
  const { login, autoLogin } = useAuthStore();
  
  const [loginType, setLoginType] = useState<LoginType>('totp');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpInputs, setTotpInputs] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [canAutoLogin, setCanAutoLogin] = useState(false);
  
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 检查是否可以自动登录（用户名变化时检测）
  useEffect(() => {
    const checkAutoLogin = async () => {
      if (isTauriEnv() && username.trim()) {
        try {
          const has = await hasDeviceCredentials(username.trim());
          console.log('[Login] 检测设备凭证:', username, has);
          setCanAutoLogin(has);
        } catch (err) {
          console.error('[Login] 检测设备凭证失败:', err);
          setCanAutoLogin(false);
        }
      } else {
        setCanAutoLogin(false);
      }
    };
    
    const timer = setTimeout(checkAutoLogin, 300);
    return () => clearTimeout(timer);
  }, [username]);

  // 初始化上次登录的用户名
  useEffect(() => {
    const lastUsername = localStorage.getItem('lastLoginUsername');
    if (lastUsername) setUsername(lastUsername);
  }, []);

  // 切换主题
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  // 切换登录方式
  const switchLoginType = () => {
    const newType = loginType === 'totp' ? 'password' : 'totp';
    setLoginType(newType);
    setError('');
    if (newType === 'totp') {
      setPassword('');
      setTotpInputs(['', '', '', '', '', '']);
      setTimeout(() => codeInputRefs.current[0]?.focus(), 50);
    }
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
      });
      
      localStorage.setItem('lastLoginUsername', username);
      
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
        localStorage.setItem('lastLoginUsername', username);
        onLoginSuccess();
      } else {
        setError('自动登录失败');
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '自动登录失败');
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canAutoLogin) {
      handleAutoLogin();
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
            <div className="form-item">
              <div className="input-wrapper">
                <span className="input-icon">👤</span>
                <input
                  type="text"
                  placeholder="用户名"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
            </div>

            {/* 有设备凭证：简化界面，只显示自动登录 */}
            {canAutoLogin ? (
              <div className="auto-login-section">
                <div className="auto-login-hint">
                  <span>🔐</span>
                  <span>检测到已绑定设备，点击下方按钮自动登录</span>
                </div>
              </div>
            ) : (
              /* 无设备凭证：显示密码/双因子登录 */
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

            {error && <div className="error-message">{error}</div>}

            {/* 登录按钮 */}
            <button type="submit" className="login-button" disabled={loading}>
              {loading ? '登录中...' : (canAutoLogin ? '🔐 自动登录' : '登录')}
            </button>

            {/* 切换登录方式（仅无设备凭证时显示） */}
            {!canAutoLogin && (
              <div className="login-type-switch">
                <button type="button" className="switch-button" onClick={switchLoginType}>
                  {loginType === 'totp' ? '🔒 使用密码登录' : '🔑 使用双因子登录'}
                </button>
              </div>
            )}

            {/* 有设备凭证时，提供切换到其他登录方式的选项 */}
            {canAutoLogin && (
              <div className="login-type-switch">
                <button 
                  type="button" 
                  className="switch-button" 
                  onClick={() => setCanAutoLogin(false)}
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
