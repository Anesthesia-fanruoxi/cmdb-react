/**
 * 用户管理页面
 */

import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Plus } from 'lucide-react';
import { getUserList, updateUser, deleteUser, type User } from '../../../services/system/user';
import { getRoleList, type Role } from '../../../services/system/role';
import { getDeptList, type Dept } from '../../../services/system/dept';
import { getUserInfo } from '../../../utils/storage';
import { openComponentWindow } from '../../../utils/window';
import { confirm } from '../../../components/ConfirmModal';
import UserForm from './components/UserForm';
import './style.css';

const UserManagement = () => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<number | ''>('');
  const [pagination, setPagination] = useState({ page: 1, total: 0 });
  
  const currentUser = getUserInfo<{ role_id?: number }>() || {};
  const isSuperAdmin = currentUser.role_id === 1;
  
  const [formVisible, setFormVisible] = useState(false);
  const [editData, setEditData] = useState<Partial<User>>({});

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {};
      if (page > 1) params.page = page;
      if (searchText) params.name = searchText;
      if (roleFilter) params.role_id = roleFilter;

      const res = await getUserList(params);
      if (res.code === 200 && res.data) {
        setUsers(res.data.list || []);
        setPagination({ page, total: res.data.total || 0 });
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [searchText, roleFilter]);

  // 初始化加载角色和部门
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [roleRes, deptRes] = await Promise.all([getRoleList(), getDeptList()]);
        if (roleRes.code === 200) setRoles(roleRes.data || []);
        if (deptRes.code === 200) setDepts(deptRes.data || []);
      } catch (error) {
        console.error('获取选项失败:', error);
      }
    };
    fetchOptions();
  }, []);

  // 搜索条件变化时自动搜索（防抖）
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, roleFilter, fetchUsers]);

  const handleSwitchChange = async (user: User, field: keyof User, value: boolean) => {
    const oldValue = user[field];
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, [field]: value } : u));
    try {
      await updateUser({ id: user.id, [field]: value });
    } catch (error) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, [field]: oldValue } : u));
      console.error('更新失败:', error);
    }
  };

  const handleEdit = (user: User) => { setEditData(user); setFormVisible(true); };

  const handleProject = (user: User) => {
    openComponentWindow({
      type: 'user-project',
      label: `user-project-${user.id}`,
      title: `${user.nick_name || user.user_name} - 项目管理`,
      props: { userId: user.id, userName: user.user_name, nickName: user.nick_name, deptName: user.dept_name },
      width: 900, height: 650,
    });
  };

  const handleDelete = async (user: User) => {
    if (!await confirm({ content: `确定要删除用户 "${user.nick_name}" 吗？`, type: 'danger' })) return;
    try {
      const res = await deleteUser(user.id);
      if (res.code === 200) fetchUsers(pagination.page);
    } catch (error) {
      console.error('删除用户失败:', error);
    }
  };

  const handleFormSuccess = () => { setFormVisible(false); fetchUsers(1); };
  const totalPages = Math.ceil(pagination.total / 20);

  return (
    <div className="user-management">
      <div className="search-bar">
        <div className="search-left">
          <h3 className="page-title">用户管理</h3>
          <div className="search-input-wrapper">
            <Search size={14} className="search-icon" />
            <input type="text" placeholder="搜索用户名/昵称..." value={searchText}
              onChange={(e) => setSearchText(e.target.value)} className="search-input" />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value ? Number(e.target.value) : '')} className="role-select">
            <option value="">全部角色</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="search-right">
          <button className="btn btn-default" onClick={() => fetchUsers(pagination.page)}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> 刷新
          </button>
          <button className="btn btn-primary" onClick={() => { setEditData({}); setFormVisible(true); }}>
            <Plus size={14} /> 新增用户
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
                <th>用户</th>
                <th>手机号</th>
                <th>邮箱</th>
                <th>部门</th>
                <th>角色</th>
                <th style={{ width: 70, textAlign: 'center' }}>状态</th>
                <th style={{ width: 70, textAlign: 'center' }}>生产</th>
                <th style={{ width: 70, textAlign: 'center' }}>测试</th>
                <th style={{ width: 70, textAlign: 'center' }}>密码</th>
                <th style={{ width: 80, textAlign: 'center' }}>双因子</th>
                <th style={{ width: 160 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={11} className="empty-cell">暂无数据</td></tr>
              ) : users.map((user) => (
                <tr key={user.id} className={!user.is_enabled ? 'row-disabled' : ''}>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar">{(user.nick_name || user.user_name || '').charAt(0).toUpperCase()}</div>
                      <div className="user-info">
                        <div className="user-name">{user.nick_name || user.user_name}</div>
                        <div className="user-account">@{user.user_name}</div>
                      </div>
                    </div>
                  </td>
                  <td>{user.phone || '-'}</td>
                  <td className="email-cell">{user.email || '-'}</td>
                  <td>{user.dept_name || '-'}</td>
                  <td><span className="role-tag">{user.role_name}</span></td>
                  <td style={{ textAlign: 'center' }}>
                    <label className="switch"><input type="checkbox" checked={user.is_enabled} onChange={(e) => handleSwitchChange(user, 'is_enabled', e.target.checked)} /><span className="slider"></span></label>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <label className="switch"><input type="checkbox" checked={user.online_assets} onChange={(e) => handleSwitchChange(user, 'online_assets', e.target.checked)} /><span className="slider"></span></label>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <label className="switch"><input type="checkbox" checked={user.test_assets} onChange={(e) => handleSwitchChange(user, 'test_assets', e.target.checked)} /><span className="slider"></span></label>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <label className="switch"><input type="checkbox" checked={user.allow_password_login} onChange={(e) => handleSwitchChange(user, 'allow_password_login', e.target.checked)} /><span className="slider"></span></label>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`tag ${user.otp_enabled ? 'tag-success' : 'tag-default'}`}>{user.otp_enabled ? '已启用' : '未启用'}</span>
                  </td>
                  <td className="action-cell">
                    <button className="btn-link" onClick={() => handleEdit(user)}>编辑</button>
                    <button className="btn-link" onClick={() => handleProject(user)}>项目</button>
                    <button className="btn-link danger" onClick={() => handleDelete(user)}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination.total > 20 && (
        <div className="pagination">
          <span>共 {pagination.total} 条</span>
          <div className="page-btns">
            <button disabled={pagination.page <= 1} onClick={() => fetchUsers(pagination.page - 1)}>上一页</button>
            <span>{pagination.page} / {totalPages}</span>
            <button disabled={pagination.page >= totalPages} onClick={() => fetchUsers(pagination.page + 1)}>下一页</button>
          </div>
        </div>
      )}

      <UserForm visible={formVisible} editData={editData} roleOptions={roles} deptOptions={depts} 
        isSuperAdmin={isSuperAdmin} onClose={() => setFormVisible(false)} onSuccess={handleFormSuccess} />
    </div>
  );
};

export default UserManagement;
