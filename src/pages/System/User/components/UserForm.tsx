/**
 * 用户表单组件
 */

import { useState, useEffect } from 'react';
import { createUser, updateUser, type User, type CreateUserRequest, type UpdateUserRequest } from '@/services/system/user';
import { getBasicSetting } from '@/services/system/setting';
import { toast } from '@/components/AppNotification';
import TreeSelect from '@/components/TreeSelect';
import type { Role } from '@/services/system/role';
import type { Dept } from '@/services/system/dept';
import './UserForm.css';

interface UserFormProps {
  visible: boolean;
  editData: Partial<User>;
  roleOptions: Role[];
  deptOptions: Dept[];
  isSuperAdmin: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const UserForm = ({ visible, editData, roleOptions, deptOptions, isSuperAdmin, onClose, onSuccess }: UserFormProps) => {
  const isEdit = !!editData.id;
  
  const [form, setForm] = useState({
    user_name: '',
    nick_name: '',
    phone: '',
    email: '',
    role_id: undefined as number | undefined,
    dept_id: undefined as string | undefined,
    password: '',
    allow_password_login: true,
  });

  const [passwordTip, setPasswordTip] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 初始化表单
  useEffect(() => {
    if (visible) {
      if (editData.id) {
        const deptIdStr = editData.dept_id ? String(editData.dept_id) : undefined;
        setForm({
          user_name: editData.user_name || '',
          nick_name: editData.nick_name || '',
          phone: editData.phone || '',
          email: editData.email || '',
          role_id: editData.role_id,
          dept_id: deptIdStr,
          password: '',
          allow_password_login: editData.allow_password_login ?? true,
        });
      } else {
        setForm({
          user_name: '',
          nick_name: '',
          phone: '',
          email: '',
          role_id: undefined,
          dept_id: undefined,
          password: '',
          allow_password_login: true,
        });
      }
      fetchPasswordRules();
    }
  }, [visible, editData]);

  // 获取密码规则
  const fetchPasswordRules = async () => {
    try {
      const res = await getBasicSetting();
      if (res.code === 200) {
        const data = res.data;
        const tips = [];
        if (data.password_need_number) tips.push('数字');
        if (data.password_need_letter) tips.push('字母');
        if (data.password_need_case) tips.push('大写字母');
        if (data.password_need_special) tips.push('特殊字符');
        if (tips.length > 0) {
          setPasswordTip(`密码必须包含: ${tips.join('、')}，长度 ${data.password_min_length}-${data.password_max_length} 位`);
        }
      }
    } catch {}
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isEdit && !form.user_name.trim()) {
      toast.warning('请输入用户名');
      return;
    }

    setSubmitting(true);
    try {
      // dept_id 需要转换为数字类型
      const deptIdValue = form.dept_id ? Number(form.dept_id) : undefined;
      
      if (isEdit) {
        const data: UpdateUserRequest = {
          id: editData.id!,
          nick_name: form.nick_name,
          phone: form.phone || undefined,
          email: form.email || undefined,
          role_id: form.role_id,
          dept_id: deptIdValue as unknown as string,
          allow_password_login: form.allow_password_login,
        };
        if (form.password) {
          data.password = form.password;
        }
        const res = await updateUser(data);
        if (res.code === 200) {
          onSuccess();
        }
      } else {
        const data: CreateUserRequest = {
          user_name: form.user_name,
          nick_name: form.nick_name,
          phone: form.phone || undefined,
          email: form.email || undefined,
          role_id: form.role_id,
          dept_id: deptIdValue as unknown as string,
          allow_password_login: form.allow_password_login,
        };
        if (form.password) {
          data.password = form.password;
        }
        const res = await createUser(data);
        if (res.code === 200) {
          onSuccess();
        }
      }
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  // 过滤部门树（排除系统部门 id=1）
  const filterDeptTree = (depts: Dept[]): Dept[] => {
    return depts
      .filter(d => Number(d.id) !== 1)
      .map(d => ({
        ...d,
        children: d.children ? filterDeptTree(d.children) : undefined
      }));
  };

  // 过滤角色和部门选项
  const filteredRoles = roleOptions.filter(r => r.id !== 1);
  const filteredDeptTree = filterDeptTree(deptOptions);
  
  // 确保 dept_id 能匹配到选项
  const currentDeptId = form.dept_id ? String(form.dept_id) : '';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? '编辑用户' : '新增用户'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label>用户名 <span className="required">*</span></label>
                {isEdit ? (
                  <div className="static-field">{form.user_name}</div>
                ) : (
                  <input
                    type="text"
                    value={form.user_name}
                    onChange={e => setForm(f => ({ ...f, user_name: e.target.value }))}
                    placeholder="请输入用户名"
                  />
                )}
              </div>

              <div className="form-group">
                <label>昵称</label>
                <input
                  type="text"
                  value={form.nick_name}
                  onChange={e => setForm(f => ({ ...f, nick_name: e.target.value }))}
                  placeholder="请输入昵称"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>手机号</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="请输入手机号"
                />
              </div>

              <div className="form-group">
                <label>邮箱</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="请输入邮箱"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>角色</label>
                <select
                  value={form.role_id || ''}
                  onChange={e => setForm(f => ({ ...f, role_id: e.target.value ? Number(e.target.value) : undefined }))}
                >
                  <option value="">请选择角色</option>
                  {filteredRoles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>

              {isSuperAdmin && (
                <div className="form-group">
                  <label>部门</label>
                  <TreeSelect
                    value={currentDeptId}
                    options={filteredDeptTree}
                    placeholder="请选择部门"
                    onChange={(val) => setForm(f => ({ ...f, dept_id: val }))}
                  />
                </div>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>密码</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={isEdit ? '不填则不修改' : '不填则使用默认密码'}
                />
              </div>

              {isEdit && (
                <div className="form-group">
                  <label>密码登录</label>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={form.allow_password_login}
                      onChange={e => setForm(f => ({ ...f, allow_password_login: e.target.checked }))}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              )}
            </div>

            {passwordTip && <div className="form-tip" style={{ marginTop: '-8px' }}>ℹ️ {passwordTip}</div>}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-default" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? '保存中...' : '确定'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserForm;
