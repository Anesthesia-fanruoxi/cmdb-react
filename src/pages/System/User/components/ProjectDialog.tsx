/**
 * 用户项目权限配置对话框
 */

import { useState, useEffect, useCallback } from 'react';
import { getProjectList, type Project } from '../../../../services/system/project';
import { getMenuTree } from '../../../../services/system/menu';
import { getUserProjectDetail, updateUserProject } from '../../../../services/system/user';
import type { User } from '../../../../services/system/user';
import type { MenuItem } from '../../../../types/menu';
import './ProjectDialog.css';

interface Props {
  visible: boolean;
  user: User | null;
  onClose: () => void;
}

const ProjectDialog = ({ visible, user, onClose }: Props) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [deptProjects, setDeptProjects] = useState<Project[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [menuTree, setMenuTree] = useState<MenuItem[]>([]);
  const [projectMenusMap, setProjectMenusMap] = useState<Record<string, number[]>>({});
  const [showAddPopover, setShowAddPopover] = useState(false);
  const [searchKey, setSearchKey] = useState('');
  const [menuSearchKey, setMenuSearchKey] = useState('');

  // 加载数据
  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [projectRes, menuRes, userProjectRes] = await Promise.all([
        getProjectList(),
        getMenuTree(),
        getUserProjectDetail(user.id)
      ]);

      let projects: Project[] = [];
      if (projectRes.code === 200) {
        const data = projectRes.data as unknown;
        projects = Array.isArray(data) ? data : (data as { items?: Project[] })?.items || [];
        setAllProjects(projects);
      }

      if (menuRes.code === 200) setMenuTree(menuRes.data || []);

      if (userProjectRes.code === 200 && userProjectRes.data) {
        const data = userProjectRes.data;
        const deptCodes = data.dept_projects || [];
        setDeptProjects(projects.filter(p => deptCodes.includes(p.project)));

        const menuMap: Record<string, number[]> = {};
        const configuredCodes: string[] = [];
        (data.project_menus || []).forEach(pm => {
          menuMap[pm.project] = pm.menu_ids || [];
          configuredCodes.push(pm.project);
        });
        setProjectMenusMap(menuMap);

        const directCodes = [...new Set([...(data.direct_projects || []), ...configuredCodes])];
        setSelectedProjects(projects.filter(p => directCodes.includes(p.project)));
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (visible) loadData();
    else {
      setAllProjects([]); setDeptProjects([]); setSelectedProjects([]);
      setCurrentProject(null); setMenuTree([]); setProjectMenusMap({});
      setShowAddPopover(false); setSearchKey(''); setMenuSearchKey('');
    }
  }, [visible, loadData]);

  const availableProjects = allProjects.filter(p => 
    !selectedProjects.find(sp => sp.project === p.project) &&
    (!searchKey || p.project_name.includes(searchKey) || p.project.includes(searchKey))
  );

  const addProject = (project: Project) => {
    setSelectedProjects(prev => [...prev, project]);
    setShowAddPopover(false);
    setSearchKey('');
  };

  const removeProject = (projectCode: string) => {
    setSelectedProjects(prev => prev.filter(p => p.project !== projectCode));
    setProjectMenusMap(prev => { const next = { ...prev }; delete next[projectCode]; return next; });
    if (currentProject?.project === projectCode) setCurrentProject(null);
  };

  // 获取所有菜单ID
  const getAllMenuIds = (nodes: MenuItem[]): number[] => {
    const ids: number[] = [];
    const traverse = (list: MenuItem[]) => {
      list.forEach(node => {
        if (node.id) ids.push(parseInt(node.id));
        if (node.children?.length) traverse(node.children);
      });
    };
    traverse(nodes);
    return ids;
  };

  // 获取父菜单ID链
  const getParentIds = (menuId: number, nodes: MenuItem[], parents: number[] = []): number[] => {
    for (const node of nodes) {
      const nodeId = node.id ? parseInt(node.id) : 0;
      if (nodeId === menuId) return parents;
      if (node.children?.length) {
        const result = getParentIds(menuId, node.children, [...parents, nodeId]);
        if (result.length > 0 || node.children.some(c => c.id && parseInt(c.id) === menuId)) {
          return result.length > 0 ? result : [...parents, nodeId].slice(0, -1);
        }
      }
    }
    return [];
  };

  // 查找菜单的所有父级ID
  const findParentIds = (menuId: number, nodes: MenuItem[], path: number[] = []): number[] | null => {
    for (const node of nodes) {
      const nodeId = node.id ? parseInt(node.id) : 0;
      if (nodeId === menuId) return path;
      if (node.children?.length) {
        const result = findParentIds(menuId, node.children, [...path, nodeId]);
        if (result) return result;
      }
    }
    return null;
  };

  // 获取菜单的所有子菜单ID
  const getChildIds = (menuId: number, nodes: MenuItem[]): number[] => {
    const ids: number[] = [];
    const findNode = (items: MenuItem[]): boolean => {
      for (const item of items) {
        const nodeId = item.id ? parseInt(item.id) : 0;
        if (nodeId === menuId) {
          const collectDescendants = (list: MenuItem[]) => {
            for (const n of list) {
              if (n.id) ids.push(parseInt(n.id));
              if (n.children?.length) collectDescendants(n.children);
            }
          };
          if (item.children?.length) collectDescendants(item.children);
          return true;
        }
        if (item.children?.length && findNode(item.children)) return true;
      }
      return false;
    };
    findNode(nodes);
    return ids;
  };

  // 检查父菜单是否还有子菜单被选中
  const hasSelectedChild = (parentId: number, selectedIds: Set<number>, nodes: MenuItem[]): boolean => {
    const childIds = getChildIds(parentId, nodes);
    return childIds.some(id => selectedIds.has(id));
  };

  // 切换菜单选中（自动关联父菜单和子菜单）
  const toggleMenu = (menuId: number, checked: boolean) => {
    if (!currentProject) return;
    setProjectMenusMap(prev => {
      const current = new Set(prev[currentProject.project] || []);
      if (checked) {
        current.add(menuId);
        getChildIds(menuId, menuTree).forEach(id => current.add(id));
        findParentIds(menuId, menuTree, [])?.forEach(id => current.add(id));
      } else {
        current.delete(menuId);
        getChildIds(menuId, menuTree).forEach(id => current.delete(id));
        const parentIds = findParentIds(menuId, menuTree, []) || [];
        for (const parentId of [...parentIds].reverse()) {
          if (!hasSelectedChild(parentId, current, menuTree)) {
            current.delete(parentId);
          }
        }
      }
      return { ...prev, [currentProject.project]: Array.from(current) };
    });
  };

  const checkAll = () => {
    if (!currentProject) return;
    setProjectMenusMap(prev => ({ ...prev, [currentProject.project]: getAllMenuIds(menuTree) }));
  };

  const uncheckAll = () => {
    if (!currentProject) return;
    setProjectMenusMap(prev => ({ ...prev, [currentProject.project]: [] }));
  };

  // 过滤菜单（搜索）
  const filterMenuTree = (nodes: MenuItem[], keyword: string): MenuItem[] => {
    if (!keyword) return nodes;
    return nodes.map(node => {
      const match = node.name.includes(keyword);
      const filteredChildren = node.children ? filterMenuTree(node.children, keyword) : [];
      if (match || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren.length > 0 ? filteredChildren : node.children };
      }
      return null;
    }).filter(Boolean) as MenuItem[];
  };

  // 渲染菜单树
  const renderMenuTree = (items: MenuItem[], level = 0): React.ReactNode => {
    const currentMenus = currentProject ? (projectMenusMap[currentProject.project] || []) : [];
    return items.map(item => {
      const menuId = item.id ? parseInt(item.id) : 0;
      const checked = currentMenus.includes(menuId);
      const menuName = item.meta?.title || item.name;
      return (
        <div key={item.id}>
          <label className="perm-menu-item" style={{ paddingLeft: 24 + level * 20 }}>
            <input type="checkbox" checked={checked} onChange={e => toggleMenu(menuId, e.target.checked)} />
            <span className="checkmark" />
            <span className="menu-label">{menuName}</span>
          </label>
          {item.children && item.children.length > 0 && renderMenuTree(item.children, level + 1)}
        </div>
      );
    });
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    setSubmitting(true);
    try {
      const projectMenus = selectedProjects.map(p => ({
        project: p.project,
        menu_ids: projectMenusMap[p.project] || []
      }));
      await updateUserProject({ user_id: user.id, project_menus: projectMenus });
      onClose();
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  const configuredCount = Object.keys(projectMenusMap).filter(k => projectMenusMap[k]?.length > 0).length;
  const filteredMenuTree = filterMenuTree(menuTree, menuSearchKey);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="project-dialog-large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h4>用户项目权限配置</h4>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div className="dialog-loading">加载中...</div>
        ) : (
          <div className="project-content">
            <div className="user-info-bar">
              <span>用户：<b>{user?.user_name}</b></span>
              {user?.nick_name && <span>昵称：<b>{user.nick_name}</b></span>}
              <span>部门：<b>{user?.dept_name || '未分配'}</b></span>
            </div>

            {deptProjects.length > 0 && (
              <div className="dept-projects">
                <span className="section-label">🏢 部门关联项目（自动继承）</span>
                <div className="dept-tags">
                  {deptProjects.map(p => <span key={p.project} className="tag">{p.project_name}</span>)}
                </div>
              </div>
            )}

            <div className="config-container">
              <div className="project-panel">
                <div className="panel-header">
                  <span>直接关联项目</span>
                  <div className="add-project-wrapper">
                    <button className="btn btn-sm btn-primary" onClick={() => setShowAddPopover(!showAddPopover)}>+ 添加</button>
                    {showAddPopover && (
                      <div className="add-popover">
                        <input type="text" placeholder="搜索项目" value={searchKey} onChange={e => setSearchKey(e.target.value)} />
                        <div className="add-list">
                          {availableProjects.length === 0 ? (
                            <div className="empty-tip">暂无可添加项目</div>
                          ) : availableProjects.map(p => (
                            <div key={p.project} className="add-item" onClick={() => addProject(p)}>
                              <span className="name">{p.project_name}</span>
                              <span className="code">{p.project}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="project-list">
                  {selectedProjects.length === 0 ? (
                    <div className="empty-tip">点击上方按钮添加项目</div>
                  ) : selectedProjects.map(p => (
                    <div key={p.project} className={`project-item ${currentProject?.project === p.project ? 'active' : ''}`} onClick={() => setCurrentProject(p)}>
                      <div className="project-info">
                        <span className="project-name">{p.project_name}</span>
                        <span className="project-code">{p.project}</span>
                      </div>
                      <div className="project-actions">
                        {(projectMenusMap[p.project]?.length || 0) > 0 && <span className="check-icon">✓</span>}
                        <span className="delete-icon" onClick={e => { e.stopPropagation(); removeProject(p.project); }}>×</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="panel-footer">已配置 {configuredCount} / {selectedProjects.length} 个项目</div>
              </div>

              <div className="menu-panel">
                <div className="panel-header">
                  <span>菜单权限 {currentProject && `- ${currentProject.project_name}`}</span>
                  {currentProject && (
                    <div className="menu-actions">
                      <button className="btn btn-sm" onClick={checkAll}>全选</button>
                      <button className="btn btn-sm" onClick={uncheckAll}>清空</button>
                    </div>
                  )}
                </div>
                {currentProject && (
                  <div className="menu-search">
                    <input type="text" placeholder="搜索菜单..." value={menuSearchKey} onChange={e => setMenuSearchKey(e.target.value)} />
                  </div>
                )}
                <div className="menu-tree">
                  {currentProject ? (
                    filteredMenuTree.length > 0 ? renderMenuTree(filteredMenuTree) : <div className="empty-tip">未找到匹配菜单</div>
                  ) : (
                    <div className="menu-placeholder">📋 请先从左侧选择项目</div>
                  )}
                </div>
                {currentProject && (
                  <div className="panel-footer">已选择 {projectMenusMap[currentProject.project]?.length || 0} 个菜单</div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="dialog-footer">
          <button className="btn btn-default" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '保存中...' : '保存全部配置'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectDialog;