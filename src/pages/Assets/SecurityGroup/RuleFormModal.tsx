/**
 * 安全组规则 新增/编辑 弹窗
 * - isAdmin=true：完整字段，无端口限制
 * - isAdmin=false：新增填 IP + 项目/提交人/用途，固定开放 80 和 443；编辑只能改 IP 和描述
 */

import { useState, useEffect } from 'react';
import type { SecurityGroupRule, AddRuleParams, UpdateRuleParams } from '@/services/assets/securityGroup';
import { addSecurityGroupRule, updateSecurityGroupRule } from '@/services/assets/securityGroup';
import toast from '@/components/Toast';
import DraggableModal from '@/components/DraggableModal';
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
  // 普通用户专用字段
  project: '',
  submitter: '',
  purpose: '',
};

// 自动格式化端口范围：纯数字 → 数字/数字
const normalizePortRange = (val: string): string => {
  const v = val.trim();
  if (/^\d+$/.test(v)) return `${v}/${v}`;
  return v;
};

/**
 * 展开 IP 范围：192.168.1.0-4 → ["192.168.1.0","192.168.1.1","192.168.1.2","192.168.1.3","192.168.1.4"]
 * 普通 IP/CIDR 直接原样返回单元素数组
 */
const expandIpRange = (token: string): string[] => {
  const rangeMatch = token.match(/^(\d+\.\d+\.\d+\.)(\d+)-(\d+)$/);
  if (rangeMatch) {
    const prefix = rangeMatch[1];
    const start = parseInt(rangeMatch[2], 10);
    const end = parseInt(rangeMatch[3], 10);
    if (!isNaN(start) && !isNaN(end) && start <= end && end <= 255) {
      const result: string[] = [];
      for (let i = start; i <= end; i++) {
        result.push(`${prefix}${i}`);
      }
      return result;
    }
  }
  return [token];
};

/**
 * 从一段文本中提取所有合法的 IP/CIDR/范围 token
 * 支持：192.168.1.1 / 192.168.1.0/24 / 192.168.1.0-4
 * 会自动忽略 "测试" "备注" 等无关文字
 */
const extractIpTokens = (val: string): string[] => {
  const matches = val.match(/\d+\.\d+\.\d+\.\d+(?:\/\d+|-\d+)?/g);
  return matches ?? [];
};

/**
 * 统一 IP 输入处理：
 * 1. 提取所有合法 IP/CIDR/范围 token，自动过滤无关文字
 * 2. 展开范围，如 192.168.1.0-4 → 192.168.1.0,...,192.168.1.4
 * 3. 拼接为英文逗号分隔字符串
 */
const normalizeIpInput = (val: string): string => {
  return extractIpTokens(val)
    .flatMap(expandIpRange)
    .join(',');
};

