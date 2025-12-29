/**
 * 个人信息抽屉组件
 */

import { useState, useEffect } from 'react';
import { X, Loader2, Smartphone } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { updateProfile, getProfile } from '../../services/auth';
import { isTauriEnv, hasDeviceCredentials, clearDeviceCredentials } from '../../services/machine';
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
  
  const [formData, setFormData] = useState({
    nick_name: '',
    phone: '',
    email: '',
  });

  // 加载用户信息和设备绑定状态
  useEffect(() => {
    if (visible) {
      loadProfile();
      checkDeviceStatus();
    }
  }, [visible]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await getProfile();
      if (res.code === 200 && res.data) {
        setFormData({
          nick_name: res.data.nick_name || '',
          phone: res.data.phone || '',
          email: res.data.email || '',
        });
      }
    } catch {
      toast.error('获取个人信息失败');
    } finally {
      setLoading(false);
    }
  };

  // 检查当前设备绑定状态
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
        await fetchProfile();
        onClose();
      } else {
        toast.error(res.message || '保存失败');
      }
    } catch {
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        nick_name: user.nick_name || '',
        phone: user.phone || '',
        email: user.email || '',
      });
    }
    onClose();
  };

  // 解绑设备
  const handleUnbindDevice = async () => {
    if (!userName) return;
    
    try {
      await clearDeviceCredentials(userName);
      setDeviceBound(false);
      toast.success('设备已解绑');
    } catch (err) {
      toast.error('解绑失败');
      console.error('解绑设备失败:', err);
    }
  };

  // 绑定成功回调
  const handleBindSuccess = () => {
    setDeviceBound(true);
    toast.success('设备绑定成功');
  };

  if (!visible) return null;

  return (
    <>
      <div className="profile-drawer-overlay" onClick={onClose} />
      <div className="profile-drawer">
        <div className="drawer-header">
          <h3>个人信息</h3>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        
        <div className="drawer-content">
          {loading ? (
            <div className="profile-loading">
              <Loader2 size={32} className="spin" />
              <p>加载中...</p>
            </div>
          ) : (
            <div className="profile-form">
              <div className="form-item readonly">
                <label>用户名</label>
                <span className="form-value">{user?.user_name || '-'}</span>
              </div>
              
              <div className="form-item readonly">
                <label>部门</label>
                <span className="form-value">{user?.dept_name || '-'}</span>
              </div>
              
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
              
              {/* 设备绑定（仅桌面端显示） */}
              {isTauriEnv() && (
                <div className="form-item device-bind">
                  <label>设备绑定</label>
                  <div className="device-status">
                    {checkingDevice ? (
                      <span className="checking"><Loader2 size={14} className="spin" /> 检测中...</span>
                    ) : deviceBound ? (
                      <>
                        <span className="bound"><Smartphone size={14} /> 已绑定</span>
                        <button className="link-btn danger" onClick={handleUnbindDevice}>解绑设备</button>
                      </>
                    ) : (
                      <>
                        <span className="unbound">未绑定</span>
                        <button className="link-btn" onClick={() => setBindModalVisible(true)}>绑定设备</button>
                      </>
                    )}
                  </div>
                </div>
              )}
              
              <div className="form-actions">
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <><Loader2 size={14} className="spin" /> 保存中...</> : '保存修改'}
                </button>
                <button className="btn-default" onClick={handleCancel}>取消</button>
              </div>
            </div>
          )}
        </div>
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
