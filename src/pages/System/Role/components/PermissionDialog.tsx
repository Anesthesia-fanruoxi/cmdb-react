/**
 * 权限设置对话框
 */

import { useState, useEffect, useCallback } from 'react';
import { getMenuTree } from '../../../../services/system/menu';
import { updateRoleMenus, type RolePermissions } from '../../../../services/system/role';
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
  visible: boolean;
  roleId: number | null;
  rolePerms: RolePermissions;
  onClose: () => void;
  onSuccess: () => void;
}

const PERM_OPTIONS = [
  { label: '查看', value: 'view' },
  { label: '读取', value: 'read' },
  { label: '操作', value: 'write' }
];

const PermissionDialog = ({ visible, roleId, rolePerms, onClose }: Props) => {
  const [menuList, setMenuList] = useState<MenuWithPerms[]>([]);
  const [cascade, setCascade] = useState(true);
  const [loading, setLoading] = useState(false);

  // 处理菜单列表，添加权限选中状态
  const processMenuList = useCallback((list: MenuItem[]): MenuWithPerms[] => {
    return list.map(item => {
      const menuId = item.id ? parseInt(item.id) : 0;
      const checkedPerms: string[] = [];
      const menuPerms = rolePerms[menuId] || [0, 0, 0];
      if (menuPerms[0] === 1) checkedPerms.push('view');
      if (menuPerms[1] === 1) checkedPerms.push('read');
      if (menuPerms[2] === 1) checkedPerms.push('write');

      return {
        id: item.id || '0',
        name: item.name,
        checkedPerms,
        children: item.children?.length ? processMenuList(item.children) : undefined
      };
    });
  }, [rolePerms]);

  // 获取菜单树
  useEffect(() => {
    if (!visible) return;
    const fetchMenuList = async () => {
      try {
        const res = await getMenuTree();
        if (res.code === 200) {
          setMenuList(processMenuList(res.data || []));
        }
      } catch (error) {
        console.error('获取菜单列表失败:', error);
      }
    };
    fetchMenuList();
  }, [visible, processMenuList]);

  // 递归更新子菜单权限
  const setChildrenPerms = (children: MenuWithPerms[], perms: string[]): MenuWithPerms[] => {
    return children.map(child => ({
      ...child,
      checkedPerms: [...perms],
      children: child.children ? setChildrenPerms(child.children, perms) : undefined
    }));
  };

  // 处理权限变化
  const handlePermChange = (menuId: string, perm: string, checked: boolean) => {
    const updateMenuTree = (items: MenuWithPerms[]): MenuWithPerms[] => {
      return items.map(item => {
        if (item.id === menuId) {
          // 更新当前菜单的权限
          const newPerms = checked
            ? [...new Set([...item.checkedPerms, perm])]
            : item.checkedPerms.filter(p => p !== perm);
          
          // 如果开启级联，同步更新所有子菜单
          const newChildren = cascade && item.children 
            ? setChildrenPerms(item.children, newPerms) 
            : item.children;
          
          return { ...item, checkedPerms: newPerms, children: newChildren };
        }
        
        // 递归处理子菜单
        if (item.children) {
          return { ...item, children: updateMenuTree(item.children) };
        }
        return item;
      });
    };
    
    setMenuList(updateMenuTree(menuList));
  };

  // 收集所有权限
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

  // 提交
  const handleSubmit = async () => {
    if (!roleId) return;
    setLoading(true);
    try {
      const permissions = collectPerms(menuList);
      // 先关闭弹窗，再异步提交
      onClose();
      await updateRoleMenus({ role_id: roleId, permissions });
    } catch (error) {
      console.error('更新权限失败:', error);
      toast.error('更新权限失败');
    } finally {
      setLoading(false);
    }
  };

  // 渲染菜单行
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
                <input
                  type="checkbox"
                  checked={item.checkedPerms.includes(opt.value)}
                  onChange={(e) => handlePermChange(item.id, opt.value, e.target.checked)}
                />
                {opt.label}
              </label>
            ))}
          </td>
        </tr>
      );
      if (item.children) {
        rows.push(...renderMenuRows(item.children, level + 1));
      }
    });
    return rows;
  };

  if (!visible) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="permission-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4>权限设置</h4>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="dialog-toolbar">
          <label className="cascade-switch">
            <input type="checkbox" checked={cascade} onChange={(e) => setCascade(e.target.checked)} />
            级联选择
          </label>
        </div>
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
        <div className="dialog-footer">
          <button className="btn btn-default" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? '保存中...' : '确定'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionDialog;
