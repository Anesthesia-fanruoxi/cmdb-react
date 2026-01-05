/**
 * 部门管理页面
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, ChevronRight, ChevronDown, Building2 } from 'lucide-react';
import { getDeptList, deleteDept, type Dept } from '../../../services/system/dept';
import { openComponentWindow } from '../../../utils/window';
import { toast } from '../../../components/AppNotification';
import { confirm } from '../../../components/ConfirmModal';
import DraggableModal from '../../../components/DraggableModal';
import DeptForm from './components/DeptForm';
import './style.css';

const DeptManagement = () => {
  const [loading, setLoading] = useState(false);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [formVisible, setFormVisible] = useState(false);
  const [editData, setEditData] = useState<Partial<Dept>>({});
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const fetchDepts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDeptList();
      if (res.code === 200) {
        setDepts(res.data || []);
        const keys = new Set<string>();
        const collectKeys = (items: Dept[]) => {
          items.forEach(item => {
            if (item.children?.length) { keys.add(item.id); collectKeys(item.children); }
          });
        };
        collectKeys(res.data || []);
        setExpandedKeys(keys);
      }
    } catch (error) {
      console.error('获取部门列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDepts(); }, [fetchDepts]);

  const toggleExpand = (id: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAdd = (parentId?: string) => { 
    setEditData(parentId ? { parent_id: parentId, sort: 0 } : { sort: 0 }); 
    setFormVisible(true); 
  };

  const handleEdit = (dept: Dept) => { setEditData(dept); setFormVisible(true); };

  const handleDelete = async (dept: Dept) => {
    if (dept.children?.length) { toast.warning('该部门下有子部门，无法删除'); return; }
    if (!await confirm({ content: `确定要删除部门 "${dept.name}" 吗？`, type: 'danger' })) return;
    try {
      const res = await deleteDept(dept.id);
      if (res.code === 200) fetchDepts();
    } catch (error) {
      console.error('删除部门失败:', error);
    }
  };

  const handleProject = (dept: Dept) => {
    openComponentWindow({
      type: 'dept-project',
      label: `dept-project-${dept.id}`,
      title: `${dept.name} - 项目配置`,
      props: { deptId: dept.id, deptName: dept.name },
      width: 560, height: 500,
    });
  };

  const renderRows = (items: Dept[], level = 0): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    items.forEach(dept => {
      const hasChildren = dept.children && dept.children.length > 0;
      const isExpanded = expandedKeys.has(dept.id);
      rows.push(
        <tr key={dept.id} className={hasChildren ? 'parent-row' : ''}>
          <td style={{ paddingLeft: 16 + level * 20 }}>
            <div className="dept-cell">
              {hasChildren ? (
                <span className="expand-icon" onClick={() => toggleExpand(dept.id)}>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
              ) : <span className="expand-placeholder" />}
              <div className="dept-icon"><Building2 size={14} /></div>
              <span className="dept-name">{dept.name}</span>
            </div>
          </td>
          <td><code className="code-tag">{dept.code || '-'}</code></td>
          <td style={{ textAlign: 'center' }}><span className="sort-badge">{dept.sort ?? 0}</span></td>
          <td className="desc-cell">{dept.description || '-'}</td>
          <td className="action-cell">
            <button className="btn-link" onClick={() => handleAdd(dept.id)}>新增</button>
            <button className="btn-link" onClick={() => handleEdit(dept)}>编辑</button>
            <button className="btn-link" onClick={() => handleProject(dept)}>项目</button>
            <button className="btn-link danger" onClick={() => handleDelete(dept)}>删除</button>
          </td>
        </tr>
      );
      if (hasChildren && isExpanded) rows.push(...renderRows(dept.children!, level + 1));
    });
    return rows;
  };

  return (
    <div className="dept-management">
      <div className="search-bar">
        <h3 className="page-title">部门管理</h3>
        <div className="header-actions">
          <button className="btn btn-default" onClick={fetchDepts}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> 刷新
          </button>
          <button className="btn btn-primary" onClick={() => handleAdd()}>
            <Plus size={14} /> 新增部门
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
                <th style={{ minWidth: 200 }}>部门名称</th>
                <th style={{ width: 120 }}>部门编码</th>
                <th style={{ width: 80, textAlign: 'center' }}>排序</th>
                <th>描述</th>
                <th style={{ width: 200 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {depts.length === 0 ? (
                <tr><td colSpan={5} className="empty-cell">暂无数据</td></tr>
              ) : renderRows(depts)}
            </tbody>
          </table>
        )}
      </div>

      {formVisible && (
        <DraggableModal
          visible={formVisible}
          title={editData.id ? '编辑部门' : '新增部门'}
          width={400}
          onClose={() => setFormVisible(false)}
          detachConfig={{
            label: `dept-form-${editData.id || 'new'}`,
            url: `/detached?type=dept-form&data=${encodeURIComponent(JSON.stringify({ deptId: editData.id, parentId: editData.parent_id }))}`,
            width: 400, height: 420,
          }}
        >
          <DeptForm
            deptId={editData.id}
            parentId={editData.parent_id}
            onSuccess={fetchDepts}
            onClose={() => setFormVisible(false)}
          />
        </DraggableModal>
      )}
    </div>
  );
};

export default DeptManagement;
