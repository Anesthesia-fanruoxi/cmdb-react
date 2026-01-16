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
  roleName?: string;
  rolePerms: RolePermissions;
  onClose: () => void;
  onSuccess: () => void;
}

const PERM_OPTIONS = [
  { label: '查看', value: 'view' },
  { label: '读取', value: 'read' },
  { label: '操作', value: 'write' }
];

// 必选权限的菜单名称
const REQUIRED_MENUS = ['系统设置', '字典管理', '菜单管理', '部门管理'];

const PermissionDialog = ({ visible, roleId, roleName, rolePerms, onClose }: Props) => {
  const [menuList, setMenuList] = useState<MenuWithPerms[]>([]);
  const [cascade, setCascade] = useState(true);
  const [loading, setLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // 检查菜单是否为必选
  const isRequiredMenu = (name: string) => REQUIRED_MENUS.includes(name);

  // 处理菜单列表，添加权限选中状态
  const processMenuList = useCallback((list: MenuItem[]): MenuWithPerms[] => {
    return list.map(item => {
      const menuId = item.id ? parseInt(item.id) : 0;
      const checkedPerms: string[] = [];
      const menuPerms = rolePerms[menuId] || [0, 0, 0];
      
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
          const processed = processMenuList(res.data || []);
          setMenuList(processed);
          // 默认展开所有有子菜单的项
          const ids = new Set<string>();
          const collectIds = (items: MenuWithPerms[]) => {
            items.forEach(item => {
              if (item.children?.length) {
                ids.add(item.id);
                collectIds(item.children);
              }
            });
          };
          collectIds(processed);
          setExpandedIds(ids);
        }
      } catch {
        // 静默处理
      }
    };
    fetchMenuList();
  }, [visible, processMenuList]);

  // 切换展开/折叠
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 递归更新子菜单权限
  const setChildrenPerms = (children: MenuWithPerms[], perms: string[]): MenuWithPerms[] => {
    return children.map(child => {
      // 必选菜单保持读取权限
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

  // 处理权限变化
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
      onClose();
      await updateRoleMenus({ role_id: roleId, permissions });
      toast.success('权限保存成功');
    } catch {
      toast.error('更新权限失败');
    } finally {
      setLoading(false);
    }
  };

  // 渲染菜单行
  const renderMenuRows = (items: MenuWithPerms[], level = 0): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    items.forEach(item => {
      const hasChildren = item.children && item.children.length > 0;
      const isExpanded = expandedIds.has(item.id);
      const isRequired = isRequiredMenu(item.name);

      rows.push(
        <tr key={item.id} className={isRequired ? 'required-row' : ''}>
          <td style={{ paddingLeft: 16 + level * 24 }}>
            {hasChildren ? (
              <span className="tree-toggle" onClick={() => toggleExpand(item.id)}>
                {isExpanded ? '▾' : '▸'}
              </span>
            ) : (
              <span className="tree-toggle-placeholder" />
            )}
            <span className="menu-name">
              {item.name}
              {isRequired && <span className="required-tag">必选</span>}
            </span>
          </td>
          {PERM_OPTIONS.map(opt => {
            const isChecked = item.checkedPerms.includes(opt.value);
            const isDisabled = isRequired && opt.value === 'read';
            return (
              <td key={opt.value} className="perm-cell">
                <label className={`checkbox-wrapper ${isDisabled ? 'disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isDisabled}
                    onChange={(e) => handlePermChange(item.id, opt.value, e.target.checked, item.name)}
                  />
                  <span className={`checkbox-custom ${isChecked ? 'checked' : ''}`}>
                    {isChecked && '✓'}
                  </span>
                </label>
              </td>
            );
          })}
        </tr>
      );
      if (hasChildren && isExpanded) {
        rows.push(...renderMenuRows(item.children!, level + 1));
      }
    });
    return rows;
  };

  if (!visible) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="permission-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4>{roleName || '角色'} - 权限设置</h4>
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
                {PERM_OPTIONS.map(opt => (
                  <th key={opt.value} className="perm-header">{opt.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>{renderMenuRows(menuList)}</tbody>
          </table>
        </div>
        <div className="dialog-footer">
          <button className="btn btn-default" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? '保存中...' : '保存权限'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionDialog;
