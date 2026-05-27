/**
 * 个人信息抽屉组件 - 现代科技风格
 */

import { useState, useEffect, useRef } from 'react';
import { Loader2, Smartphone, Shield, Zap, Database, Camera, Circle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const FAB_VISIBLE_KEY = 'cmdb-fab-visible';
import { updateProfile, getProfile } from '../../services/auth';
import { isTauriEnv, hasDeviceCredentials, clearDeviceCredentials } from '../../services/machine';
import { getUserAvatar, setUserAvatar } from '../../services/storage';
import { toast } from '../Toast';
import BindDeviceModal from '../BindDeviceModal';
import './style.css';

interface ProfileDrawerProps {
  visible: boolean;
  onClose: () => void;
}

const ProfileDrawer = ({ visible, onClose }: ProfileDrawerProps) => {
  const { user, userName, fetchProfile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bindModalVisible, setBindModalVisible] = useState(false);
  const [deviceBound, setDeviceBound] = useState(false);
  const [checkingDevice, setCheckingDevice] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [fabVisible, setFabVisible] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 原始表单数据（用于比较是否修改）
  const [originalData, setOriginalData] = useState({ nick_name: '', phone: '', email: '' });
  const [formData, setFormData] = useState({ nick_name: '', phone: '', email: '' });

  // 检查是否有修改
  const hasChanges = formData.nick_name !== originalData.nick_name ||
    formData.phone !== originalData.phone ||
    formData.email !== originalData.email;

  useEffect(() => {
    if (visible) {
      setIsClosing(false);
      loadProfile();
      checkDeviceStatus();
      loadAvatar();
      // 加载悬浮球状态
      try {
        const v = localStorage.getItem(FAB_VISIBLE_KEY);
        setFabVisible(v === null ? true : v === 'true');
      } catch { setFabVisible(true); }
    }
  }, [visible]);

  // 监听悬浮球状态变化（长按隐藏时同步开关）
  useEffect(() => {
    if (!visible) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === 'boolean') setFabVisible(detail);
    };
    window.addEventListener('fab-visible-change', handler);
    return () => window.removeEventListener('fab-visible-change', handler);
  }, [visible]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await getProfile();
      if (res.code === 200 && res.data) {
        const data = {
          nick_name: res.data.nick_name || '',
          phone: res.data.phone || '',
          email: res.data.email || '',
        };
        setFormData(data);
        setOriginalData(data);
      }
    } catch {
      toast.error('获取个人信息失败');
    } finally {
      setLoading(false);
    }
  };

  const loadAvatar = () => {
    if (userName) {
      const saved = getUserAvatar(userName);
      if (saved) setAvatarUrl(saved);
    }
  };

  const checkDeviceStatus = async () => {
    if (!isTauriEnv() || !userName) return;
    setCheckingDevice(true);
    try {
      const bound = await hasDeviceCredentials(userName);
      setDeviceBound(bound);
    } catch (err) {
      console.error('检查设备状态失败:', err);
    } finally {
      setCheckingDevice(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateProfile(formData);
      if (res.code === 200) {
        toast.success('保存成功');
        setOriginalData(formData);
        await fetchProfile();
        handleClose();
      } else {
        toast.error(res.message || '保存失败');
      }
    } catch {
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 关闭抽屉（带动画）
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setFormData(originalData);
      onClose();
    }, 280);
  };

  const handleUnbindDevice = async () => {
    if (!userName) return;
    try {
      await useAuthStore.getState().unbindDevice('');
      setDeviceBound(false);
      toast.success('设备已解绑');
    } catch (err) {
      await clearDeviceCredentials(userName);
      setDeviceBound(false);
      toast.success('设备已解绑');
      console.error('解绑设备:', err);
    }
  };

  const handleBindSuccess = () => {
    setDeviceBound(true);
    toast.success('设备绑定成功');
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const toggleFabVisible = () => {
    const next = !fabVisible;
    setFabVisible(next);
    try { localStorage.setItem(FAB_VISIBLE_KEY, String(next)); } catch { /* */ }
    // 同步浮球组件（同页面自定义事件）
    window.dispatchEvent(new CustomEvent('fab-visible-change', { detail: next }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('图片大小不能超过 2MB');
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      const compressed = await compressImage(base64, 200, 200);
      setAvatarUrl(compressed);
      if (userName) {
        await setUserAvatar(userName, compressed);
      }
      toast.success('头像已更新');
    } catch {
      toast.error('头像上传失败');
    }

    e.target.value = '';
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const compressImage = (base64: string, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = base64;
    });
  };

  const getAvatarText = () => {
    const name = user?.nick_name || user?.user_name || '';
    return name.charAt(0) || 'U';
  };

  if (!visible) return null;

  return (
    <>
      <div 
        className={`profile-drawer-overlay ${isClosing ? 'closing' : ''}`} 
        onClick={handleClose} 
      />
      <div className={`profile-drawer ${isClosing ? 'closing' : ''}`}>
        <div className="drawer-header">
          <h3>个人信息</h3>
        </div>
        
        <div className="drawer-content">
          {loading ? (
            <div className="profile-loading">
              <Loader2 size={40} className="spin" />
              <p>加载中...</p>
            </div>
          ) : (
            <>
              {/* 头像区域 */}
              <div className="profile-avatar-section">
                <div className="profile-avatar-wrapper" onClick={handleAvatarClick}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="头像" className="profile-avatar-img" />
                  ) : (
                    <div className="profile-avatar">{getAvatarText()}</div>
                  )}
                  <div className="avatar-overlay">
                    <Camera size={20} />
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>
                <div className="profile-username">{user?.nick_name || user?.user_name || '-'}</div>
                <div className="profile-dept">{user?.dept_name || '暂无部门'}</div>
              </div>

              <div className="profile-form">
                {/* 基本信息 */}
                <div className="form-section">
                  <div className="form-section-title">基本信息</div>
                  
                  <div className="form-item">
                    <label>昵称</label>
                    <input
                      type="text"
                      value={formData.nick_name}
                      onChange={e => handleChange('nick_name', e.target.value)}
                      placeholder="请输入昵称"
                    />
                  </div>
                  
                  <div className="form-item">
                    <label>手机号</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={e => handleChange('phone', e.target.value)}
                      placeholder="请输入手机号"
                    />
                  </div>
                  
                  <div className="form-item">
                    <label>邮箱</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => handleChange('email', e.target.value)}
                      placeholder="请输入邮箱"
                    />
                  </div>
                </div>

                {/* 界面设置 */}
                <div className="form-section">
                  <div className="form-section-title">界面设置</div>
                  <div className="form-item fab-toggle-item">
                    <label>
                      <Circle size={16} /> 悬浮球
                    </label>
                    <div className="fab-toggle-wrap">
                      <span className="fab-toggle-hint">{fabVisible ? '已开启' : '已关闭'}</span>
                      <button
                        className={`fab-toggle-btn ${fabVisible ? 'fab-toggle-btn--on' : ''}`}
                        onClick={toggleFabVisible}
                        type="button"
                      >
                        <span className="fab-toggle-knob" />
                      </button>
                    </div>
                  </div>
                  <div className="fab-toggle-tips">
                    长按悬浮球可快速关闭，关闭后可在此处重新打开
                  </div>
                </div>
                
                {/* 设备绑定 */}
                {isTauriEnv() && (
                  <div className="form-section">
                    <div className="form-section-title">安全设置</div>
                    <div className="form-item device-bind">
                      <label><Smartphone size={16} /> 设备绑定</label>
                      <div className="device-status">
                        {checkingDevice ? (
                          <span className="checking"><Loader2 size={14} className="spin" /> 检测中...</span>
                        ) : deviceBound ? (
                          <>
                            <span className="bound"><Shield size={14} /> 已绑定当前设备</span>
                            <button className="link-btn danger" onClick={handleUnbindDevice}>解绑</button>
                          </>
                        ) : (
                          <>
                            <span className="unbound">未绑定设备</span>
                            <button className="link-btn" onClick={() => setBindModalVisible(true)}>立即绑定</button>
                          </>
                        )}
                      </div>
                      <div className="device-bind-tips">
                        <p>绑定设备后可享受以下功能：</p>
                        <div className="device-tip-item">
                          <div className="device-tip-icon auto-login"><Zap size={16} color="#fff" /></div>
                          <div className="device-tip-content">
                            <div className="device-tip-title">自动登录</div>
                            <div className="device-tip-desc">无需每次输入密码，启动即登录</div>
                          </div>
                        </div>
                        <div className="device-tip-item">
                          <div className="device-tip-icon encrypt"><Shield size={16} color="#fff" /></div>
                          <div className="device-tip-content">
                            <div className="device-tip-title">数据加密</div>
                            <div className="device-tip-desc">登录凭证使用设备唯一标识加密存储</div>
                          </div>
                        </div>
                        <div className="device-tip-item">
                          <div className="device-tip-icon persist"><Database size={16} color="#fff" /></div>
                          <div className="device-tip-content">
                            <div className="device-tip-title">状态保持</div>
                            <div className="device-tip-desc">应用更新后自动恢复登录状态</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 底部操作按钮 - 只在有修改时显示保存 */}
        {!loading && (
          <div className="form-actions">
            <button className="btn-default" onClick={handleClose}>
              {hasChanges ? '取消' : '关闭'}
            </button>
            {hasChanges && (
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 size={14} className="spin" /> 保存中...</> : '保存修改'}
              </button>
            )}
          </div>
        )}
      </div>
      
      <BindDeviceModal 
        visible={bindModalVisible} 
        onClose={() => setBindModalVisible(false)}
        onSuccess={handleBindSuccess}
      />
    </>
  );
};

export default ProfileDrawer;
