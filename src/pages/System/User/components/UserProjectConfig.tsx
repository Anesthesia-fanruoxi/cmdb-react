/**
 * 用户项目权限配置组件（独立窗口版）
 */

import { useState, useEffect, useCallback } from 'react';
import { getProjectList, type Project } from '../../../../services/system/project';
import { getMenuTree } from '../../../../services/system/menu';
import { getUserProjectDetail, updateUserProject } from '../../../../services/system/user';
import { closeCurrentWindow } from '../../../../utils/window';
import type { MenuItem } from '../../../../types/menu';
import './ProjectDialog.css';

interface Props {
  userId: string | number;
  userName: string;
  nickName?: string;
  deptName?: string;
}

const UserProjectConfig = ({ userId, userName, nickName, deptName }: Props) => {
  const [loading, setLoading] = useState(true);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [deptProjects, setDeptProjects] = useState<Project[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [menuTree, setMenuTree] = useState<MenuItem[]>([]);
  const [projectMenusMap, setProjectMenusMap] = useState<Record<string, number[]>>({});
  const [showAddPopover, setShowAddPopover] = useState(false);
  const [searchKey, setSearchKey] = useState('');
  const [menuSearchKey, setMenuSearchKey] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectRes, menuRes, userProjectRes] = await Promise.all([
        getProjectList(), getMenuTree(), getUserProjectDetail(userId)
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
        setDeptProjects(projects.filter(p => (data.dept_projects || []).includes(p.project)));

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
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

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

  const getChildIds = (menuId: number, nodes: MenuItem[]): number[] => {
    const ids: number[] = [];
    const findAndCollect = (items: MenuItem[], found: boolean): boolean => {
      for (const item of items) {
        const nodeId = item.id ? parseInt(item.id) : 0;
        if (found || nodeId === menuId) {
          if (nodeId !== menuId) ids.push(nodeId);
          if (item.children?.length) findAndCollect(item.children, true);
          if (nodeId === menuId) return true;
        }
        if (item.children?.length && findAndCollect(item.children, false)) return true;
      }
      return false;
    };
    findAndCollect(nodes, false);
    return ids;
  };

  const hasSelectedChild = (parentId: number, selectedIds: Set<number>, nodes: MenuItem[]): boolean => {
    return getChildIds(parentId, nodes).some(id => selectedIds.has(id));
  };

  const toggleMenu = (menuId: number, checked: boolean) => {
    if (!currentProject) return;
    setProjectMenusMap(prev => {
      const current = new Set(prev[currentProject.project] || []);
      if (checked) {
        current.add(menuId);
        findParentIds(menuId, menuTree, [])?.forEach(id => current.add(id));
      } else {
        current.delete(menuId);
        const parentIds = findParentIds(menuId, menuTree, []) || [];
        for (const parentId of [...parentIds].reverse()) {
          if (!hasSelectedChild(parentId, current, menuTree)) current.delete(parentId);
        }
      }
      return { ...prev, [currentProject.project]: Array.from(current) };
    });
  };

  const checkAll = () => currentProject && setProjectMenusMap(prev => ({ ...prev, [currentProject.project]: getAllMenuIds(menuTree) }));
  const uncheckAll = () => currentProject && setProjectMenusMap(prev => ({ ...prev, [currentProject.project]: [] }));

  const filterMenuTree = (nodes: MenuItem[], keyword: string): MenuItem[] => {
    if (!keyword) return nodes;
    return nodes.map(node => {
      const match = node.name.includes(keyword);
      const filteredChildren = node.children ? filterMenuTree(node.children, keyword) : [];
      if (match || filteredChildren.length > 0) return { ...node, children: filteredChildren.length > 0 ? filteredChildren : node.children };
      return null;
    }).filter(Boolean) as MenuItem[];
  };

  const renderMenuTree = (items: MenuItem[], level = 0): React.ReactNode => {
    const currentMenus = currentProject ? (projectMenusMap[currentProject.project] || []) : [];
    return items.map(item => {
      const menuId = item.id ? parseInt(item.id) : 0;
      return (
        <div key={item.id}>
          <label className="perm-menu-item" style={{ paddingLeft: 12 + level * 20 }}>
            <input type="checkbox" checked={currentMenus.includes(menuId)} onChange={e => toggleMenu(menuId, e.target.checked)} />
            <span>{item.meta?.title || item.name}</span>
          </label>
          {item.children?.length ? renderMenuTree(item.children, level + 1) : null}
        </div>
      );
    });
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const projectMenus = selectedProjects.map(p => ({ project: p.project, menu_ids: projectMenusMap[p.project] || [] }));
      const res = await updateUserProject({ user_id: userId, project_menus: projectMenus });
      if (res.code === 200) {
        closeCurrentWindow();
      }
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const configuredCount = Object.keys(projectMenusMap).filter(k => projectMenusMap[k]?.length > 0).length;
  const filteredMenuTree = filterMenuTree(menuTree, menuSearchKey);

  return (
    <div className="user-project-config">
      <div className="config-header">
        <h4>用户项目权限配置</h4>
      </div>
      {loading ? <div className="dialog-loading">加载中...</div> : (
        <div className="project-content">
          <div className="user-info-bar">
            <span>用户：<b>{userName}</b></span>
            {nickName && <span>昵称：<b>{nickName}</b></span>}
            <span>部门：<b>{deptName || '未分配'}</b></span>
          </div>
          {deptProjects.length > 0 && (
            <div className="dept-projects">
              <span className="section-label">🏢 部门关联项目（自动继承）</span>
              <div className="dept-tags">{deptProjects.map(p => <span key={p.project} className="tag">{p.project_name}</span>)}</div>
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
                        {availableProjects.length === 0 ? <div className="empty-tip">暂无可添加项目</div> : availableProjects.map(p => (
                          <div key={p.project} className="add-item" onClick={() => addProject(p)}>
                            <span className="name">{p.project_name}</span><span className="code">{p.project}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="project-list">
                {selectedProjects.length === 0 ? <div className="empty-tip">点击上方按钮添加项目</div> : selectedProjects.map(p => (
                  <div key={p.project} className={`project-item ${currentProject?.project === p.project ? 'active' : ''}`} onClick={() => setCurrentProject(p)}>
                    <div className="project-info"><span className="project-name">{p.project_name}</span><span className="project-code">{p.project}</span></div>
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
                {currentProject && <div className="menu-actions"><button className="btn btn-sm" onClick={checkAll}>全选</button><button className="btn btn-sm" onClick={uncheckAll}>清空</button></div>}
              </div>
              {currentProject && <div className="menu-search"><input type="text" placeholder="搜索菜单..." value={menuSearchKey} onChange={e => setMenuSearchKey(e.target.value)} /></div>}
              <div className="menu-tree">
                {currentProject ? (filteredMenuTree.length > 0 ? renderMenuTree(filteredMenuTree) : <div className="empty-tip">未找到匹配菜单</div>) : <div className="menu-placeholder">📋 请先从左侧选择项目</div>}
              </div>
              {currentProject && <div className="panel-footer">已选择 {projectMenusMap[currentProject.project]?.length || 0} 个菜单</div>}
            </div>
          </div>
        </div>
      )}
      <div className="dialog-footer">
        <button className="btn btn-default" onClick={closeCurrentWindow}>取消</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? '保存中...' : '保存全部配置'}
        </button>
      </div>
    </div>
  );
};

export default UserProjectConfig;
