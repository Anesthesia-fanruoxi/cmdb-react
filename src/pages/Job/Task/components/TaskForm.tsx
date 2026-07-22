/**
 * 任务表单组件 - 新建/编辑任务
 */

import { useState, useEffect } from 'react';
import { X, Loader2, HelpCircle } from 'lucide-react';
import { createTask, updateTask, validateCronExpression, Task, TaskFormData } from '../../../../services/job/task';
import toast from '../../../../components/Toast';

interface Props {
  visible: boolean;
  task: Task | null;
  onClose: () => void;
  onSuccess: () => void;
}

const TaskForm = ({ visible, task, onClose, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [showCronHelp, setShowCronHelp] = useState(false);
  const [nextTimes, setNextTimes] = useState<string[]>([]);
  const [form, setForm] = useState<TaskFormData>({
    name: '', task_key: '', cron: '', script_type: '', description: ''
  });

  const isEdit = !!task;

  useEffect(() => {
    if (visible && task) {
      setForm({
        id: task.id, name: task.name, task_key: task.task_key,
        cron: task.cron, script_type: task.script_type || '', description: task.description || ''
      });
    } else if (visible) {
      setForm({ name: '', task_key: '', cron: '', script_type: '', description: '' });
    }
    setNextTimes([]);
  }, [visible, task]);

  // 验证 cron 表达式
  const handleCronBlur = async () => {
    if (!form.cron) { setNextTimes([]); return; }
    const parts = form.cron.trim().split(/\s+/);
    if (parts.length !== 5 && parts.length !== 6) { setNextTimes([]); return; }
    try {
      const res = await validateCronExpression(form.cron);
      if (res.code === 200 && res.data?.is_valid) {
        setNextTimes(res.data.next_run || []);
      } else { setNextTimes([]); }
    } catch { setNextTimes([]); }
  };

  const handleSubmit = async () => {
    if (!form.name?.trim()) { toast.error('请输入任务名称'); return; }
    if (!form.task_key?.trim()) { toast.error('请输入任务标识'); return; }
    if (!/^[a-z][a-z0-9_]*$/.test(form.task_key)) { toast.error('任务标识只能包含小写字母、数字和下划线，且必须以字母开头'); return; }
    if (!form.cron?.trim()) { toast.error('请输入cron表达式'); return; }
    if (!form.script_type) { toast.error('请选择脚本类型'); return; }

    setLoading(true);
    try {
      const res = isEdit 
        ? await updateTask(form as TaskFormData & { id: number })
        : await createTask(form);
      if (res.code === 200) {
        toast.success(isEdit ? '更新成功' : '创建成功');
        onSuccess();
      } else { toast.error(res.message || '操作失败'); }
    } catch { toast.error('操作失败'); }
    finally { setLoading(false); }
  };

  if (!visible) return null;

  return (
    <>
      <div className="drawer-overlay task-form-overlay" onClick={onClose} />
      <div className="drawer-container task-form-drawer">
        <div className="drawer-header">
          <h3>{isEdit ? '编辑任务' : '新建任务'}</h3>
          <button className="drawer-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="drawer-body">
          <div className="form-item">
            <label>任务名称 <span className="required">*</span></label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="请输入任务名称" />
          </div>
          <div className="form-item">
            <label>任务标识 <span className="required">*</span></label>
            <input type="text" value={form.task_key} onChange={e => setForm(f => ({ ...f, task_key: e.target.value }))} placeholder="请输入任务标识" disabled={isEdit} />
            <span className="form-tip">只能包含小写字母、数字和下划线，且必须以字母开头</span>
          </div>
          <div className="form-item">
            <label>cron表达式 <span className="required">*</span> <button className="help-btn" onClick={() => setShowCronHelp(true)}><HelpCircle size={14} /></button></label>
            <input type="text" value={form.cron} onChange={e => setForm(f => ({ ...f, cron: e.target.value }))} onBlur={handleCronBlur} placeholder="请输入cron表达式" />
            {nextTimes.length > 0 && (
              <div className="cron-preview">
                <div className="preview-title">最近5次执行时间：</div>
                <div className="time-list">{nextTimes.map((t, i) => <span key={i} className="time-tag">{t}</span>)}</div>
              </div>
            )}
          </div>
          <div className="form-item">
            <label>脚本类型 <span className="required">*</span></label>
            <select value={form.script_type} onChange={e => setForm(f => ({ ...f, script_type: e.target.value }))}>
              <option value="">请选择脚本类型</option>
              <option value="shell">Shell</option>
              <option value="python">Python</option>
            </select>
          </div>
          <div className="form-item">
            <label>任务描述</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="请输入任务描述" rows={4} />
          </div>
        </div>
        <div className="drawer-footer">
          <button className="btn-default" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={loading}>{loading && <Loader2 size={14} className="spin" />} 确定</button>
        </div>
      </div>

      {showCronHelp && (
        <>
          <div className="dialog-overlay" onClick={() => setShowCronHelp(false)} style={{ zIndex: 1200 }} />
          <div className="cron-help-dialog">
            <div className="dialog-header"><h3>Cron表达式帮助</h3><button className="dialog-close" onClick={() => setShowCronHelp(false)}><X size={18} /></button></div>
            <div className="dialog-body">
              <h4>Cron表达式格式 (5-6位):</h4>
              <p><code>秒 分 时 日 月 周</code> 或 <code>分 时 日 月 周</code></p>
              <h5>字段说明:</h5>
              <ul>
                <li><strong>秒(0-59)</strong>: 表示秒（可选）</li>
                <li><strong>分(0-59)</strong>: 表示分钟</li>
                <li><strong>时(0-23)</strong>: 表示小时</li>
                <li><strong>日(1-31)</strong>: 表示日期</li>
                <li><strong>月(1-12)</strong>: 表示月份</li>
                <li><strong>周(0-7)</strong>: 表示星期（0和7都表示星期日）</li>
              </ul>
              <h5>特殊字符:</h5>
              <ul>
                <li><strong>*</strong>: 表示所有可能的值</li>
                <li><strong>,</strong>: 用于列举值，如 "1,3,5"</li>
                <li><strong>-</strong>: 表示范围，如 "1-5"</li>
                <li><strong>/</strong>: 表示增量，如 "0/15" 表示从0开始每15个单位</li>
              </ul>
              <h5>常用示例:</h5>
              <ul>
                <li><code>0 12 * * ?</code>: 每天中午12点执行</li>
                <li><code>0/5 * * * ?</code>: 每隔5分钟执行一次</li>
                <li><code>0 10,14,16 * * ?</code>: 每天上午10点、下午2点和4点执行</li>
              </ul>
            </div>
          </div>
        </>
      )}
      <style>{`
        .task-form-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1100; }
        .task-form-drawer { position: fixed; top: 0; right: 0; width: 420px; height: 100%; background: var(--bg-color); z-index: 1101; display: flex; flex-direction: column; }
        .task-form-drawer .drawer-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
        .task-form-drawer .drawer-header h3 { margin: 0; font-size: 16px; color: var(--text-color); }
        .task-form-drawer .drawer-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); }
        .task-form-drawer .drawer-body { flex: 1; overflow: auto; padding: 20px; }
        .task-form-drawer .drawer-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border-color); }
        .task-form-drawer .form-item { margin-bottom: 16px; }
        .task-form-drawer .form-item label { display: flex; align-items: center; gap: 4px; margin-bottom: 8px; font-size: 14px; color: var(--text-color); }
        .task-form-drawer .form-item .required { color: #ff4d4f; }
        .task-form-drawer .form-item input, .task-form-drawer .form-item select, .task-form-drawer .form-item textarea { width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-color); color: var(--text-color); font-size: 13px; }
        .task-form-drawer .form-item input:disabled { background: var(--bg-secondary); cursor: not-allowed; }
        .task-form-drawer .form-item textarea { resize: vertical; }
        .task-form-drawer .form-tip { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
        .task-form-drawer .help-btn { background: none; border: none; cursor: pointer; color: var(--text-secondary); padding: 0; }
        .task-form-drawer .cron-preview { margin-top: 8px; padding: 12px; background: var(--bg-secondary); border-radius: 4px; }
        .task-form-drawer .preview-title { font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; }
        .task-form-drawer .time-list { display: flex; flex-wrap: wrap; gap: 8px; }
        .task-form-drawer .time-tag { padding: 2px 8px; background: var(--primary-color); color: #fff; border-radius: 4px; font-size: 12px; }
        .task-form-drawer .btn-default, .task-form-drawer .btn-primary { display: flex; align-items: center; gap: 4px; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; }
        .task-form-drawer .btn-default { background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-color); }
        .task-form-drawer .btn-primary { background: var(--primary-color); border: none; color: #fff; }
        .task-form-drawer .btn-primary:disabled { opacity: 0.6; }
        .cron-help-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 600px; max-height: 80vh; background: var(--bg-color); border-radius: 8px; z-index: 1201; overflow: hidden; display: flex; flex-direction: column; }
        .cron-help-dialog .dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
        .cron-help-dialog .dialog-header h3 { margin: 0; font-size: 16px; color: var(--text-color); }
        .cron-help-dialog .dialog-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); }
        .cron-help-dialog .dialog-body { flex: 1; overflow: auto; padding: 20px; }
        .cron-help-dialog h4, .cron-help-dialog h5 { margin: 0 0 12px; color: var(--primary-color); }
        .cron-help-dialog h5 { margin-top: 16px; }
        .cron-help-dialog p { margin: 8px 0; }
        .cron-help-dialog ul { padding-left: 20px; margin: 8px 0; }
        .cron-help-dialog li { margin: 6px 0; line-height: 1.6; }
        .cron-help-dialog code { background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #e6a23c; }
        .cron-help-dialog strong { color: var(--primary-color); }
        .task-form-drawer .spin { animation: task-form-spin 1s linear infinite; }
        @keyframes task-form-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
};

export default TaskForm;
