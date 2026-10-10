/**
 * 系统设置页面
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { getBasicSetting, updateBasicSetting, getAiModels } from '../../../services/system/setting';
import type { BasicSetting, AiModelItem } from '../../../services/system/setting';
import { toast } from '../../../components/AppNotification';
import { Settings, Lock, Key, Shield, Eye, EyeOff, Bot, ChevronDown, Loader2 } from 'lucide-react';
import './style.css';

const SystemSetting = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<BasicSetting | null>(null);
  const [initialSettings, setInitialSettings] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showAiKey, setShowAiKey] = useState(false);
  // 模型列表下拉（仅点击输入框时才发起请求）
  const [modelOpen, setModelOpen] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelList, setModelList] = useState<AiModelItem[]>([]);
  const [modelError, setModelError] = useState('');
  const modelSelectRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const res = await getBasicSetting();
      if (res.code === 200 && res.data) {
        setSettings(res.data);
        setInitialSettings(JSON.stringify(res.data));
      }
    } catch (error) {
      console.error('获取设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const isChanged = useMemo(() => settings && JSON.stringify(settings) !== initialSettings, [settings, initialSettings]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await updateBasicSetting(settings);
      if (res.code === 200) {
        setInitialSettings(JSON.stringify(settings));
        toast.success('保存成功');
      }
    } catch { toast.error('保存失败'); }
    finally { setSaving(false); }
  };

  const handleCancel = () => { if (initialSettings) setSettings(JSON.parse(initialSettings)); };
  const updateField = (field: keyof BasicSetting, value: BasicSetting[keyof BasicSetting]) => {
    if (settings) setSettings({ ...settings, [field]: value });
  };

  // 点击输入框才触发获取模型列表（页面加载等其他时机不请求）
  const handleModelClick = async () => {
    setModelOpen(true);
    if (!settings || modelLoading) return;

    if (!settings.ai_base_url?.trim()) {
      setModelList([]);
      setModelError('请先填写 AI 服务地址');
      return;
    }

    setModelLoading(true);
    setModelError('');
    try {
      const res = await getAiModels({
        base_url: settings.ai_base_url.trim(),
        // 掩码或空值时后端自动使用系统设置中已保存的明文（与更新设置的掩码回传机制一致）
        api_key: settings.ai_api_key || '',
      });
      if (res.code === 200 && res.data) {
        setModelList(res.data.models || []);
      } else {
        setModelList([]);
        setModelError(res.message || '获取模型列表失败');
      }
    } catch (error) {
      setModelList([]);
      setModelError(error instanceof Error ? error.message : '获取模型列表失败');
    } finally {
      setModelLoading(false);
    }
  };

  const handleSelectModel = (modelId: string) => {
    updateField('ai_model', modelId);
    setModelOpen(false);
  };

  // 点击下拉外部区域时收起
  useEffect(() => {
    if (!modelOpen) return;
    const handler = (e: MouseEvent) => {
      if (modelSelectRef.current && !modelSelectRef.current.contains(e.target as Node)) setModelOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [modelOpen]);

  // 下拉内容：加载中 > 错误 > 空列表 > 模型列表
  const renderModelDropdown = () => {
    if (modelLoading) return <div className="model-dropdown-status"><Loader2 size={14} className="model-spin" />正在获取模型列表...</div>;
    if (modelError) return <div className="model-dropdown-status error">{modelError}</div>;
    if (modelList.length === 0) return <div className="model-dropdown-status">未获取到可用模型</div>;
    return modelList.map(model => (
      <div
        key={model.id}
        className={`model-option${settings?.ai_model === model.id ? ' selected' : ''}`}
        onClick={() => handleSelectModel(model.id)}
      >
        <span>{model.id}</span>
        {model.owned_by && <span className="model-option-owner">{model.owned_by}</span>}
      </div>
    ));
  };

  if (loading) return <div className="setting-loading">加载中...</div>;
  if (!settings) return <div className="setting-error">加载设置失败</div>;

  return (
    <div className="setting-container">
      <div className="setting-row">
        {/* 左侧：基础设置 */}
        <div className="setting-card">
          <div className="card-header">
            <div className="header-title"><Settings size={20} /><span>基础设置</span></div>
            <span className="header-tag">系统信息</span>
          </div>
          <div className="card-body">
            <div className="form-item">
              <label>系统名称</label>
              <input type="text" value={settings.system_name || ''} onChange={e => updateField('system_name', e.target.value)} placeholder="请输入系统名称" />
            </div>
            <div className="form-item">
              <label>系统简称</label>
              <input type="text" value={settings.system_short_name || ''} onChange={e => updateField('system_short_name', e.target.value)} placeholder="请输入系统简称" />
            </div>
            <div className="form-item">
              <label>飞书 Webhook</label>
              <input type="text" value={settings.fs_webhook_url || ''} onChange={e => updateField('fs_webhook_url', e.target.value)} placeholder="请输入飞书机器人 Webhook 地址" />
              <div className="form-tip">用于任务执行结果通知</div>
            </div>
            <div className="form-item">
              <label>平台地址</label>
              <input type="text" value={settings.system_url || ''} onChange={e => updateField('system_url', e.target.value)} placeholder="请输入平台地址，如：http://example.com" />
              <div className="form-tip">用于生成分享链接等功能</div>
            </div>

            <div className="section-block">
              <div className="block-title"><Bot size={16} /> AI 分析配置</div>
              <div className="protection-header">
                <div>
                  <div className="setting-label">启用 AI 分析</div>
                  <div className="setting-desc">开启后，SQL 查询页可对 EXPLAIN 语句发起 AI 执行计划分析</div>
                </div>
                <label className="switch"><input type="checkbox" checked={settings.ai_enabled || false} onChange={e => updateField('ai_enabled', e.target.checked)} /><span className="slider"></span></label>
              </div>
              <div className="form-item">
                <label>AI 服务地址</label>
                <input type="text" value={settings.ai_base_url || ''} onChange={e => updateField('ai_base_url', e.target.value)} placeholder="如：https://api.deepseek.com/v1" />
                <div className="form-tip">兼容 OpenAI 协议的服务地址，填到 /v1 级别即可，后端自动拼接 /chat/completions</div>
              </div>
              <div className="form-item">
                <label>API Key</label>
                <div className="password-input-wrapper">
                  <input type={showAiKey ? 'text' : 'password'} value={settings.ai_api_key || ''} onChange={e => updateField('ai_api_key', e.target.value)} placeholder="请输入 AI 服务 API Key" />
                  <button type="button" className="password-toggle" onClick={() => setShowAiKey(!showAiKey)}>
                    {showAiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="form-tip">已配置时显示掩码（如 sk-a****bcde），保持掩码不变即可保留原 Key；输入新值则覆盖</div>
              </div>
              <div className="form-item">
                <label>模型名称</label>
                <div className="model-select" ref={modelSelectRef}>
                  <input
                    type="text"
                    className="model-select-input"
                    value={settings.ai_model || ''}
                    readOnly
                    placeholder="点击从 AI 服务商获取模型列表"
                    onClick={handleModelClick}
                  />
                  <ChevronDown size={16} className="model-select-arrow" />
                  {modelOpen && <div className="model-dropdown">{renderModelDropdown()}</div>}
                </div>
                <div className="form-tip">点击输入框从 AI 服务商获取可用模型列表，选择后填入</div>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：安全设置 */}
        <div className="setting-card">
          <div className="card-header">
            <div className="header-title"><Lock size={20} /><span>安全设置</span></div>
            <span className="header-tag warning">安全防护</span>
          </div>
          <div className="card-body">
            <div className="section-block">
              <div className="block-title"><Key size={16} /> 密码策略</div>
              <div className="form-item">
                <label>默认密码</label>
                <div className="password-input-wrapper">
                  <input type={showPassword ? 'text' : 'password'} value={settings.default_password} onChange={e => updateField('default_password', e.target.value)} placeholder="新用户初始密码" />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="form-item">
                <label>密码长度范围</label>
                <div className="range-inputs">
                  <div className="range-item"><span>最小</span><input type="number" value={settings.password_min_length} onChange={e => updateField('password_min_length', Number(e.target.value))} min={6} max={32} /></div>
                  <div className="range-item"><span>最大</span><input type="number" value={settings.password_max_length} onChange={e => updateField('password_max_length', Number(e.target.value))} min={8} max={64} /></div>
                </div>
              </div>
              <div className="form-item">
                <label>密码规则要求</label>
                <div className="rule-list">
                  <label className="rule-item"><input type="checkbox" checked={settings.password_need_number} onChange={e => updateField('password_need_number', e.target.checked)} /><span>数字</span><code>12345</code></label>
                  <label className="rule-item"><input type="checkbox" checked={settings.password_need_letter} onChange={e => updateField('password_need_letter', e.target.checked)} /><span>字母</span><code>abc123</code></label>
                  <label className="rule-item"><input type="checkbox" checked={settings.password_need_case} onChange={e => updateField('password_need_case', e.target.checked)} /><span>大写字母</span><code>ABC</code></label>
                  <label className="rule-item"><input type="checkbox" checked={settings.password_need_special} onChange={e => updateField('password_need_special', e.target.checked)} /><span>特殊字符</span><code>!@#$%</code></label>
                </div>
              </div>
            </div>

            <div className="section-block">
              <div className="block-title"><Shield size={16} /> 登录保护</div>
              <div className="protection-header">
                <div><div className="setting-label">登录失败锁定</div><div className="setting-desc">开启后，连续登录失败将临时锁定账号</div></div>
                <label className="switch"><input type="checkbox" checked={settings.login_protection || false} onChange={e => updateField('login_protection', e.target.checked)} /><span className="slider"></span></label>
              </div>
              {settings.login_protection && (
                <div className="lock-config">
                  <div className="config-row"><span>失败次数</span><input type="number" value={settings.login_fail_count || 5} onChange={e => updateField('login_fail_count', Number(e.target.value))} min={3} max={10} /><span>次</span></div>
                  <div className="config-row"><span>锁定时长</span><input type="number" value={settings.login_lock_time || 30} onChange={e => updateField('login_lock_time', Number(e.target.value))} min={1} max={1440} /><span>分钟</span></div>
                </div>
              )}
              <div className="config-row" style={{marginTop: 16}}><span>Token 过期时间</span><input type="number" value={settings.token_expire_time || 24} onChange={e => updateField('token_expire_time', Number(e.target.value))} min={1} max={168} /><span>小时</span></div>
            </div>
          </div>
        </div>
      </div>

      {isChanged && (
        <div className="setting-footer">
          <button className="btn btn-default" onClick={handleCancel}>取消修改</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存配置'}</button>
        </div>
      )}
    </div>
  );
};

export default SystemSetting;
