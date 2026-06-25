/**
 * 任务绑定项目对话框
 */

import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { getTaskDetail, getTaskBindDetail, bindProjects, unbindProject, getJobTaskProjects, Task } from '../../../../services/job/task';
import toast from '../../../../components/Toast';

interface Variable { key: string; value: string; description: string; }
interface BoundProject { project: string; next_run?: string; script_params?: Record<string, string>; }
interface ProjectOption { key: string; name: string; }

interface Props {
  visible: boolean;
  task: Task | null;
  onClose: () => void;
  onSuccess: () => void;
}

const TaskBindDialog = ({ visible, task, onClose, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [boundProjects, setBoundProjects] = useState<BoundProject[]>([]);
  const [scriptContent, setScriptContent] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [variables, setVariables] = useState<Variable[]>([]);

  // 可用项目（过滤已绑定）
  const availableProjects = useMemo(() => 
    projectOptions.filter(p => !boundProjects.some(bp => bp.project === p.key)),
    [projectOptions, boundProjects]
  );

  // 预览脚本
  const previewScript = useMemo(() => {
    let result = scriptContent;
    variables.forEach(v => {
      const regex = new RegExp(`\\{\\{\\.${v.key}\\}\\}`, 'g');
      result = result.replace(regex, v.value || `{{.${v.key}}}`);
    });
    return result;
  }, [scriptContent, variables]);

  // 解析脚本变量
  const parseScriptVariables = (script: string): Variable[] => {
    if (!script) return [];
    const variablesMap = new Map<string, string>();
    script.split('\n').forEach(line => {
      const match = line.match(/\{\{\.(\w+)\}\}(?:\s*#\s*(.+))?/);
      if (match && !variablesMap.has(match[1])) {
        variablesMap.set(match[1], match[2]?.trim() || '');
      }
    });
    return Array.from(variablesMap, ([key, description]) => ({ key, value: '', description }));
  };

  // 获取项目名称
  const getProjectName = (key: string) => projectOptions.find(p => p.key === key)?.name || key;

  // 加载数据
  useEffect(() => {
    if (!visible || !task?.id) return;
    setCurrentStep(0);
    setSelectedProject('');
    setVariables([]);
    setScriptContent('');
    setLoading(true);

    Promise.all([
      getJobTaskProjects(),
      getTaskBindDetail(task.id)
    ]).then(([dictRes, bindRes]) => {
      if (dictRes.code === 200 && dictRes.data) {
        const items: any[] = Array.isArray(dictRes.data) ? dictRes.data : (dictRes.data as any).items || [];
        setProjectOptions(items.map(item => ({ key: item.project || item.key || '', name: item.project_name || item.value || '' })));
      }
      if (bindRes.code === 200 && bindRes.data) {
        setBoundProjects((bindRes.data as any).projects || []);
      }
    }).catch(() => toast.error('加载数据失败')).finally(() => setLoading(false));
  }, [visible, task]);

  // 下一步
  const handleNext = async () => {
    if (currentStep === 0) {
      if (!selectedProject) { toast.error('请选择项目'); return; }
      setLoading(true);
      try {
        const res = await getTaskDetail(task!.id);
        if (res.code === 200 && res.data) {
          const content = (res.data as any).script_content || '';
          setScriptContent(content);
          setVariables(parseScriptVariables(content));
          setCurrentStep(1);
        }
      } catch { toast.error('获取任务详情失败'); }
      finally { setLoading(false); }
    } else {
      setCurrentStep(2);
    }
  };

  // 提交绑定
  const handleSubmit = async () => {
    if (!task) return;
    setSubmitting(true);
    try {
      const scriptParams: Record<string, string> = {};
      variables.forEach(v => { if (v.key && v.value) scriptParams[v.key] = v.value; });
      const res = await bindProjects({ job_id: task.id, project: selectedProject, script_params: scriptParams });
      if (res.code === 200) {
        toast.success('绑定成功');
        onSuccess();
      } else { toast.error(res.message || '绑定失败'); }
    } catch { toast.error('绑定失败'); }
    finally { setSubmitting(false); }
  };

  // 解绑项目
  const handleUnbind = async (project: string) => {
    if (!task || !confirm(`确定要解除与项目"${getProjectName(project)}"的绑定吗？`)) return;
    try {
      const res = await unbindProject({ job_id: task.id, project });
      if (res.code === 200) {
        toast.success('解绑成功');
        setBoundProjects(prev => prev.filter(p => p.project !== project));
      }
    } catch { toast.error('解绑失败'); }
  };

  // 复制脚本
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(previewScript); toast.success('已复制'); } catch { toast.error('复制失败'); }
  };

  if (!visible) return null;

  return (
    <>
      <div className="dialog-overlay" onClick={onClose} />
      <div className="dialog-container bind-dialog">
        <div className="dialog-header">
          <h3>绑定项目</h3>
          <button className="dialog-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="dialog-body">
          {loading ? (
            <div className="loading-state"><Loader2 size={24} className="spin" /> 加载中...</div>
          ) : (
            <>
              {task && <div className="task-header"><h4>{task.name}</h4><p>{task.description || '暂无描述'}</p></div>}
              
              {boundProjects.length > 0 && (
                <div className="bound-section">
                  <h5>已绑定项目</h5>
                  <table className="bound-table">
                    <thead><tr><th>项目名称</th><th>下次执行时间</th><th>操作</th></tr></thead>
                    <tbody>
                      {boundProjects.map(p => (
                        <tr key={p.project}>
                          <td>{getProjectName(p.project)}</td>
                          <td>{p.next_run || '-'}</td>
                          <td><button className="btn-link danger" onClick={() => handleUnbind(p.project)}>解绑</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="divider" />
              <h5 className="bind-title">绑定新项目</h5>

              <div className="steps">
                {['选择项目', '配置任务', '预览脚本'].map((s, i) => (
                  <><div key={i} className={`step ${currentStep >= i ? 'active' : ''}`}><span className="step-num">{i + 1}</span>{s}</div>{i < 2 && <div className="step-line" />}</>
                ))}
              </div>

              {currentStep === 0 && (
                <div className="step-content">
                  <h5>选择要绑定的项目</h5>
                  <div className="project-list">
                    {availableProjects.map(p => (
                      <label key={p.key} className={`project-item ${selectedProject === p.key ? 'selected' : ''}`}>
                        <input type="radio" name="project" value={p.key} checked={selectedProject === p.key} onChange={e => setSelectedProject(e.target.value)} />
                        {p.name}
                      </label>
                    ))}
                    {availableProjects.length === 0 && <div className="empty-state">暂无可绑定的项目</div>}
                  </div>
                </div>
              )}

              {currentStep === 1 && (
                <div className="step-content">
                  <h5>配置脚本变量</h5>
                  <div className="selected-project"><strong>项目：</strong><span className="tag">{getProjectName(selectedProject)}</span></div>
                  {variables.length > 0 ? (
                    <div className="variables-form">
                      {variables.map((v, i) => (
                        <div key={v.key} className="form-item">
                          <label><code>{`{{.${v.key}}}`}</code>{v.description && <span className="desc">{v.description}</span>}</label>
                          <input type="text" value={v.value} onChange={e => setVariables(prev => prev.map((item, idx) => idx === i ? { ...item, value: e.target.value } : item))} placeholder={v.description || `请输入 ${v.key} 的值`} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">脚本中未检测到变量</div>
                  )}
                </div>
              )}

              {currentStep === 2 && (
                <div className="step-content">
                  <h5>脚本预览</h5>
                  <div className="summary-info"><p><strong>项目：</strong>{getProjectName(selectedProject)}</p><p><strong>任务：</strong>{task?.name}</p></div>
                  {variables.length > 0 && (
                    <div className="variables-preview">
                      <h6>变量配置：</h6>
                      <table className="preview-table">
                        <thead><tr><th>变量名</th><th>变量值</th></tr></thead>
                        <tbody>{variables.map(v => <tr key={v.key}><td><code>{`{{.${v.key}}}`}</code></td><td>{v.value || '-'}</td></tr>)}</tbody>
                      </table>
                    </div>
                  )}
                  <div className="script-section">
                    <div className="section-header"><h6>脚本内容：</h6><button className="btn-copy" onClick={handleCopy}><Copy size={14} /> 复制</button></div>
                    <pre className="script-preview">{previewScript || '暂无脚本内容'}</pre>
                  </div>
                  <div className="confirm-tip">确认无误后，点击保存按钮完成绑定</div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="dialog-footer">
          <button className="btn-default" onClick={onClose}>取消</button>
          {currentStep > 0 && <button className="btn-default" onClick={() => setCurrentStep(s => s - 1)}><ChevronLeft size={14} /> 上一步</button>}
          {currentStep < 2 && <button className="btn-primary" onClick={handleNext} disabled={currentStep === 0 && !selectedProject}>下一步 <ChevronRight size={14} /></button>}
          {currentStep === 2 && <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>{submitting && <Loader2 size={14} className="spin" />} 保存</button>}
        </div>
      </div>
      <style>{`
        .bind-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 800px; max-width: 90%; max-height: 85vh; background: var(--bg-color); border-radius: 8px; z-index: 1101; display: flex; flex-direction: column; }
        .dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
        .dialog-header h3 { margin: 0; font-size: 16px; color: var(--text-color); }
        .dialog-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); }
        .dialog-body { flex: 1; overflow: auto; padding: 20px; }
        .dialog-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border-color); }
        .loading-state { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: var(--text-secondary); }
        .task-header { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color); }
        .task-header h4 { margin: 0 0 8px; font-size: 18px; color: var(--text-color); }
        .task-header p { margin: 0; color: var(--text-secondary); font-size: 14px; }
        .bound-section { margin-bottom: 16px; }
        .bound-section h5, .bind-title { margin: 0 0 12px; font-size: 15px; color: var(--text-color); }
        .bound-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .bound-table th, .bound-table td { padding: 8px 12px; border: 1px solid var(--border-color); text-align: left; }
        .bound-table th { background: var(--bg-secondary); }
        .divider { height: 1px; background: var(--border-color); margin: 16px 0; }
        .steps { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 24px; }
        .step { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-secondary); }
        .step.active { color: var(--primary-color); }
        .step-num { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--bg-secondary); font-size: 12px; }
        .step.active .step-num { background: var(--primary-color); color: #fff; }
        .step-line { width: 40px; height: 2px; background: var(--border-color); }
        .step-content { min-height: 200px; }
        .step-content h5, .step-content h6 { margin: 0 0 12px; font-size: 14px; color: var(--text-color); }
        .project-list { display: flex; flex-direction: column; gap: 8px; }
        .project-item { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; }
        .project-item.selected { border-color: var(--primary-color); background: rgba(24, 144, 255, 0.1); }
        .project-item input { margin: 0; }
        .selected-project { margin-bottom: 16px; font-size: 14px; }
        .selected-project .tag { display: inline-block; padding: 2px 8px; background: var(--primary-color); color: #fff; border-radius: 4px; font-size: 12px; }
        .variables-form .form-item { margin-bottom: 16px; }
        .variables-form label { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
        .variables-form label code { font-size: 13px; color: var(--text-color); }
        .variables-form label .desc { font-size: 12px; color: var(--text-secondary); }
        .variables-form input { width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-color); color: var(--text-color); font-size: 13px; }
        .summary-info { margin-bottom: 16px; padding: 12px; background: rgba(24, 144, 255, 0.1); border: 1px solid rgba(24, 144, 255, 0.3); border-radius: 4px; }
        .summary-info p { margin: 4px 0; font-size: 14px; }
        .variables-preview { margin-bottom: 16px; }
        .preview-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .preview-table th, .preview-table td { padding: 8px 12px; border: 1px solid var(--border-color); text-align: left; }
        .preview-table th { background: var(--bg-secondary); }
        .preview-table code { font-size: 12px; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .btn-copy { display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: var(--primary-color); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .script-preview { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; padding: 16px; max-height: 200px; overflow: auto; font-family: monospace; font-size: 13px; line-height: 1.6; white-space: pre-wrap; color: var(--text-color); margin: 0; }
        .confirm-tip { margin-top: 16px; padding: 12px; background: rgba(82, 196, 26, 0.1); border: 1px solid rgba(82, 196, 26, 0.3); border-radius: 4px; color: #52c41a; font-size: 13px; }
        .empty-state { display: flex; align-items: center; justify-content: center; padding: 40px; color: var(--text-secondary); }
        .btn-default, .btn-primary { display: flex; align-items: center; gap: 4px; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; }
        .btn-default { background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-color); }
        .btn-primary { background: var(--primary-color); border: none; color: #fff; }
        .btn-primary:disabled { opacity: 0.6; }
        .btn-link { background: none; border: none; cursor: pointer; font-size: 12px; }
        .btn-link.danger { color: #ff4d4f; }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </>
  );
};

export default TaskBindDialog;
