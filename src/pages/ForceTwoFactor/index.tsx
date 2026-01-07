/**
 * 强制绑定双因子认证页面
 * 默认密码登录后必须绑定双因子才能继续使用系统
 */

import { useState, useRef, useEffect } from 'react';
import { generateTwoFactor, verifyTwoFactor as verifyTwoFactorApi } from '../../services/auth';
import { getToken, removeToken, clearMemoryCache } from '../../services/storage';
import './style.css';

const ForceTwoFactor = () => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifyStep, setVerifyStep] = useState(false);
  const [error, setError] = useState('');
  
  // 双因子数据
  const [secret, setSecret] = useState('');
  const [qrcodeUrl, setQrcodeUrl] = useState('');
  
  // 验证码输入
  const [codeInputs, setCodeInputs] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 获取双因子信息
  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }
    fetchTwoFactorData();
  }, []);

  const fetchTwoFactorData = async () => {
    setLoading(true);
    try {
      const res = await generateTwoFactor();
      
      if (res.code === 200 && res.data) {
        setSecret(res.data.secret);
        setQrcodeUrl(res.data.qrcode_url);
      } else {
        setError(res.message || '获取双因子信息失败');
      }
    } catch (err) {
      console.error('获取双因子信息失败:', err);
      setError('获取双因子信息失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 开始验证
  const startVerification = () => {
    setVerifyStep(true);
    setCodeInputs(['', '', '', '', '', '']);
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  };

  // 处理验证码输入
  const handleCodeInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newInputs = [...codeInputs];
    newInputs[index] = value.slice(-1);
    setCodeInputs(newInputs);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // 自动提交
    if (index === 5 && newInputs.every(v => v)) {
      setTimeout(() => verifyTwoFactor(newInputs.join('')), 300);
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Backspace' && !codeInputs[index] && index > 0) {
      const newInputs = [...codeInputs];
      newInputs[index - 1] = '';
      setCodeInputs(newInputs);
      inputRefs.current[index - 1]?.focus();
    }
  };

  // 处理粘贴
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    const digits = pasteData.replace(/\D/g, '').slice(0, 6).split('');
    
    const newInputs = ['', '', '', '', '', ''];
    digits.forEach((digit, i) => { newInputs[i] = digit; });
    setCodeInputs(newInputs);

    if (digits.length < 6) {
      inputRefs.current[digits.length]?.focus();
    } else {
      setTimeout(() => verifyTwoFactor(newInputs.join('')), 300);
    }
  };

  // 验证双因子
  const verifyTwoFactor = async (code?: string) => {
    const verifyCode = code || codeInputs.join('');
    if (verifyCode.length !== 6) {
      setError('请输入6位数字验证码');
      return;
    }

    setSubmitting(true);
    setError('');
    
    try {
      const res = await verifyTwoFactorApi({ code: verifyCode });

      if (res.code === 200) {
        // 清除本地数据，返回登录页重新登录
        removeToken();
        clearMemoryCache();
        window.location.href = '/login';
      } else {
        setError(res.message || '验证码错误');
        setCodeInputs(['', '', '', '', '', '']);
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      }
    } catch (err) {
      console.error('验证双因子失败:', err);
      setError('验证失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 生成二维码URL
  const qrcodeDataUrl = qrcodeUrl 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrcodeUrl)}`
    : '';

  return (
    <div className="force-two-factor">
      <div className="two-factor-container">
        <div className="two-factor-card">
          <div className="card-header">
            <div className="header-icon">🔑</div>
            <h2>绑定双因子认证</h2>
            <p className="subtitle">为了您的账户安全，请绑定双因子认证</p>
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner" />
              <p>加载中...</p>
            </div>
          ) : verifyStep ? (
            <div className="verify-step">
              <p className="verify-tip">
                请使用认证应用扫描二维码后，输入应用生成的6位数验证码
              </p>
              <div className="verification-code-container">
                {codeInputs.map((val, idx) => (
                  <input
                    key={idx}
                    ref={el => { inputRefs.current[idx] = el; }}
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
              {error && <div className="error-message">{error}</div>}
              <div className="form-footer">
                <button 
                  className="submit-btn"
                  onClick={() => verifyTwoFactor()}
                  disabled={submitting}
                >
                  {submitting ? '验证中...' : '确认绑定'}
                </button>
              </div>
            </div>
          ) : (
            <div className="two-factor-content">
              <div className="qrcode-container">
                {qrcodeDataUrl && (
                  <img src={qrcodeDataUrl} alt="二维码" className="qrcode-img" />
                )}
                <div className="secret-key">密钥: {secret}</div>
              </div>
              {error && <div className="error-message">{error}</div>}
              <div className="form-footer">
                <button className="submit-btn" onClick={startVerification}>
                  开始验证
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForceTwoFactor;
