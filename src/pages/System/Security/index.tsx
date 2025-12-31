/**
 * 安全配置页面 - IP黑名单管理
 */

import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Trash2, Save, Loader2 } from 'lucide-react';
import { getBlacklist, addToBlacklist, removeFromBlacklist, getSecurityConfig, updateSecurityConfig } from '../../../services/system/security';
import toast from '../../../components/Toast';
import './index.css';

interface BlacklistItem { ip: string; }
interface SecurityConfig {
  blacklist_count: number;
  blacklist_lock: number;
  ratelimit_cd: number;
  ratelimit_ttl: number;
}

const Security = () => {
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [blacklist, setBlacklist] = useState<BlacklistItem[]>([]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [newIp, setNewIp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [config, setConfig] = useState<SecurityConfig>({
    blacklist_count: 10, blacklist_lock: 24, ratelimit_cd: 60, ratelimit_ttl: 3600
  });

  useEffect(() => { fetchBlacklist(); fetchConfig(); }, []);

  const fetchBlacklist = async () => {
    setLoading(true);
    try {
      const res = await getBlacklist();
      if (res.code === 200) setBlacklist((res.data as BlacklistItem[]) || []);
    } catch { toast.error('获取黑名单失败'); }
    finally { setLoading(false); }
  };

  const fetchConfig = async () => {
    try {
      const res = await getSecurityConfig();
      if (res.code === 200 && res.data) {
        const data = res.data as SecurityConfig;
        setConfig({
          blacklist_count: data.blacklist_count || 10,
          blacklist_lock: data.blacklist_lock || 24,
          ratelimit_cd: data.ratelimit_cd || 60,
          ratelimit_ttl: data.ratelimit_ttl || 3600
        });
      }
    } catch { /* ignore */ }
  };

  const handleAdd = async () => {
    if (!newIp.trim()) { toast.error('请输入IP地址'); return; }
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(newIp)) { toast.error('IP地址格式不正确'); return; }
    setSubmitting(true);
    try {
      const res = await addToBlacklist({ ip: newIp });
      if (res.code === 200) { toast.success('添加成功'); setDialogVisible(false); setNewIp(''); fetchBlacklist(); }
      else toast.error(res.message || '添加失败');
    } catch { toast.error('添加失败'); }
    finally { setSubmitting(false); }
  };

  const handleRemove = async (ip: string) => {
    if (!confirm(`确认将IP ${ip} 从黑名单中移除?`)) return;
    try {
      const res = await removeFromBlacklist({ ip });
      if (res.code === 200) { toast.success('移除成功'); fetchBlacklist(); }
      else toast.error(res.message || '移除失败');
    } catch { toast.error('移除失败'); }
  };

  const handleSaveConfig = async () => {
    setConfigLoading(true);
    try {
      const res = await updateSecurityConfig(config);
      if (res.code === 200) toast.success('保存成功');
      else toast.error(res.message || '保存失败');
    } catch { toast.error('保存失败'); }
    finally { setConfigLoading(false); }
  };

  // ESC 关闭弹框
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setDialogVisible(false); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="security-page">
      <div className="page-grid">
        {/* 黑名单列表 */}
        <div className="page-card">
          <div className="card-header">
            <span className="title">IP黑名单列表</span>
            <div className="actions">
              <button className="btn-primary" onClick={() => setDialogVisible(true)}><Plus size={14} /> 添加黑名单</button>
              <button className="btn-default" onClick={fetchBlacklist}><RefreshCw size={14} /> 刷新</button>
            </div>
          </div>
          <div className="card-body">
            {loading ? (
              <div className="loading-state"><Loader2 size={24} className="spin" /> 加载中...</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>IP地址</th><th>操作</th></tr></thead>
                <tbody>
                  {blacklist.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.ip}</td>
                      <td><button className="btn-danger-text" onClick={() => handleRemove(item.ip)}><Trash2 size={14} /> 删除</button></td>
                    </tr>
                  ))}
                  {blacklist.length === 0 && <tr><td colSpan={2} className="empty-cell">暂无数据</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 安全配置 */}
        <div className="page-card">
          <div className="card-header">
            <span className="title">安全配置</span>
            <button className="btn-primary" onClick={handleSaveConfig} disabled={configLoading}>
              {configLoading ? <Loader2 size={14} className="spin" /> : <Save size={14} />} 保存配置
            </button>
          </div>
          <div className="card-body">
            <div className="config-form">
              <div className="form-item">
                <label>黑名单错误次数</label>
                <input type="number" value={config.blacklist_count} onChange={e => setConfig({ ...config, blacklist_count: Number(e.target.value) })} min={1} max={100} />
                <span className="tip">达到此次数后IP将被加入黑名单</span>
              </div>
              <div className="form-item">
                <label>黑名单锁定时间</label>
                <input type="number" value={config.blacklist_lock} onChange={e => setConfig({ ...config, blacklist_lock: Number(e.target.value) })} min={1} max={720} />
                <span className="tip">单位：小时</span>
              </div>
              <div className="form-item">
                <label>限流冷却时间</label>
                <input type="number" value={config.ratelimit_cd} onChange={e => setConfig({ ...config, ratelimit_cd: Number(e.target.value) })} min={1} max={3600} />
                <span className="tip">单位：秒</span>
              </div>
              <div className="form-item">
                <label>Redis存储时间</label>
                <input type="number" value={config.ratelimit_ttl} onChange={e => setConfig({ ...config, ratelimit_ttl: Number(e.target.value) })} min={1} max={86400} />
                <span className="tip">单位：秒</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 添加弹框 */}
      {dialogVisible && (
        <>
          <div className="dialog-overlay" onClick={() => setDialogVisible(false)} />
          <div className="dialog-container">
            <div className="dialog-header"><h3>添加IP黑名单</h3></div>
            <div className="dialog-body">
              <div className="form-item">
                <label>IP地址</label>
                <input type="text" value={newIp} onChange={e => setNewIp(e.target.value)} placeholder="请输入IP地址" />
              </div>
            </div>
            <div className="dialog-footer">
              <button className="btn-default" onClick={() => setDialogVisible(false)}>取消</button>
              <button className="btn-primary" onClick={handleAdd} disabled={submitting}>
                {submitting ? <Loader2 size={14} className="spin" /> : null} 确认
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Security;
