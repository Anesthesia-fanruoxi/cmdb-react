/**
 * 批量修改备注弹窗
 */

import { useState, useEffect } from 'react';
import { updateSecurityGroupRule } from '@/services/assets/securityGroup';
import type { SecurityGroupRule } from '@/services/assets/securityGroup';
import toast from '@/components/Toast';
import DraggableModal from '@/components/DraggableModal';

interface Props {
  visible: boolean;
  rules: SecurityGroupRule[];
  onClose: () => void;
  onSuccess: () => void;
}

const BatchDescModal = ({ visible, rules, onClose, onSuccess }: Props) => {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && rules.length > 0) {
      setDescription(rules[0].description || '');
    }
  }, [visible, rules]);

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error('请输入备注内容');
      return;
    }
    setLoading(true);
    try {
      const results = await Promise.allSettled(
        rules.map(r =>
          updateSecurityGroupRule({
            security_group_rule_id: r.security_group_rule_id!,
            description: description.trim(),
          })
        )
      );
      const failCount = results.filter(
        r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.code !== 200)
      ).length;

      if (failCount === 0) {
        toast.success(`已成功修改 ${rules.length} 条规则的备注`);
        setDescription('');
        onSuccess();
      } else if (failCount < rules.length) {
        toast.warning(`${rules.length - failCount} 条成功，${failCount} 条失败`);
        onSuccess();
      } else {
        toast.error('全部修改失败，请稍后重试');
      }
    } catch {
      toast.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setDescription('');
    onClose();
  };

  return (
    <DraggableModal
      visible={visible}
      title={`批量修改备注（已选 ${rules.length} 条）`}
      width={420}
      onClose={handleClose}
      showCloseBtn={false}
    >
      <div style={{ padding: '16px 20px 8px' }}>
        <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-secondary, #888)' }}>
          将统一修改所选规则的备注为：
        </div>
        <textarea
          style={{
            width: '100%',
            height: 80,
            padding: '8px 10px',
            border: '1px solid var(--border-color, #d9d9d9)',
            borderRadius: 4,
            fontSize: 13,
            resize: 'vertical',
            background: 'var(--bg-color)',
            color: 'var(--text-color)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
          placeholder="请输入备注内容"
          value={description}
          onChange={e => setDescription(e.target.value)}
          autoFocus
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '8px 20px 16px' }}>
        <button className="btn btn-default" onClick={handleClose}>取消</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? '提交中...' : '确定'}
        </button>
      </div>
    </DraggableModal>
  );
};

export default BatchDescModal;
