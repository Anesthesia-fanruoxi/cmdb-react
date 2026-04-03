/**
 * 绑定设备弹框
 * 用户输入 TOTP 验证码完成设备绑定
 */

import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { isTauriEnv } from '../../services/machine';
import './style.css';

interface BindDeviceModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const BindDeviceModal = ({ visible, onClose, onSuccess }: BindDeviceModalProps) => {
  const { bindDevice } = useAuthStore();
  const [totpInputs, setTotpInputs] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 打开时聚焦第一个输入框
  useEffect(() => {
    if (visible) {
      setTotpInputs(['', '', '', '', '', '']);
      setError('');
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [visible]);

  // 处理输入
  const handleInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newInputs = [...totpInputs];
    newInputs[index] = value.slice(-1);
    setTotpInputs(newInputs);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // 自动提交
    if (newInputs.every(v => v) && newInputs.join('').length === 6) {
      handleBind(newInputs.join(''));
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Backspace' && !totpInputs[index] && index > 0) {
      const newInputs = [...totpInputs];
      newInputs[index - 1] = '';
      setTotpInputs(newInputs);
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Escape') {
      onClose();
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

    if (digits.length < 6) {
      inputRefs.current[digits.length]?.focus();
    } else {
      handleBind(newInputs.join(''));
    }
  };

  // 绑定设备
  const handleBind = async (totpCode: string) => {
    if (!isTauriEnv()) {
      setError('仅支持桌面客户端');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await bindDevice(totpCode);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('[BindDevice] 绑定失败:', err);
      setError(err instanceof Error ? err.message : '绑定失败');
      setTotpInputs(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="bind-modal-overlay" onClick={onClose}>
      <div className="bind-modal" onClick={e => e.stopPropagation()}>
        <div className="bind-modal-header">
          <h3>绑定设备</h3>
          <button className="bind-modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="bind-modal-body">
          <p className="bind-modal-desc">
            绑定后可使用此设备自动登录，无需输入密码。
            <br />
            请输入您的双因子验证码确认身份：
          </p>
          
          <div className="bind-totp-inputs">
            {totpInputs.map((val, idx) => (
              <input
                key={idx}
                ref={el => { inputRefs.current[idx] = el; }}
                className="bind-totp-input"
                type="tel"
                maxLength={1}
                value={val}
                onChange={e => handleInput(idx, e.target.value)}
                onKeyDown={e => handleKeyDown(e, idx)}
                onPaste={handlePaste}
                disabled={loading}
                autoComplete="off"
              />
            ))}
          </div>
          
          <p className="bind-totp-hint">
            <span>⏱️</span> 验证码每30秒刷新一次
          </p>
          
          {error && <p className="bind-error">{error}</p>}
        </div>
        
        <div className="bind-modal-footer">
          <button className="bind-btn-cancel" onClick={onClose} disabled={loading}>
            取消
          </button>
          <button 
            className="bind-btn-confirm" 
            onClick={() => handleBind(totpInputs.join(''))}
            disabled={loading || totpInputs.join('').length !== 6}
          >
            {loading ? '绑定中...' : '确认绑定'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BindDeviceModal;
