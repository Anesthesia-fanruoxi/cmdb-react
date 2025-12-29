/**
 * 项目表单组件
 */

import { useState, useEffect } from 'react';
import { createProject, updateProject, type Project } from '../../../../services/system/project';
import './ProjectForm.css';

interface ProjectFormProps {
  visible: boolean;
  data: Project | null;
  onClose: () => void;
  onSuccess: (data: Partial<Project>, isEdit: boolean) => void;
}

const defaultForm: Partial<Project> = {
  project: '',
  project_name: '',
  logo: '',
  agent_url: '',
  backen_domain: '',
  api_domain: '',
  git_vue: '',
  git_backend: '',
  alter_feishu: '',
  update_feishu: '',
  notify_feishu: '',
  enable_skywalking: false,
  frontend_tool: '',
  backend_tool: '',
};

const ProjectForm = ({ visible, data, onClose, onSuccess }: ProjectFormProps) => {
  const [form, setForm] = useState<Partial<Project>>(defaultForm);
  const [loading, setLoading] = useState(false);
  const isEdit = !!data;

  useEffect(() => {
    if (visible) {
      setForm(data ? { ...data } : { ...defaultForm });
    }
  }, [visible, data]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [visible, onClose]);

  const handleChange = (field: keyof Project, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.project?.trim()) {
      alert('请输入项目简称');
      return;
    }
    if (!form.project_name?.trim()) {
      alert('请输入项目名称');
      return;
    }

    setLoading(true);
    try {
      const res = isEdit ? await updateProject(form) : await createProject(form);
      if (res.code === 200) {
        onSuccess(form, isEdit);
      } else {
        alert((res as { msg?: string }).msg || '操作失败');
      }
    } catch (error) {
      console.error('提交失败:', error);
      alert('操作失败');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content project-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? '编辑项目' : '新增项目'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-item">
              <label><span className="required">*</span>项目简称</label>
              <input
                type="text"
                value={form.project || ''}
                onChange={(e) => handleChange('project', e.target.value)}
                placeholder="请输入项目简称"
                disabled={isEdit}
              />
            </div>
            <div className="form-item">
              <label><span className="required">*</span>项目名称</label>
              <input
                type="text"
                value={form.project_name || ''}
                onChange={(e) => handleChange('project_name', e.target.value)}
                placeholder="请输入项目名称"
              />
            </div>
          </div>

          <div className="form-item full logo-field">
            <label>Logo地址</label>
            <div className="logo-input-wrapper">
              <input
                type="text"
                value={form.logo || ''}
                onChange={(e) => handleChange('logo', e.target.value)}
                placeholder="请输入Logo图片URL"
              />
              {form.logo && (
                <img src={form.logo} alt="logo预览" className="logo-preview" />
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-item">
              <label>前端仓库</label>
              <input
                type="text"
                value={form.git_vue || ''}
                onChange={(e) => handleChange('git_vue', e.target.value)}
                placeholder="请输入前端Git地址"
              />
            </div>
            <div className="form-item">
              <label>后端仓库</label>
              <input
                type="text"
                value={form.git_backend || ''}
                onChange={(e) => handleChange('git_backend', e.target.value)}
                placeholder="请输入后端Git地址"
              />
            </div>
          </div>

          <div className="form-item full">
            <label>Agent地址</label>
            <input
              type="text"
              value={form.agent_url || ''}
              onChange={(e) => handleChange('agent_url', e.target.value)}
              placeholder="请输入Agent代理地址"
            />
          </div>

          <div className="form-row">
            <div className="form-item">
              <label>后台管理地址</label>
              <input
                type="text"
                value={form.backen_domain || ''}
                onChange={(e) => handleChange('backen_domain', e.target.value)}
                placeholder="请输入后台管理地址"
              />
            </div>
            <div className="form-item">
              <label>三方调用地址</label>
              <input
                type="text"
                value={form.api_domain || ''}
                onChange={(e) => handleChange('api_domain', e.target.value)}
                placeholder="请输入三方调用地址"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-item">
              <label>飞书告警</label>
              <input
                type="text"
                value={form.alter_feishu || ''}
                onChange={(e) => handleChange('alter_feishu', e.target.value)}
                placeholder="告警Webhook地址"
              />
            </div>
            <div className="form-item">
              <label>发版通知</label>
              <input
                type="text"
                value={form.update_feishu || ''}
                onChange={(e) => handleChange('update_feishu', e.target.value)}
                placeholder="通知Webhook地址"
              />
            </div>
          </div>

          <div className="form-item full">
            <label>步骤通知</label>
            <input
              type="text"
              value={form.notify_feishu || ''}
              onChange={(e) => handleChange('notify_feishu', e.target.value)}
              placeholder="步骤Webhook地址"
            />
          </div>

          <div className="form-row">
            <div className="form-item">
              <label>前端工具</label>
              <select value={form.frontend_tool || ''} onChange={(e) => handleChange('frontend_tool', e.target.value)}>
                <option value="">请选择</option>
                <option value="node14">node14</option>
                <option value="node16">node16</option>
              </select>
            </div>
            <div className="form-item">
              <label>后端工具</label>
              <select value={form.backend_tool || ''} onChange={(e) => handleChange('backend_tool', e.target.value)}>
                <option value="">请选择</option>
                <option value="java8">java8</option>
                <option value="java17">java17</option>
                <option value="java21">java21</option>
              </select>
            </div>
          </div>

          <div className="form-item">
            <label>链路追踪</label>
            <label className="switch">
              <input
                type="checkbox"
                checked={form.enable_skywalking || false}
                onChange={(e) => handleChange('enable_skywalking', e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-default" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? '提交中...' : '确定'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectForm;
