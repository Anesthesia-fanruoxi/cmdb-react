/**
 * 部门表单组件（支持独立窗口）
 */

import { useState, useEffect, useCallback } from 'react';
import { getDeptList, createDept, updateDept, type Dept } from '../../../../services/system/dept';
import { closeCurrentWindow } from '../../../../utils/window';
import { toast } from '../../../../components/AppNotification';
import './DeptForm.css';

interface Props {
  deptId?: string;
  parentId?: string;
  onSuccess?: () => void;
  onClose?: () => void;
}

const DeptForm = ({ deptId, parentId, onSuccess, onClose }: Props) => {
  const [loading, setLoading] = useState(false);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    sort: 0,
    description: '',
    parent_id: parentId || ''
  });

  const isEdit = !!deptId;

  // 获取部门列表（用于上级部门选择）
  const fetchDepts = useCallback(async () => {
    try {
      const res = await getDeptList();
      if (res.code === 200) setDepts(res.data || []);
    } catch (error) {
      console.error('获取部门列表失败:', error);
    }
  }, []);

  // 获取部门详情（编辑时）
  useEffect(() => {
    fetchDepts();
    if (deptId) {
      // 从列表中找到部门数据
      const findDept = (items: Dept[], id: string): Dept | null => {
        for (const item of items) {
          if (item.id === id) return item;
          if (item.children?.length) {
            const found = findDept(item.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      getDeptList().then(res => {
        if (res.code === 200) {
          const dept = findDept(res.data || [], deptId);
          if (dept) {
            setFormData({
              name: dept.name || '',
              code: dept.code || '',
              sort: dept.sort ?? 0,
              description: dept.description || '',
              parent_id: dept.parent_id || ''
            });
          }
        }
      });
    }
  }, [deptId, fetchDepts]);

  const flatDepts = useCallback(() => {
    const result: { id: string; name: string; level: number }[] = [];
    const flatten = (items: Dept[], level = 0) => {
      items.forEach(item => {
        // 编辑时排除自己和子部门
        if (deptId && item.id === deptId) return;
        result.push({ id: item.id, name: item.name, level });
        if (item.children?.length) flatten(item.children, level + 1);
      });
    };
    flatten(depts);
    return result;
  }, [depts, deptId]);

  const handleClose = () => {
    if (onClose) onClose();
    else closeCurrentWindow();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.warning('请输入部门名称'); return; }

    setLoading(true);
    try {
      if (isEdit) {
        await updateDept({ id: deptId, ...formData });
      } else {
        await createDept(formData);
      }
      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error('保存部门失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dept-form-container">
      <div className="form-header">
        <h4>{isEdit ? '编辑部门' : '新增部门'}</h4>
        <button className="close-btn" onClick={handleClose}>×</button>
      </div>
      <form onSubmit={handleSubmit} className="form-body">
        {!isEdit && (
          <div className="form-item">
            <label>上级部门</label>
            <select value={formData.parent_id} onChange={e => setFormData(prev => ({ ...prev, parent_id: e.target.value }))}>
              <option value="">无（顶级部门）</option>
              {flatDepts().map(d => (
                <option key={d.id} value={d.id}>{'　'.repeat(d.level)}{d.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="form-item">
          <label>部门名称 <span className="required">*</span></label>
          <input type="text" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="请输入部门名称" required />
        </div>
        <div className="form-item">
          <label>部门编码</label>
          <input type="text" value={formData.code} onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))} placeholder="请输入部门编码" />
        </div>
        <div className="form-item">
          <label>显示排序</label>
          <input type="number" value={formData.sort} onChange={e => setFormData(prev => ({ ...prev, sort: parseInt(e.target.value) || 0 }))} min={0} max={999} />
        </div>
        <div className="form-item">
          <label>部门描述</label>
          <textarea value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="请输入部门描述" rows={3} />
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-default" onClick={handleClose}>取消</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? '保存中...' : '确定'}</button>
        </div>
      </form>
    </div>
  );
};

export default DeptForm;
