/**
 * 视图表单弹窗
 */

import { useState, useEffect } from 'react';
import { createView, updateView, getViewDetail } from '../../../../services/elfk/view';
import type { ViewListItem, CreateViewParams } from '../../../../services/elfk/view';
import './ViewForm.css';

interface DictItem {
  key: string;
  value: string;
}

interface ViewFormProps {
  visible: boolean;
  editData: ViewListItem | null;
  projectOptions: DictItem[];
  categoryOptions: DictItem[];
  onClose: () => void;
  onSuccess: () => void;
}

const ViewForm = ({ visible, editData, projectOptions, categoryOptions, onClose, onSuccess }: ViewFormProps) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<CreateViewParams>({
    name: '',
    project: '',
    category: '',
    index_pattern: '',
    time_field: '@timestamp',
    description: '',
    log_type: 'elfk'
  });

  // 编辑时加载数据
  useEffect(() => {
    if (editData) {
      loadDetail();
    } else {
      setForm({
        name: '',
        project: '',
        category: '',
        index_pattern: '',
        time_field: '@timestamp',
        description: '',
        log_type: 'elfk'
      });
    }
  }, [editData]);

  const loadDetail = async () => {
    if (!editData) return;
    try {
      const res = await getViewDetail(editData.id);
      if (res.code === 200 && res.data) {
        const d = res.data;
        setForm({
          name: d.name,
          project: d.project,
          category: d.category || '',
          index_pattern: d.index_pattern,
          time_field: d.time_field,
          description: d.description || '',
          log_type: d.log_type || 'elfk'
        });
      }
    } catch (err) {
      console.error('获取视图详情失败:', err);
    }
  };

  const handleChange = (field: keyof CreateViewParams, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return alert('请输入视图名称');
    if (!form.project) return alert('请选择项目');
    if (!form.index_pattern.trim()) return alert('请输入索引模式');
    if (!form.time_field.trim()) return alert('请输入时间字段');

    setLoading(true);
    try {
      const res = editData
        ? await updateView({ ...form, id: editData.id })
        : await createView(form);
      
      if (res.code === 200) {
        onSuccess();
      }
    } catch (err) {
      console.error('保存视图失败:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content view-form-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editData ? '编辑视图' : '新建视图'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-item">
            <label className="required">视图名称</label>
            <input
              type="text"
              value={form.name}
              onChange={e => handleChange('name', e.target.value)}
              placeholder="请输入视图名称"
            />
          </div>

          <div className="form-row">
            <div className="form-item">
              <label className="required">项目</label>
              <select
                value={form.project}
                onChange={e => handleChange('project', e.target.value)}
                disabled={!!editData}
              >
                <option value="">请选择项目</option>
                {projectOptions.map(item => (
                  <option key={item.key} value={item.key}>{item.value}</option>
                ))}
              </select>
            </div>

            <div className="form-item">
              <label>分类</label>
              <select
                value={form.category}
                onChange={e => handleChange('category', e.target.value)}
              >
                <option value="">请选择分类</option>
                {categoryOptions.map(item => (
                  <option key={item.key} value={item.key}>{item.value}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-item">
            <label className="required">索引模式</label>
            <input
              type="text"
              value={form.index_pattern}
              onChange={e => handleChange('index_pattern', e.target.value)}
              placeholder="例如: logs-* 或 app-2024.*"
            />
          </div>

          <div className="form-row">
            <div className="form-item">
              <label className="required">时间字段</label>
              <input
                type="text"
                value={form.time_field}
                onChange={e => handleChange('time_field', e.target.value)}
                placeholder="例如: @timestamp"
              />
            </div>

            <div className="form-item">
              <label>日志类型</label>
              <select
                value={form.log_type}
                onChange={e => handleChange('log_type', e.target.value)}
              >
                <option value="elfk">ELFK</option>
                <option value="sls">SLS</option>
              </select>
            </div>
          </div>

          <div className="form-item">
            <label>描述</label>
            <textarea
              value={form.description}
              onChange={e => handleChange('description', e.target.value)}
              placeholder="请输入视图描述"
              rows={3}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>取消</button>
          <button className="btn-submit" onClick={handleSubmit} disabled={loading}>
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewForm;
