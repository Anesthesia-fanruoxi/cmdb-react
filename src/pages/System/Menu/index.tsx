/**
 * 菜单管理页面
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getMenuTree, createMenu, updateMenu, deleteMenu } from '../../../services/system/menu';
import { toast } from '../../../components/AppNotification';
import { confirm } from '../../../components/ConfirmModal';
import type { MenuItem, CreateMenuRequest } from '../../../types/menu';
import Icon from '../../../components/Icon';
import IconSelect from '../../../components/IconSelect';
import './style.css';

interface FormData {
  id?: string;
  parent_id?: string;
  name: string;
  path: string;
  component: string;
  permission: string;
  icon: string;
  sort: number;
  is_visible: boolean;
  is_enabled: boolean;
}

const defaultForm: FormData = {
  name: '', path: '', component: '', permission: '', icon: '', sort: 0, is_visible: true, is_enabled: true
};

const MenuManagement = () => {
  const [loading, setLoading] = useState(false);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [parentMenu, setParentMenu] = useState<MenuItem | null>(null);

  const fetchMenus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMenuTree();
      if (res.code === 200) {
        setMenus(res.data || []);
        // 默认不展开，只显示父菜单
      }
    } catch (error) {
      console.error('获取菜单列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMenus(); }, [fetchMenus]);

  // ESC 键关闭弹窗
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && formVisible) {
        setFormVisible(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [formVisible]);

  const toggleExpand = (id: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // 父菜单路径（去掉开头的斜杠）
  const parentPath = useMemo(() => parentMenu?.path?.replace(/^\//, '') || '', [parentMenu]);

  // 计算完整路径
  const getFullPath = useCallback((path: string) => {
    const cleanPath = path.replace(/^\//, '');
    return parentMenu ? `${parentPath}/${cleanPath}` : cleanPath;
  }, [parentPath, parentMenu]);

  // 建议的组件路径
  const recommendPath = useMemo(() => {
    const fullPath = getFullPath(form.path);
    return fullPath ? `${fullPath}/index` : '';
  }, [form.path, getFullPath]);

  // 处理路径变化，自动生成权限标识
  const handlePathChange = (newPath: string) => {
    const fullPath = getFullPath(newPath);
    setForm(prev => ({
      ...prev,
      path: newPath,
      permission: fullPath.replace(/\//g, ':')
    }));
  };

  const handleAdd = (parent?: MenuItem) => {
    setParentMenu(parent || null);
    setForm({ ...defaultForm, parent_id: parent?.id });
    setFormVisible(true);
  };

  const handleEdit = (menu: MenuItem) => {
    setParentMenu(null);
    setForm({
      id: menu.id,
      name: menu.meta?.title || menu.name,
      path: menu.path,
      component: menu.component || '',
      permission: menu.permission || '',
      icon: menu.icon || '',
      sort: menu.sort ?? 0,
      is_visible: menu.is_visible !== false,
      is_enabled: (menu as any).is_enabled !== false,
    });
    setFormVisible(true);
  };

  const handleDelete = async (menu: MenuItem) => {
    if (menu.children?.length) {
      toast.warning('该菜单下有子菜单，无法删除');
      return;
    }
    if (!await confirm({ content: `确定要删除菜单 "${menu.meta?.title || menu.name}" 吗？`, type: 'danger' })) return;
    try {
      const res = await deleteMenu(menu.id!);
      if (res.code === 200) fetchMenus();
    } catch (error) {
      console.error('删除菜单失败:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.path.trim()) {
      toast.warning('请填写菜单名称和路径');
      return;
    }

    let finalPath = form.path;
    if (parentMenu) {
      finalPath = `/${parentPath}/${form.path.replace(/^\//, '')}`;
    } else if (!finalPath.startsWith('/')) {
      finalPath = `/${finalPath}`;
    }

    const data: CreateMenuRequest = {
      name: form.name,
      path: finalPath,
      component: form.component || undefined,
      permission: form.permission || undefined,
      icon: form.icon || undefined,
      parent_id: form.parent_id || parentMenu?.id,
      sort: form.sort,
      is_visible: form.is_visible,
    };

    try {
      if (form.id) {
        await updateMenu({ ...data, id: form.id });
      } else {
        await createMenu(data);
      }
      setFormVisible(false);
      fetchMenus();
    } catch (error) {
      console.error('保存菜单失败:', error);
    }
  };

  // 获取扁平菜单列表
  const flatMenus = useMemo(() => {
    const result: { id: string; title: string; level: number }[] = [];
    const flatten = (items: MenuItem[], level = 0) => {
      items.forEach(item => {
        if (item.id) result.push({ id: item.id, title: item.meta?.title || item.name, level });
        if (item.children?.length) flatten(item.children, level + 1);
      });
    };
    flatten(menus);
    return result;
  }, [menus]);

  // 渲染树形表格行
  const renderRows = (items: MenuItem[], level = 0): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    items.forEach(menu => {
      const hasChildren = menu.children && menu.children.length > 0;
      const isExpanded = menu.id ? expandedKeys.has(menu.id) : false;
      const isEnabled = (menu as any).is_enabled !== false;

      rows.push(
        <tr key={menu.id || menu.path}>
          <td style={{ paddingLeft: 16 + level * 24 }}>
            {hasChildren ? (
              <span className="expand-icon" onClick={() => menu.id && toggleExpand(menu.id)}>
                {isExpanded ? '▼' : '▶'}
              </span>
            ) : <span className="expand-placeholder" />}
            {menu.icon && <Icon name={menu.icon} size={16} className="menu-icon" />}
            {menu.meta?.title || menu.name}
          </td>
          <td>{menu.path}</td>
          <td>{menu.component || '-'}</td>
          <td>{menu.permission || '-'}</td>
          <td>{menu.sort ?? 0}</td>
          <td><span className={`status-tag ${isEnabled ? 'enabled' : 'disabled'}`}>{isEnabled ? '启用' : '禁用'}</span></td>
          <td className="action-cell">
            <button className="btn btn-link" onClick={() => handleAdd(menu)}>添加</button>
            <button className="btn btn-link" onClick={() => handleEdit(menu)}>编辑</button>
            <button className="btn btn-link btn-danger" onClick={() => handleDelete(menu)}>删除</button>
          </td>
        </tr>
      );
      if (hasChildren && isExpanded) rows.push(...renderRows(menu.children!, level + 1));
    });
    return rows;
  };

  // 编辑时是否禁用路径相关字段
  const isEditing = !!form.id;

  return (
    <div className="menu-management">
      <div className="page-header">
        <h3>菜单管理</h3>
        <div className="header-actions">
          <button className="btn btn-default" onClick={fetchMenus}>↻ 刷新</button>
          <button className="btn btn-primary" onClick={() => handleAdd()}>+ 新增父菜单</button>
        </div>
      </div>

      <div className="table-container">
        {loading ? <div className="loading">加载中...</div> : (
          <table className="data-table tree-table">
            <thead>
              <tr>
                <th>菜单名称</th><th>路由路径</th><th>组件路径</th><th>权限标识</th><th>排序</th><th>状态</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              {menus.length === 0 ? <tr><td colSpan={7} className="empty-cell">暂无数据</td></tr> : renderRows(menus)}
            </tbody>
          </table>
        )}
      </div>

      {formVisible && (
        <div className="modal-overlay" onClick={() => setFormVisible(false)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>{form.id ? '编辑菜单' : (parentMenu ? `新增 ${parentMenu.meta?.title || parentMenu.name} 的子菜单` : '新增父菜单')}</h4>
              <button className="close-btn" onClick={() => setFormVisible(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              {!parentMenu && !form.id && (
                <div className="form-item">
                  <label>父级菜单</label>
                  <select value={form.parent_id || ''} onChange={e => setForm(p => ({ ...p, parent_id: e.target.value || undefined }))}>
                    <option value="">无（顶级菜单）</option>
                    {flatMenus.map(m => <option key={m.id} value={m.id}>{'　'.repeat(m.level)}{m.title}</option>)}
                  </select>
                </div>
              )}
              <div className="form-row">
                <div className="form-item">
                  <label>菜单名称 <span className="required">*</span></label>
                  <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                </div>
                <div className="form-item">
                  <label>路由路径 <span className="required">*</span></label>
                  <div className="input-with-prefix">
                    {parentMenu && <span className="input-prefix">/{parentPath}/</span>}
                    <input 
                      type="text" 
                      value={form.path} 
                      onChange={e => handlePathChange(e.target.value)} 
                      disabled={isEditing}
                      className={isEditing ? 'disabled' : ''}
                      required 
                    />
                  </div>
                </div>
              </div>
              <div className="form-item">
                <label>组件路径</label>
                <div className="input-with-btn">
                  <div className="input-with-prefix full-width">
                    {recommendPath && <span className="input-prefix">{recommendPath.replace(/\/index$/, '/')}</span>}
                    <input 
                      type="text" 
                      value={form.component.replace(recommendPath.replace(/\/index$/, '/'), '')} 
                      onChange={e => setForm(p => ({ ...p, component: recommendPath ? `${recommendPath.replace(/\/index$/, '/')}${e.target.value}` : e.target.value }))} 
                      placeholder="index" 
                    />
                  </div>
                  <button type="button" className="btn btn-default" onClick={() => setForm(p => ({ ...p, component: recommendPath }))}>使用建议</button>
                </div>
              </div>
              <div className="form-row">
                <div className="form-item">
                  <label>权限标识</label>
                  <input 
                    type="text" 
                    value={form.permission} 
                    disabled 
                    className="disabled"
                    placeholder="根据路径自动生成" 
                  />
                </div>
                <div className="form-item">
                  <label>图标</label>
                  <IconSelect value={form.icon} onChange={v => setForm(p => ({ ...p, icon: v }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-item">
                  <label>排序</label>
                  <input type="number" value={form.sort} onChange={e => setForm(p => ({ ...p, sort: Number(e.target.value) }))} min={0} max={999} />
                </div>
                <div className="form-item switch-group">
                  <label className="switch-label">
                    <input type="checkbox" checked={form.is_visible} onChange={e => setForm(p => ({ ...p, is_visible: e.target.checked }))} />
                    <span>显示菜单</span>
                  </label>
                  <label className="switch-label">
                    <input type="checkbox" checked={form.is_enabled} onChange={e => setForm(p => ({ ...p, is_enabled: e.target.checked }))} />
                    <span>启用菜单</span>
                  </label>
                </div>
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

export default MenuManagement;
