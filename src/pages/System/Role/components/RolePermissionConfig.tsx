/**
 * 角色权限配置组件（独立窗口版）
 */

import { useState, useEffect, useCallback } from 'react';
import { Shield, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { getMenuTree } from '../../../../services/system/menu';
import { getRoleMenus, updateRoleMenus, type RolePermissions } from '../../../../services/system/role';
import { closeCurrentWindow } from '../../../../utils/window';
import { toast } from '../../../../components/AppNotification';
import type { MenuItem } from '../../../../types/menu';
import './PermissionDialog.css';

interface MenuWithPerms {
  id: string;
  name: string;
  checkedPerms: string[];
  children?: MenuWithPerms[];
}

interface Props {
  roleId: number;
  roleName: string;
}

const PERM_OPTIONS = [
  { label: '查看', value: 'view' },
  { label: '读取', value: 'read' },
  { label: '操作', value: 'write' }
];

// 必选权限的菜单名称（读取权限必选）
const REQUIRED_MENUS = ['系统设置', '字典管理', '菜单管理', '部门管理'];

const RolePermissionConfig = ({ roleId, roleName }: Props) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [menuList, setMenuList] = useState<MenuWithPerms[]>([]);
  const [cascade, setCascade] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const isRequiredMenu = (name: string) => REQUIRED_MENUS.includes(name);

  const processMenuList = useCallback((list: MenuItem[], perms: RolePermissions): MenuWithPerms[] => {
    return list.map(item => {
      const menuId = item.id ? parseInt(item.id) : 0;
      const checkedPerms: string[] = [];
      const menuPerms = perms[menuId] || [0, 0, 0];
      
      // 必选菜单默认勾选读取权限
      if (isRequiredMenu(item.name)) {
        checkedPerms.push('read');
        if (menuPerms[0] === 1) checkedPerms.push('view');
        if (menuPerms[2] === 1) checkedPerms.push('write');
      } else {
        if (menuPerms[0] === 1) checkedPerms.push('view');
        if (menuPerms[1] === 1) checkedPerms.push('read');
        if (menuPerms[2] === 1) checkedPerms.push('write');
      }
      
      return {
        id: item.id || '0',
        name: item.name,
        checkedPerms,
        children: item.children?.length ? processMenuList(item.children, perms) : undefined
      };
    });
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [menuRes, permsRes] = await Promise.all([getMenuTree(), getRoleMenus(roleId)]);
        if (menuRes.code === 200 && permsRes.code === 200) {
          const processed = processMenuList(menuRes.data || [], permsRes.data || {});
          setMenuList(processed);
          const ids = new Set<string>();
          const collectIds = (items: MenuWithPerms[]) => {
            items.forEach(item => { if (item.children) { ids.add(item.id); collectIds(item.children); } });
          };
          collectIds(processed);
          setExpandedIds(ids);
        }
      } catch {
        toast.error('加载数据失败');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [roleId, processMenuList]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const setChildrenPerms = (children: MenuWithPerms[], perms: string[]): MenuWithPerms[] => {
    return children.map(child => {
      const newPerms = isRequiredMenu(child.name) 
        ? [...new Set([...perms, 'read'])]
        : [...perms];
      return {
        ...child, 
        checkedPerms: newPerms,
        children: child.children ? setChildrenPerms(child.children, perms) : undefined
      };
    });
  };

  const handlePermChange = (menuId: string, perm: string, checked: boolean, menuName: string) => {
    // 必选菜单的读取权限不能取消
    if (isRequiredMenu(menuName) && perm === 'read' && !checked) {
      toast.warning(`${menuName} 的读取权限为必选，不能取消`);
      return;
    }

    const updateMenuTree = (items: MenuWithPerms[]): MenuWithPerms[] => {
      return items.map(item => {
        if (item.id === menuId) {
          const newPerms = checked
            ? [...new Set([...item.checkedPerms, perm])]
            : item.checkedPerms.filter(p => p !== perm);
          
          const newChildren = cascade && item.children 
            ? setChildrenPerms(item.children, newPerms) 
            : item.children;
          
          return { ...item, checkedPerms: newPerms, children: newChildren };
        }
        if (item.children) return { ...item, children: updateMenuTree(item.children) };
        return item;
      });
    };
    setMenuList(updateMenuTree(menuList));
  };

  const collectPerms = (list: MenuWithPerms[]): RolePermissions => {
    const permissions: RolePermissions = {};
    const collect = (items: MenuWithPerms[]) => {
      items.forEach(item => {
        const menuId = parseInt(item.id);
        permissions[menuId] = [
          item.checkedPerms.includes('view') ? 1 : 0,
          item.checkedPerms.includes('read') ? 1 : 0,
          item.checkedPerms.includes('write') ? 1 : 0
        ];
        if (item.children) collect(item.children);
      });
    };
    collect(list);
    return permissions;
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const permissions = collectPerms(menuList);
      await updateRoleMenus({ role_id: roleId, permissions });
      toast.success('权限保存成功');
      closeCurrentWindow();
    } catch {
      toast.error('更新权限失败');
    } finally {
      setSaving(false);
    }
  };

  const renderMenuRows = (items: MenuWithPerms[], level = 0): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    items.forEach(item => {
      const isExpanded = expandedIds.has(item.id);
      const hasChildren = item.children && item.children.length > 0;
      const isRequired = isRequiredMenu(item.name);
      
      rows.push(
        <div key={item.id} className={`perm-row ${isRequired ? 'required-row' : ''}`}>
          <div className="perm-menu" style={{ paddingLeft: 16 + level * 20 }}>
            {hasChildren ? (
              <span className="expand-icon" onClick={() => toggleExpand(item.id)}>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            ) : <span className="expand-placeholder" />}
            <span className="menu-name-text">
              {item.name}
              {isRequired && <span className="required-tag">必选</span>}
            </span>
          </div>
          <div className="perm-actions">
            {PERM_OPTIONS.map(opt => {
              const isChecked = item.checkedPerms.includes(opt.value);
              const isDisabled = isRequired && opt.value === 'read';
              return (
                <label key={opt.value} className={`checkbox-item ${isDisabled ? 'disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isDisabled}
                    onChange={e => handlePermChange(item.id, opt.value, e.target.checked, item.name)}
                  />
                  <span className={`checkbox-box ${isChecked ? 'checked' : ''}`}>
                    {isChecked && '✓'}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      );
      if (hasChildren && isExpanded) {
        rows.push(...renderMenuRows(item.children!, level + 1));
      }
    });
    return rows;
  };

  return (
    <div className="role-permission-config">
      <div className="config-header">
        <div className="header-title">
          <Shield size={18} />
          <h4>{roleName} - 权限设置</h4>
        </div>
        <label className="cascade-checkbox">
          <input type="checkbox" checked={cascade} onChange={e => setCascade(e.target.checked)} />
          <span>级联选择</span>
        </label>
      </div>

      {loading ? (
        <div className="dialog-loading">
          <Loader2 size={28} className="spin" />
          <p>加载权限数据...</p>
        </div>
      ) : (
        <div className="dialog-body">
          <div className="perm-header">
            <div className="perm-menu">菜单名称</div>
            <div className="perm-actions">
              {PERM_OPTIONS.map(opt => <span key={opt.value} className="perm-label">{opt.label}</span>)}
            </div>
          </div>
          <div className="perm-list">{renderMenuRows(menuList)}</div>
        </div>
      )}

      <div className="dialog-footer">
        <button className="btn btn-default" onClick={closeCurrentWindow}>取消</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? <><Loader2 size={14} className="spin" /> 保存中...</> : '保存权限'}
        </button>
      </div>
    </div>
  );
};

export default RolePermissionConfig;
