/**
 * 安全组规则 新增/编辑 弹窗
 * - isAdmin=true：完整字段，无端口限制
 * - isAdmin=false：新增只填 IP + 勾选 80/443；编辑只能改 IP 和描述
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { SecurityGroupRule, AddRuleParams, UpdateRuleParams } from '@/services/assets/securityGroup';
import { addSecurityGroupRule, updateSecurityGroupRule } from '@/services/assets/securityGroup';
import toast from '@/components/Toast';
import './RuleFormModal.css';

interface Props {
  visible: boolean;
  editRule?: SecurityGroupRule | null;
  isAdmin?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PROTOCOL_OPTIONS = ['tcp', 'udp', 'icmp', 'all'];
const POLICY_OPTIONS = ['accept', 'drop'];

const defaultForm = {
  ip_protocol: 'tcp',
  port_range: '',
  source_cidr_ip: '',
  policy: 'accept',
  priority: '1',
  description: '',
};

// 自动格式化端口范围：纯数字 → 数字/数字
const normalizePortRange = (val: string): string => {
  const v = val.trim();
  if (/^\d+$/.test(v)) return `${v}/${v}`;
  return v;
};

const RuleFormModal = ({ visible, editRule, isAdmin = true, onClose, onSuccess }: Props) => {
  const [form, setForm] = useState({ ...defaultForm });
  const [loading, setLoading] = useState(false);

  // 普通用户新增时的端口勾选：默认只开 443，可选同时开 80
  const [open443, setOpen443] = useState(true);
  const [open80, setOpen80] = useState(false);

  const isEdit = !!editRule;

  useEffect(() => {
    if (!visible) return;
    if (editRule) {
      setForm({
        ip_protocol: editRule.ip_protocol?.toLowerCase() || 'tcp',
        port_range: editRule.port_range || '',
        source_cidr_ip: editRule.source_cidr_ip || '',
        policy: editRule.policy?.toLowerCase() || 'accept',
        priority: String(editRule.priority ?? '1'),
        description: editRule.description || '',
      });
      // 编辑时根据当前端口预选勾选框
      setOpen443(editRule.port_range === '443/443');
      setOpen80(editRule.port_range === '80/80');
    } else {
      setForm({ ...defaultForm });
      setOpen443(true);
      setOpen80(false);
    }
  }, [visible, editRule]);

  const handleChange = (field: string, value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'ip_protocol' && value === 'all') {
        next.port_range = '-1/-1';
      }
      return next;
    });
  };

  // ── 管理员模式校验 ──
  const validateAdmin = (): string | null => {
    if (!form.ip_protocol) return '请选择协议';
    if (!form.port_range.trim()) return '请填写端口范围';
    const normalized = normalizePortRange(form.port_range);
    if (!/^-?\d+\/-?\d+$/.test(normalized)) return '端口范围格式错误，请填写如 80 或 80/80';
    if (!form.source_cidr_ip.trim()) return '请填写源 IP 段';
    const priority = Number(form.priority);
    if (isNaN(priority) || priority < 1 || priority > 100) return '优先级须在 1-100 之间';
    return null;
  };

  // ── 普通用户模式校验 ──
  const validateSimple = (): string | null => {
    if (!form.source_cidr_ip.trim()) return '请填写源 IP 段';
    if (!open443 && !open80) return '请至少勾选一个端口（80 或 443）';
    return null;
  };

  // ── 管理员提交 ──
  const submitAdmin = async () => {
    const normalizedPortRange = normalizePortRange(form.port_range);
    let res;
    if (isEdit && editRule?.security_group_rule_id) {
      const params: UpdateRuleParams = {
        security_group_rule_id: editRule.security_group_rule_id,
        ip_protocol: form.ip_protocol,
        port_range: normalizedPortRange,
        source_cidr_ip: form.source_cidr_ip.trim(),
        policy: form.policy,
        priority: form.priority,
        description: form.description.trim(),
      };
      res = await updateSecurityGroupRule(params);
    } else {
      const params: AddRuleParams = {
        ip_protocol: form.ip_protocol,
        port_range: normalizedPortRange,
        source_cidr_ip: form.source_cidr_ip.trim(),
        policy: form.policy,
        priority: form.priority,
        description: form.description.trim(),
      };
      res = await addSecurityGroupRule(params);
    }
    return res;
  };

  // ── 普通用户提交 ──
  const submitSimple = async () => {
    const ip = form.source_cidr_ip.trim();
    const desc = form.description.trim();

    if (isEdit && editRule?.security_group_rule_id) {
      // 编辑：根据勾选的端口更新（只能是 80 或 443 之一）
      const targetPort = open443 ? '443/443' : '80/80';
      return updateSecurityGroupRule({
        security_group_rule_id: editRule.security_group_rule_id,
        port_range: targetPort,
        source_cidr_ip: ip,
        description: desc,
      });
    }

    // 新增：按勾选批量提交 443 和/或 80
    const ports = [];
    if (open443) ports.push('443/443');
    if (open80) ports.push('80/80');

    // 逐个提交，任意一个失败则抛出
    for (const port of ports) {
      const res = await addSecurityGroupRule({
        ip_protocol: 'tcp',
        port_range: port,
        source_cidr_ip: ip,
        policy: 'accept',
        priority: '1',
        description: desc || `开放 ${port.split('/')[0]} 端口`,
      });
      if (res.code !== 200) {
        throw new Error(res.message || `添加 ${port} 规则失败`);
      }
    }
    // 返回最后一个成功的结果
    return { code: 200, message: 'success' };
  };

  const handleSubmit = async () => {
    const err = isAdmin ? validateAdmin() : validateSimple();
    if (err) { toast.error(err); return; }

    setLoading(true);
    try {
      const res = isAdmin ? await submitAdmin() : await submitSimple();
      if (res && res.code === 200) {
        toast.success(isEdit ? '规则已更新' : '规则已添加');
        onSuccess();
      } else if (res) {
        toast.error(res.message || '操作失败');
      }
    } catch (e) {
      console.error('[SecurityGroup] 操作失败:', e);
      const msg = e instanceof Error ? e.message : String(e);
      const friendlyMsg = msg.toLowerCase().includes('duplicat') ? '规则已存在，请勿重复添加' : (msg || '操作失败，请稍后重试');
      toast.error(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  // ── 普通用户视图 ──
  if (!isAdmin) {
    return (
      <div className="rule-modal-overlay" onClick={onClose}>
        <div className="rule-modal" onClick={e => e.stopPropagation()}>
          <div className="rule-modal-header">
            <span>{isEdit ? '编辑规则' : '新增入站规则'}</span>
            <button className="rule-modal-close" onClick={onClose}><X size={16} /></button>
          </div>

          <div className="rule-modal-body">
            {/* 源 IP 段 */}
            <div className="rule-form-item">
              <label className="rule-form-label">
                源 IP 段 <span className="required">*</span>
                <span className="rule-form-hint">如 0.0.0.0/0 或 192.168.1.0/24</span>
              </label>
              <input
                className="rule-form-input"
                placeholder="如 0.0.0.0/0"
                value={form.source_cidr_ip}
                onChange={e => handleChange('source_cidr_ip', e.target.value)}
              />
            </div>

            {/* 端口选择（新增多选，编辑单选） */}
            <div className="rule-form-item">
              <label className="rule-form-label">开放端口 <span className="required">*</span></label>
              <div className="rule-port-check-group">
                {isEdit ? (
                  // 编辑：单选
                  <>
                    <label className={`rule-port-check-item ${open443 ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="edit_port"
                        checked={open443}
                        onChange={() => { setOpen443(true); setOpen80(false); }}
                      />
                      <span className="rule-port-check-label">
                        <span className="rule-port-num">443</span>
                        <span className="rule-port-desc">HTTPS</span>
                      </span>
                    </label>
                    <label className={`rule-port-check-item ${open80 ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="edit_port"
                        checked={open80}
                        onChange={() => { setOpen80(true); setOpen443(false); }}
                      />
                      <span className="rule-port-check-label">
                        <span className="rule-port-num">80</span>
                        <span className="rule-port-desc">HTTP</span>
                      </span>
                    </label>
                  </>
                ) : (
                  // 新增：多选
                  <>
                    <label className={`rule-port-check-item ${open443 ? 'active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={open443}
                        onChange={e => setOpen443(e.target.checked)}
                      />
                      <span className="rule-port-check-label">
                        <span className="rule-port-num">443</span>
                        <span className="rule-port-desc">HTTPS</span>
                      </span>
                    </label>
                    <label className={`rule-port-check-item ${open80 ? 'active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={open80}
                        onChange={e => setOpen80(e.target.checked)}
                      />
                      <span className="rule-port-check-label">
                        <span className="rule-port-num">80</span>
                        <span className="rule-port-desc">HTTP</span>
                      </span>
                    </label>
                  </>
                )}
              </div>
              <div className="rule-form-hint" style={{ marginTop: 6 }}>
                {isEdit ? '切换端口将更新当前规则' : '可同时勾选，将分别创建两条规则，策略固定为「允许」'}
              </div>
            </div>

            {/* 描述 */}
            <div className="rule-form-item">
              <label className="rule-form-label">备注</label>
              <input
                className="rule-form-input"
                placeholder="可选，规则用途说明"
                value={form.description}
                onChange={e => handleChange('description', e.target.value)}
              />
            </div>
          </div>

          <div className="rule-modal-footer">
            <button className="btn" onClick={onClose} disabled={loading}>取消</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? '提交中...' : isEdit ? '保存修改' : '确认添加'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 管理员视图（完整表单） ──
  return (
    <div className="rule-modal-overlay" onClick={onClose}>
      <div className="rule-modal" onClick={e => e.stopPropagation()}>
        <div className="rule-modal-header">
          <span>{isEdit ? '编辑入站规则' : '新增入站规则'}</span>
          <button className="rule-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="rule-modal-body">
          {/* 协议 */}
          <div className="rule-form-item">
            <label className="rule-form-label">协议 <span className="required">*</span></label>
            <div className="rule-radio-group">
              {PROTOCOL_OPTIONS.map(p => (
                <label key={p} className={`rule-radio-item ${form.ip_protocol === p ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="ip_protocol"
                    value={p}
                    checked={form.ip_protocol === p}
                    onChange={() => handleChange('ip_protocol', p)}
                  />
                  {p.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          {/* 端口范围 */}
          <div className="rule-form-item">
            <label className="rule-form-label">
              端口范围 <span className="required">*</span>
              <span className="rule-form-hint">如 80 或 8080/8090，all 协议填 -1/-1</span>
            </label>
            <input
              className="rule-form-input"
              placeholder="如 80 或 3306/3306"
              value={form.port_range}
              disabled={form.ip_protocol === 'all'}
              onChange={e => handleChange('port_range', e.target.value)}
            />
          </div>

          {/* 源 IP 段 */}
          <div className="rule-form-item">
            <label className="rule-form-label">
              源 IP 段 <span className="required">*</span>
              <span className="rule-form-hint">如 0.0.0.0/0 或 192.168.1.0/24</span>
            </label>
            <input
              className="rule-form-input"
              placeholder="如 0.0.0.0/0"
              value={form.source_cidr_ip}
              onChange={e => handleChange('source_cidr_ip', e.target.value)}
            />
          </div>

          {/* 策略 */}
          <div className="rule-form-item">
            <label className="rule-form-label">策略</label>
            <div className="rule-radio-group">
              {POLICY_OPTIONS.map(p => (
                <label key={p} className={`rule-radio-item ${form.policy === p ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="policy"
                    value={p}
                    checked={form.policy === p}
                    onChange={() => handleChange('policy', p)}
                  />
                  {p === 'accept' ? '允许' : '拒绝'}
                </label>
              ))}
            </div>
          </div>

          {/* 优先级 */}
          <div className="rule-form-item">
            <label className="rule-form-label">
              优先级
              <span className="rule-form-hint">1-100，数字越小优先级越高</span>
            </label>
            <input
              className="rule-form-input rule-form-input-sm"
              type="number"
              min={1}
              max={100}
              value={form.priority}
              onChange={e => handleChange('priority', e.target.value)}
            />
          </div>

          {/* 描述 */}
          <div className="rule-form-item">
            <label className="rule-form-label">备注</label>
            <input
              className="rule-form-input"
              placeholder="可选，规则用途说明"
              value={form.description}
              onChange={e => handleChange('description', e.target.value)}
            />
          </div>
        </div>

        <div className="rule-modal-footer">
          <button className="btn" onClick={onClose} disabled={loading}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? '提交中...' : isEdit ? '保存修改' : '确认添加'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RuleFormModal;
