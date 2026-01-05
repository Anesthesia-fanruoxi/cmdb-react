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

const RolePermissionConfig = ({ roleId, roleName }: Props) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [menuList, setMenuList] = useState<MenuWithPerms[]>([]);
  const [cascade, setCascade] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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
      } catch (error) {
        console.error('加载数据失败:', error);
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
    return children.map(child => ({
      ...child, checkedPerms: [...perms],
      children: child.children ? setChildrenPerms(child.children, perms) : undefined
    }));
  };

  // 检查子项是否全选某个权限
  const checkAllChildren = (children: MenuWithPerms[], perm: string): boolean => {
    return children.every(child => {
      const hasPerm = child.checkedPerms.includes(perm);
      if (child.children) return hasPerm && checkAllChildren(child.children, perm);
      return hasPerm;
    });
  };

  // 检查子项是否有任意一个选中某权限
  const checkSomeChildren = (children: MenuWithPerms[], perm: string): boolean => {
    return children.some(child => {
      const hasPerm = child.checkedPerms.includes(perm);
      if (child.children) return hasPerm || checkSomeChildren(child.children, perm);
      return hasPerm;
    });
  };

  // 子项权限变化
  const handlePermChange = (menuId: string, perm: string, checked: boolean) => {
    const updateMenuTree = (items: MenuWithPerms[]): MenuWithPerms[] => {
      return items.map(item => {
        if (item.id === menuId) {
          const newPerms = checked
            ? [...new Set([...item.checkedPerms, perm])]
            : item.checkedPerms.filter(p => p !== perm);
          return { ...item, checkedPerms: newPerms };
        }
        if (item.children) return { ...item, children: updateMenuTree(item.children) };
        return item;
      });
    };
    setMenuList(updateMenuTree(menuList));
  };

  // 父级全选/取消全选（仅级联模式）
  const handleParentPermChange = (menuId: string, perm: string, checked: boolean, children: MenuWithPerms[]) => {
    const updateMenuTree = (items: MenuWithPerms[]): MenuWithPerms[] => {
      return items.map(item => {
        if (item.id === menuId) {
          const newChildren = setChildrenPerms(children, checked ? [perm] : []);
          return { ...item, children: newChildren };
        }
        if (item.children) return { ...item, children: updateMenuTree(item.children) };
        return item;
      });
    };
    setMenuList(updateMenuTree(menuList));
  };

  // 收集权限时，父目录自动继承子目录的查看权限
  const collectPerms = (list: MenuWithPerms[]): RolePermissions => {
    const permissions: RolePermissions = {};
    
    const collect = (items: MenuWithPerms[]): void => {
      items.forEach(item => {
        const menuId = parseInt(item.id);
        
        if (item.children) {
          // 先处理子项
          collect(item.children);
          // 父目录：如果任意子项有查看权限，父目录自动有查看权限
          const hasChildView = checkSomeChildren(item.children, 'view');
          permissions[menuId] = [
            hasChildView ? 1 : 0,
            item.checkedPerms.includes('read') ? 1 : 0,
            item.checkedPerms.includes('write') ? 1 : 0
          ];
        } else {
          // 叶子节点
          permissions[menuId] = [
            item.checkedPerms.includes('view') ? 1 : 0,
            item.checkedPerms.includes('read') ? 1 : 0,
            item.checkedPerms.includes('write') ? 1 : 0
          ];
        }
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
    } catch (error) {
      console.error('更新权限失败:', error);
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
      
      rows.push(
        <div key={item.id} className={`perm-row ${hasChildren ? 'parent-row' : ''}`}>
          <div className="perm-menu" style={{ paddingLeft: 16 + level * 20 }}>
            {hasChildren ? (
              <span className="expand-icon" onClick={() => toggleExpand(item.id)}>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            ) : <span className="expand-placeholder" />}
            <span className="menu-name">{item.name}</span>
          </div>
          <div className="perm-actions">
            {hasChildren ? (
              // 父目录：只在级联模式显示全选框
              cascade ? (
                PERM_OPTIONS.map(opt => {
                  const allChecked = checkAllChildren(item.children!, opt.value);
                  const someChecked = checkSomeChildren(item.children!, opt.value);
                  return (
                    <label key={opt.value} className="perm-checkbox">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={el => { if (el) el.indeterminate = !allChecked && someChecked; }}
                        onChange={e => handleParentPermChange(item.id, opt.value, e.target.checked, item.children!)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  );
                })
              ) : (
                // 非级联模式：父目录不显示复选框，显示子项状态
                PERM_OPTIONS.map(opt => {
                  const someChecked = checkSomeChildren(item.children!, opt.value);
                  return (
                    <span key={opt.value} className="perm-status">
                      {someChecked ? '✓' : '-'}
                    </span>
                  );
                })
              )
            ) : (
              // 子目录：正常显示复选框
              PERM_OPTIONS.map(opt => (
                <label key={opt.value} className="perm-checkbox">
                  <input
                    type="checkbox"
                    checked={item.checkedPerms.includes(opt.value)}
                    onChange={e => handlePermChange(item.id, opt.value, e.target.checked)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))
            )}
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