const RuleFormModal = ({ visible, editRule, isAdmin = true, onClose, onSuccess }: Props) => {
  const [form, setForm] = useState({ ...defaultForm });
  const [loading, setLoading] = useState(false);
  // 管理员新增时的标签页：'custom' | 'quick'
  const [adminTab, setAdminTab] = useState<'custom' | 'quick'>('custom');

  const isEdit = !!editRule;

  useEffect(() => {
    if (!visible) return;
    if (editRule) {
      setForm({
        ...defaultForm,
        ip_protocol: editRule.ip_protocol?.toLowerCase() || 'tcp',
        port_range: editRule.port_range || '',
        source_cidr_ip: editRule.source_cidr_ip || '',
        policy: editRule.policy?.toLowerCase() || 'accept',
        priority: String(editRule.priority ?? '1'),
        description: editRule.description || '',
      });
    } else {
      setForm({ ...defaultForm });
      setAdminTab('custom');
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
    if (!isEdit) {
      if (!form.project.trim()) return '请填写项目名称';
      if (!form.submitter.trim()) return '请填写提交人';
      if (!form.purpose.trim()) return '请填写用途';
    }
    return null;
  };

  // ── 管理员提交 ──
  const submitAdmin = async () => {
    const normalizedPortRange = normalizePortRange(form.port_range);
    const normalizedIp = normalizeIpInput(form.source_cidr_ip);
    if (isEdit && editRule?.security_group_rule_id) {
      return updateSecurityGroupRule({
        security_group_rule_id: editRule.security_group_rule_id,
        ip_protocol: form.ip_protocol,
        port_range: normalizedPortRange,
        source_cidr_ip: normalizedIp,
        policy: form.policy,
        priority: form.priority,
        description: form.description.trim(),
      } as UpdateRuleParams);
    }
    return addSecurityGroupRule({
      ip_protocol: form.ip_protocol,
      port_range: normalizedPortRange,
      source_cidr_ip: normalizedIp,
      policy: form.policy,
      priority: form.priority,
      description: form.description.trim(),
    } as AddRuleParams);
  };

  // ── 普通用户提交 ──
  const submitSimple = async () => {
    const ip = normalizeIpInput(form.source_cidr_ip);
    const descParts = [form.project, form.submitter, form.purpose].map(s => s.trim()).filter(Boolean);
    const desc = descParts.join('-');

    if (isEdit && editRule?.security_group_rule_id) {
      return updateSecurityGroupRule({
        security_group_rule_id: editRule.security_group_rule_id,
        source_cidr_ip: ip,
        description: form.description.trim(),
      });
    }

    // 新增：固定同时提交 80 和 443 两条规则
    for (const port of ['443/443', '80/80']) {
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
    return { code: 200, message: 'success' };
  };

  const handleSubmit = async () => {
    // 管理员新增时，快捷添加走 simple 逻辑
    const useSimple = !isAdmin || (!isEdit && adminTab === 'quick');
    const err = useSimple ? validateSimple() : validateAdmin();
    if (err) { toast.error(err); return; }

    setLoading(true);
    try {
      const res = useSimple ? await submitSimple() : await submitAdmin();
      if (res && res.code === 200) {
        toast.success(isEdit ? '规则已更新' : '规则已添加');
        onSuccess();
      } else if (res) {
        toast.error(res.message || '操作失败');
      }
    } catch (e) {
      console.error('[SecurityGroup] 操作失败:', e);
      const msg = e instanceof Error ? e.message : String(e);
      const friendlyMsg = msg.toLowerCase().includes('duplicat')
        ? '规则已存在，请勿重复添加'
        : (msg || '操作失败，请稍后重试');
      toast.error(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  // ── 普通用户视图 ──
  if (!isAdmin) {
    return (
      <DraggableModal
        visible={visible}
        title={isEdit ? '编辑规则' : '新增入站规则'}
        width={460}
        onClose={() => {}}
      >
        <div className="rule-modal-body">
          {/* 源 IP 段 */}
          <div className="rule-form-item">
            <label className="rule-form-label">
              源 IP 段 <span className="required">*</span>
              <span className="rule-form-hint">支持多个 IP，可用逗号、空格或换行分隔</span>
            </label>
            <textarea
              className="rule-form-input rule-form-textarea"
              placeholder={"1、单个 IP：192.168.1.0\n2、连续 IP：192.168.1.0-4（自动展开为 .0 到 .4）\n3、多个 IP 可换行、空格、逗号（中英文）分隔\n4、每行末尾带分号也可自动识别\n5、自动过滤非 IP 内容，如备注文字等"}
              rows={5}
              value={form.source_cidr_ip}
              onChange={e => handleChange('source_cidr_ip', e.target.value)}
            />
          </div>

          {/* 备注：新增时用三字段拼接，编辑时直接输入 */}
          {isEdit ? (
            <div className="rule-form-item">
              <label className="rule-form-label">备注</label>
              <input
                className="rule-form-input"
                placeholder="可选，规则用途说明"
                value={form.description}
                onChange={e => handleChange('description', e.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="rule-form-item">
                <label className="rule-form-label">
                  项目 <span className="required">*</span>
                </label>
                <input
                  className="rule-form-input"
                  placeholder="如 安薪花"
                  value={form.project}
                  onChange={e => handleChange('project', e.target.value)}
                />
              </div>
              <div className="rule-form-item">
                <label className="rule-form-label">
                  提交人 <span className="required">*</span>
                </label>
                <input
                  className="rule-form-input"
                  placeholder="如 张三"
                  value={form.submitter}
                  onChange={e => handleChange('submitter', e.target.value)}
                />
              </div>
              <div className="rule-form-item">
                <label className="rule-form-label">
                  用途 <span className="required">*</span>
                </label>
                <input
                  className="rule-form-input"
                  placeholder="如 联调"
                  value={form.purpose}
                  onChange={e => handleChange('purpose', e.target.value)}
                />
              </div>
              {(form.project || form.submitter || form.purpose) && (
                <div className="rule-desc-preview">
                  备注预览：<span>
                    {[form.project, form.submitter, form.purpose].map(s => s.trim()).filter(Boolean).join('-')}
                  </span>
                </div>
              )}
              <div className="rule-form-hint">
                提交后将同时创建 80（HTTP）和 443（HTTPS）两条规则
              </div>
            </>
          )}
        </div>

        <div className="rule-modal-footer">
          <button className="btn" onClick={onClose} disabled={loading}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? '提交中...' : isEdit ? '保存修改' : '确认添加'}
          </button>
        </div>
      </DraggableModal>
    );
  }

  // ── 管理员视图（完整表单） ──
  return (
    <DraggableModal
      visible={visible}
      title={isEdit ? '编辑入站规则' : '新增入站规则'}
      width={500}
      onClose={() => {}}
    >
      {/* 标签页（仅新增时显示） */}
      {!isEdit && (
        <div className="rule-tabs">
          <button
            className={`rule-tab ${adminTab === 'custom' ? 'active' : ''}`}
            onClick={() => { setAdminTab('custom'); setForm({ ...defaultForm }); }}
          >
            自定义规则
          </button>
          <button
            className={`rule-tab ${adminTab === 'quick' ? 'active' : ''}`}
            onClick={() => { setAdminTab('quick'); setForm({ ...defaultForm }); }}
          >
            快捷添加
          </button>
        </div>
      )}

      {/* 快捷添加（复用普通用户表单） */}
      {!isEdit && adminTab === 'quick' ? (
        <>
          <div className="rule-modal-body">
            <div className="rule-form-item">
              <label className="rule-form-label">
                源 IP 段 <span className="required">*</span>
                <span className="rule-form-hint">支持多个 IP，可用逗号、空格或换行分隔</span>
              </label>
              <textarea
                className="rule-form-input rule-form-textarea"
                placeholder={"1、单个 IP：192.168.1.0\n2、连续 IP：192.168.1.0-4（自动展开为 .0 到 .4）\n3、多个 IP 可换行、空格、逗号（中英文）分隔\n4、每行末尾带分号也可自动识别\n5、自动过滤非 IP 内容，如备注文字等"}
                rows={5}
                value={form.source_cidr_ip}
                onChange={e => handleChange('source_cidr_ip', e.target.value)}
              />
            </div>
            <div className="rule-form-item">
              <label className="rule-form-label">项目 <span className="required">*</span></label>
              <input
                className="rule-form-input"
                placeholder="如 安薪花"
                value={form.project}
                onChange={e => handleChange('project', e.target.value)}
              />
            </div>
            <div className="rule-form-item">
              <label className="rule-form-label">提交人 <span className="required">*</span></label>
              <input
                className="rule-form-input"
                placeholder="如 张三"
                value={form.submitter}
                onChange={e => handleChange('submitter', e.target.value)}
              />
            </div>
            <div className="rule-form-item">
              <label className="rule-form-label">用途 <span className="required">*</span></label>
              <input
                className="rule-form-input"
                placeholder="如 联调"
                value={form.purpose}
                onChange={e => handleChange('purpose', e.target.value)}
              />
            </div>
            {(form.project || form.submitter || form.purpose) && (
              <div className="rule-desc-preview">
                备注预览：<span>
                  {[form.project, form.submitter, form.purpose].map(s => s.trim()).filter(Boolean).join('-')}
                </span>
              </div>
            )}
            <div className="rule-form-hint">
              提交后将同时创建 80（HTTP）和 443（HTTPS）两条规则
            </div>
          </div>
          <div className="rule-modal-footer">
            <button className="btn" onClick={onClose} disabled={loading}>取消</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? '提交中...' : '确认添加'}
            </button>
          </div>
        </>
      ) : (
        <>
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
                <span className="rule-form-hint">支持多个 IP，可用逗号、空格或换行分隔</span>
              </label>
              <textarea
                className="rule-form-input rule-form-textarea"
                placeholder={"1、单个 IP：192.168.1.0\n2、连续 IP：192.168.1.0-4（自动展开为 .0 到 .4）\n3、多个 IP 可换行、空格、逗号（中英文）分隔\n4、每行末尾带分号也可自动识别\n5、自动过滤非 IP 内容，如备注文字等"}
                rows={5}
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
        </>
      )}
    </DraggableModal>
  );
};

export default RuleFormModal;
