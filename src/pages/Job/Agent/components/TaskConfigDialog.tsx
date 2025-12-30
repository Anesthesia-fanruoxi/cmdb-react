/**
 * 任务配置对话框 - 配置任务变量
 */

import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTaskDetail, bindProjects, type Task, type Project } from '../../../../services/job/agent';
import toast from '../../../../components/Toast';

interface Variable { key: string; value: string; description: string; }

interface Props {
  visible: boolean;
  task: Task | null;
  project: Project | null;
  onClose: () => void;
  onSuccess: () => void;
}

const TaskConfigDialog = ({ visible, task, project, onClose, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [scriptContent, setScriptContent] = useState('');
  const [variables, setVariables] = useState<Variable[]>([]);

  // 解析脚本变量
  const parseScriptVariables = (script: string): Variable[] => {
    if (!script) return [];
    const lines = script.split('\n');
    const variablesMap = new Map<string, string>();
    lines.forEach(line => {
      const match = line.match(/\{\{\.(\w+)\}\}(?:\s*#\s*(.+))?/);
      if (match && !variablesMap.has(match[1])) {
        variablesMap.set(match[1], match[2]?.trim() || '');
      }
    });
    return Array.from(variablesMap, ([key, description]) => ({ key, value: '', description }));
  };

  // 预览脚本
  const previewScript = useMemo(() => {
    let result = scriptContent;
    variables.forEach(v => {
      const regex = new RegExp(`\\{\\{\\.${v.key}\\}\\}`, 'g');
      result = result.replace(regex, v.value || `{{.${v.key}}}`);
    });
    return result;
  }, [scriptContent, variables]);

  // 加载任务详情
  useEffect(() => {
    if (!visible || !task?.job_id) return;
    setCurrentStep(0);
    setLoading(true);
    getTaskDetail(task.job_id).then(res => {
      if (res.code === 200 && res.data) {
        const data = res.data as any;
        setScriptContent(data.script_content || '');
        let vars = parseScriptVariables(data.script_content || '');
        if (task.script_params) {
          vars = vars.map(v => ({ ...v, value: task.script_params?.[v.key] || '' }));
        }
        setVariables(vars);
      }
    }).catch(() => toast.error('获取任务详情失败')).finally(() => setLoading(false));
  }, [visible, task]);

  // 更新变量值
  const handleVariableChange = (index: number, value: string) => {
    setVariables(prev => prev.map((v, i) => i === index ? { ...v, value } : v));
  };

  // 保存配置
  const handleSave = async () => {
    if (!task || !project) return;
    setSaving(true);
    try {
      const scriptParams: Record<string, string> = {};
      variables.forEach(v => { if (v.key && v.value) scriptParams[v.key] = v.value; });
      const res = await bindProjects({ job_id: task.job_id, project: project.project, script_params: scriptParams });
      if (res.code === 200) {
        toast.success('配置保存成功');
        onSuccess();
        onClose();
      } else {
        toast.error(res.message || '配置保存失败');
      }
    } catch { toast.error('保存配置失败'); }
    finally { setSaving(false); }
  };

  // 复制脚本
  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(previewScript);
      toast.success('已复制到剪贴板');
    } catch { toast.error('复制失败'); }
  };

  if (!visible) return null;

  return (
    <>
      <div className="dialog-overlay" onClick={onClose} />
      <div className="dialog-container config-dialog">
        <div className="dialog-header">
          <h3>配置任务变量</h3>
          <button className="dialog-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="dialog-body">
          {loading ? (
            <div className="loading-state"><Loader2 size={24} className="spin" /> 加载中...</div>
          ) : (
            <>
              <div className="task-info-bar">
                <span><strong>任务：</strong>{task?.name || '-'}</span>
                <span><strong>项目：</strong>{project?.project_name || '-'}</span>
                <span><strong>任务标识：</strong>{task?.task_key || '-'}</span>
                <span><strong>脚本类型：</strong>{task?.script_type || '-'}</span>
              </div>

              <div className="steps">
                <div className={`step ${currentStep >= 0 ? 'active' : ''}`}><span className="step-num">1</span>配置变量</div>
                <div className="step-line" />
                <div className={`step ${currentStep >= 1 ? 'active' : ''}`}><span className="step-num">2</span>预览脚本</div>
              </div>

              {currentStep === 0 && (
                <div className="step-content">
                  {variables.length > 0 ? (
                    <div className="variables-form">
                      {variables.map((v, i) => (
                        <div key={v.key} className="form-item">
                          <label>
                            <code>{`{{.${v.key}}}`}</code>
                            {v.description && <span className="desc">{v.description}</span>}
                          </label>
                          <input type="text" value={v.value} onChange={e => handleVariableChange(i, e.target.value)} placeholder={v.description || `请输入 ${v.key} 的值`} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">脚本中未检测到变量</div>
                  )}
                </div>
              )}

              {currentStep === 1 && (
                <div className="step-content">
                  {variables.length > 0 && (
                    <div className="variables-preview">
                      <h5>变量配置：</h5>
                      <table className="preview-table">
                        <thead><tr><th>变量名</th><th>说明</th><th>变量值</th></tr></thead>
                        <tbody>
                          {variables.map(v => (
                            <tr key={v.key}><td><code>{`{{.${v.key}}}`}</code></td><td>{v.description || '-'}</td><td>{v.value || '-'}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="script-preview-section">
                    <div className="section-header"><h5>脚本预览：</h5><button className="btn-copy" onClick={handleCopyScript}><Copy size={14} /> 复制脚本</button></div>
                    <pre className="script-preview">{previewScript || '暂无脚本内容'}</pre>
                  </div>
                  <div className="confirm-tip">确认无误后，点击保存按钮完成配置</div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="dialog-footer">
          <button className="btn-default" onClick={onClose}>取消</button>
          {currentStep > 0 && <button className="btn-default" onClick={() => setCurrentStep(0)}><ChevronLeft size={14} /> 上一步</button>}
          {currentStep === 0 && <button className="btn-primary" onClick={() => setCurrentStep(1)}>下一步 <ChevronRight size={14} /></button>}
          {currentStep === 1 && <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving && <Loader2 size={14} className="spin" />} 保存</button>}
        </div>
      </div>
      <style>{`
        .config-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 900px; max-width: 90%; max-height: 85vh; background: var(--bg-color); border-radius: 8px; z-index: 1101; display: flex; flex-direction: column; }
        .dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
        .dialog-header h3 { margin: 0; font-size: 16px; color: var(--text-color); }
        .dialog-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); }
        .dialog-body { flex: 1; overflow: auto; padding: 20px; }
        .dialog-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border-color); }
        .loading-state { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-secondary); }
        .task-info-bar { display: flex; flex-wrap: wrap; gap: 20px; padding: 12px 16px; background: rgba(24, 144, 255, 0.1); border: 1px solid rgba(24, 144, 255, 0.3); border-radius: 6px; margin-bottom: 20px; font-size: 13px; color: var(--text-secondary); }
        .task-info-bar strong { color: var(--text-color); }
        .steps { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 24px; }
        .step { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-secondary); }
        .step.active { color: var(--primary-color); }
        .step-num { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--bg-secondary); font-size: 12px; }
        .step.active .step-num { background: var(--primary-color); color: #fff; }
        .step-line { width: 60px; height: 2px; background: var(--border-color); }
        .step-content { min-height: 200px; }
        .variables-form .form-item { margin-bottom: 16px; }
        .variables-form label { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
        .variables-form label code { font-size: 13px; color: var(--text-color); }
        .variables-form label .desc { font-size: 12px; color: var(--text-secondary); }
        .variables-form input { width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-color); color: var(--text-color); font-size: 13px; }
        .variables-preview { margin-bottom: 20px; }
        .variables-preview h5, .script-preview-section h5 { margin: 0 0 12px; font-size: 14px; color: var(--text-color); }
        .preview-table { width: 100%; border-collapse: collapse; font-size: 13px; border: 1px solid var(--border-color); border-radius: 4px; }
        .preview-table th, .preview-table td { padding: 8px 12px; border-bottom: 1px solid var(--border-color); text-align: left; }
        .preview-table th { background: var(--bg-secondary); }
        .preview-table code { font-size: 12px; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .btn-copy { display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: var(--primary-color); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .script-preview { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; padding: 16px; max-height: 300px; overflow: auto; font-family: monospace; font-size: 13px; line-height: 1.6; white-space: pre-wrap; color: var(--text-color); margin: 0; }
        .confirm-tip { margin-top: 16px; padding: 12px; background: rgba(82, 196, 26, 0.1); border: 1px solid rgba(82, 196, 26, 0.3); border-radius: 4px; color: #52c41a; font-size: 13px; }
        .empty-state { display: flex; align-items: center; justify-content: center; padding: 40px; color: var(--text-secondary); }
        .btn-default, .btn-primary { display: flex; align-items: center; gap: 4px; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; }
        .btn-default { background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-color); }
        .btn-primary { background: var(--primary-color); border: none; color: #fff; }
        .btn-primary:disabled { opacity: 0.6; }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </>
  );
};

export default TaskConfigDialog;
