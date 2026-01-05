/**
 * 角色管理页面
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, Shield } from 'lucide-react';
import { getRoleList, createRole, updateRole, deleteRole, type Role } from '../../../services/system/role';
import { openComponentWindow } from '../../../utils/window';
import { toast } from '../../../components/AppNotification';
import { confirm } from '../../../components/ConfirmModal';
import './style.css';

const RoleManagement = () => {
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [formVisible, setFormVisible] = useState(false);
  const [editData, setEditData] = useState<Partial<Role>>({});

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRoleList();
      if (res.code === 200) setRoles(res.data || []);
    } catch (error) {
      console.error('获取角色列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFormVisible(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAdd = () => { setEditData({ level: 1 }); setFormVisible(true); };

  const handleEdit = (role: Role) => {
    if (role.level === 0) { toast.warning('超级管理员角色不能编辑'); return; }
    setEditData(role);
    setFormVisible(true);
  };

  const handleDelete = async (role: Role) => {
    if (role.level === 0) { toast.warning('超级管理员角色不能删除'); return; }
    if (!await confirm({ content: `确定要删除角色 "${role.name}" 吗？`, type: 'danger' })) return;
    try {
      const res = await deleteRole(role.id);
      if (res.code === 200) fetchRoles();
    } catch (error) {
      console.error('删除角色失败:', error);
    }
  };

  const handlePermission = (role: Role) => {
    openComponentWindow({
      type: 'role-permission',
      label: `role-permission-${role.id}`,
      title: `${role.name} - 权限设置`,
      props: { roleId: role.id, roleName: role.name },
      width: 700, height: 600,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const code = formData.get('code') as string;
    const level = parseInt(formData.get('level') as string) || 1;
    const description = formData.get('description') as string;

    if (!name.trim() || !code.trim()) { toast.warning('请填写必填项'); return; }

    try {
      if (editData.id) {
        await updateRole({ id: editData.id, name, code, level, description });
      } else {
        await createRole({ name, code, level, description });
      }
      setFormVisible(false);
      fetchRoles();
    } catch (error) {
      console.error('保存角色失败:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return dateStr.replace('T', ' ').substring(0, 19);
  };

  // 获取角色等级标签样式
  const getLevelClass = (level: number) => {
    if (level === 0) return 'level-tag super';
    if (level === 1) return 'level-tag admin';
    return 'level-tag normal';
  };

  return (
    <div className="role-management">
      <div className="search-bar">
        <h3 className="page-title">角色管理</h3>
        <div className="header-actions">
          <button className="btn btn-default" onClick={fetchRoles}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> 刷新
          </button>
          <button className="btn btn-primary" onClick={handleAdd}>
            <Plus size={14} /> 新增角色
          </button>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading"><RefreshCw size={24} className="spin" /> 加载中...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 50, textAlign: 'center' }}>#</th>
                <th>角色名称</th>
                <th>角色编码</th>
                <th>角色描述</th>
                <th style={{ width: 100, textAlign: 'center' }}>级别</th>
                <th style={{ width: 160 }}>创建时间</th>
                <th style={{ width: 180 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {roles.length === 0 ? (
                <tr><td colSpan={7} className="empty-cell">暂无数据</td></tr>
              ) : roles.map((role, index) => (
                <tr key={role.id}>
                  <td style={{ textAlign: 'center' }}>{index + 1}</td>
                  <td>
                    <div className="role-cell">
                      <div className="role-icon"><Shield size={14} /></div>
                      <span>{role.name}</span>
                    </div>
                  </td>
                  <td><code className="code-tag">{role.code || '-'}</code></td>
                  <td className="desc-cell">{role.description || '-'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={getLevelClass(role.level)}>{role.level === 0 ? '超管' : `L${role.level}`}</span>
                  </td>
                  <td className="time-cell">{formatDate(role.created_at)}</td>
                  <td className="action-cell">
                    <button className="btn-link" onClick={() => handleEdit(role)} disabled={role.level === 0}>编辑</button>
                    <button className="btn-link" onClick={() => handlePermission(role)}>权限</button>
                    <button className="btn-link danger" onClick={() => handleDelete(role)} disabled={role.level === 0}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formVisible && (
        <div className="modal-overlay" onClick={() => setFormVisible(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>{editData.id ? '编辑角色' : '新增角色'}</h4>
              <button className="close-btn" onClick={() => setFormVisible(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-item">
                <label>角色名称 <span className="required">*</span></label>
                <input type="text" name="name" defaultValue={editData.name} placeholder="请输入角色名称" required />
              </div>
              <div className="form-item">
                <label>角色编码 <span className="required">*</span></label>
                <input type="text" name="code" defaultValue={editData.code} placeholder="请输入角色编码" required />
              </div>
              <div className="form-item">
                <label>角色级别 <span className="required">*</span></label>
                <input type="number" name="level" defaultValue={editData.level ?? 1} min={0} disabled={editData.level === 0} />
              </div>
              <div className="form-item">
                <label>角色描述</label>
                <textarea name="description" defaultValue={editData.description} placeholder="请输入角色描述" rows={3} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-default" onClick={() => setFormVisible(false)}>取消</button>
                <button type="submit" className="btn btn-primary">确定</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;
