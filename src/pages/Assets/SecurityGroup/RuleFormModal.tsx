/**
 * 安全组规则 新增/编辑 弹窗
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

const RuleFormModal = ({ visible, editRule, onClose, onSuccess }: Props) => {
  const [form, setForm] = useState({ ...defaultForm });
  const [loading, setLoading] = useState(false);

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
    } else {
      setForm({ ...defaultForm });
    }
  }, [visible, editRule]);

  const handleChange = (field: string, value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      // 协议为 all 时，端口范围固定为 -1/-1
      if (field === 'ip_protocol' && value === 'all') {
        next.port_range = '-1/-1';
      }
      return next;
    });
  };

  // 自动格式化端口范围：纯数字 → 数字/数字
  const normalizePortRange = (val: string): string => {
    const v = val.trim();
    if (/^\d+$/.test(v)) return `${v}/${v}`;
    return v;
  };

  const validate = (): string | null => {
    if (!form.ip_protocol) return '请选择协议';
    if (!form.port_range.trim()) return '请填写端口范围';
    const normalized = normalizePortRange(form.port_range);
    if (!/^-?\d+\/-?\d+$/.test(normalized)) {
      return '端口范围格式错误，请填写如 80 或 80/80';
    }
    if (!form.source_cidr_ip.trim()) return '请填写源 IP 段';
    const priority = Number(form.priority);
    if (isNaN(priority) || priority < 1 || priority > 100) return '优先级须在 1-100 之间';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }

    // 提交前自动格式化端口
    const normalizedPortRange = normalizePortRange(form.port_range);

    setLoading(true);
    try {
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

      if (res.code === 200) {
        toast.success(isEdit ? '规则已更新' : '规则已添加');
        onSuccess();
      } else {
        toast.error(res.message || '操作失败');
      }
    } catch (e) {
      console.error('[SecurityGroup] 操作失败:', e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || '操作失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="rule-modal-overlay" onClick={onClose}>
      <div className="rule-modal" onClick={e => e.stopPropagation()}>
        <div className="rule-modal-header">
          <span>{isEdit ? '编辑入站规则' : '新增入站规则'}</span>
          <button className="rule-modal-close" onClick={onClose}>
            <X size={16} />
          </button>
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
              <span className="rule-form-hint">如 80/80、8080/8090，all 协议填 -1/-1</span>
            </label>
            <input
              className="rule-form-input"
              placeholder="如 80/80 或 3306/3306"
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
            <label className="rule-form-label">描述</label>
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
