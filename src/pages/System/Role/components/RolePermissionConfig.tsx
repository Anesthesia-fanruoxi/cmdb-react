/**
 * 角色权限配置组件（独立窗口版）
 */

import { useState, useEffect, useCallback } from 'react';
import { getMenuTree } from '../../../../services/system/menu';
import { getRoleMenus, updateRoleMenus, type RolePermissions } from '../../../../services/system/role';
import { closeCurrentWindow } from '../../../../utils/window';
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

const RolePermissionConfig = ({ roleId, roleName }: Props) => {
  const [loading, setLoading] = useState(true);
  const [menuList, setMenuList] = useState<MenuWithPerms[]>([]);
  const [cascade, setCascade] = useState(true);

  const processMenuList = useCallback((list: MenuItem[], perms: RolePermissions): MenuWithPerms[] => {
    return list.map(item => {
      const menuId = item.id ? parseInt(item.id) : 0;
      const checkedPerms: string[] = [];
      const menuPerms = perms[menuId] || [0, 0, 0];
      if (menuPerms[0] === 1) checkedPerms.push('view');
      if (menuPerms[1] === 1) checkedPerms.push('read');
      if (menuPerms[2] === 1) checkedPerms.push('write');
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
        const [menuRes, permsRes] = await Promise.all([
          getMenuTree(),
          getRoleMenus(roleId)
        ]);
        if (menuRes.code === 200 && permsRes.code === 200) {
          setMenuList(processMenuList(menuRes.data || [], permsRes.data || {}));
        }
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [roleId, processMenuList]);

  const setChildrenPerms = (children: MenuWithPerms[], perms: string[]): MenuWithPerms[] => {
    return children.map(child => ({
      ...child,
      checkedPerms: [...perms],
      children: child.children ? setChildrenPerms(child.children, perms) : undefined
    }));
  };

  const handlePermChange = (menuId: string, perm: string, checked: boolean) => {
    const updateMenuTree = (items: MenuWithPerms[]): MenuWithPerms[] => {
      return items.map(item => {
        if (item.id === menuId) {
          const newPerms = checked
            ? [...new Set([...item.checkedPerms, perm])]
            : item.checkedPerms.filter(p => p !== perm);
          const newChildren = cascade && item.children ? setChildrenPerms(item.children, newPerms) : item.children;
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
    try {
      const permissions = collectPerms(menuList);
      await updateRoleMenus({ role_id: roleId, permissions });
      closeCurrentWindow();
    } catch (error) {
      console.error('更新权限失败:', error);
      alert('更新权限失败');
    }
  };

  const renderMenuRows = (items: MenuWithPerms[], level = 0): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    items.forEach(item => {
      rows.push(
        <tr key={item.id}>
          <td style={{ paddingLeft: 16 + level * 24 }}>
            {item.children && <span className="tree-icon">▸</span>}
            {item.name}
          </td>
          <td className="perm-cell">
            {PERM_OPTIONS.map(opt => (
              <label key={opt.value} className="perm-checkbox">
                <input type="checkbox" checked={item.checkedPerms.includes(opt.value)} onChange={e => handlePermChange(item.id, opt.value, e.target.checked)} />
                {opt.label}
              </label>
            ))}
          </td>
        </tr>
      );
      if (item.children) rows.push(...renderMenuRows(item.children, level + 1));
    });
    return rows;
  };

  return (
    <div className="role-permission-config">
      <div className="config-header">
        <h4>{roleName} - 权限设置</h4>
      </div>
      <div className="dialog-toolbar">
        <label className="cascade-switch">
          <input type="checkbox" checked={cascade} onChange={e => setCascade(e.target.checked)} />
          级联选择
        </label>
      </div>
      {loading ? <div className="dialog-loading">加载中...</div> : (
        <div className="dialog-body">
          <table className="perm-table">
            <thead>
              <tr>
                <th>菜单名称</th>
                <th style={{ width: 240, textAlign: 'center' }}>权限</th>
              </tr>
            </thead>
            <tbody>{renderMenuRows(menuList)}</tbody>
          </table>
        </div>
      )}
      <div className="dialog-footer">
        <button className="btn btn-default" onClick={closeCurrentWindow}>取消</button>
        <button className="btn btn-primary" onClick={handleSubmit}>确定</button>
      </div>
    </div>
  );
};

export default RolePermissionConfig;
