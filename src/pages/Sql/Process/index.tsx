/**
 * SQL审核流程管理页面
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getProcessList, getProcessUsers, getSqlProcessProjects, createProcess, updateProcess, deleteProcess,
  type ProcessItem, type ProcessUser 
} from '../../../services/sql/process';
import { toast } from '../../../components/AppNotification';
import { confirm } from '../../../components/ConfirmModal';
import './style.css';

interface ProjectOption {
  value: string;
  label: string;
}

interface SelectOption {
  value: string | number;
  label: string;
}

/** 自定义下拉选择组件 */
const ProcessSelect = ({ value, options, placeholder, disabled, onChange }: {
  value: string | number;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (val: string | number) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = options.find(o => String(o.value) === String(value));

  if (disabled) {
    return (
      <div className="p-select p-select--disabled" ref={ref}>
        <div className="p-select__display">
          <span>{selected?.label || placeholder}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-select${open ? ' p-select--open' : ''}`} ref={ref}>
      <div className="p-select__display" onClick={() => setOpen(v => !v)}>
        <span className={selected ? '' : 'p-select__placeholder'}>{selected?.label || placeholder}</span>
        <span className="p-select__arrow" />
      </div>
      {open && (
        <div className="p-select__dropdown">
          {options.length === 0 ? (
            <div className="p-select__empty">暂无选项</div>
          ) : (
            options.map(opt => (
              <div
                key={String(opt.value)}
                className={`p-select__option${String(opt.value) === String(value) ? ' p-select__option--active' : ''}`}
                onClick={() => { onChange(opt.value); setOpen(false); }}
              >
                <span>{opt.label}</span>
                {String(opt.value) === String(value) && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const SqlProcess = () => {
  const [loading, setLoading] = useState(false);
  const [processList, setProcessList] = useState<ProcessItem[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [approvers, setApprovers] = useState<ProcessUser[]>([]);
  const [executors, setExecutors] = useState<ProcessUser[]>([]);
  
  // 弹窗状态
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogType, setDialogType] = useState<'create' | 'update'>('create');
  const [submitting, setSubmitting] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [formData, setFormData] = useState({
    id: '',
    projectId: '',
    applyId: 0,
    executorId: 0
  });

  // 获取流程列表
  const fetchProcessList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getProcessList();
      if (res.code === 200) {
        setProcessList(res.data?.list || []);
      }
    } catch (error) {
      console.error('获取流程列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取项目列表
  const fetchProjectList = useCallback(async () => {
    try {
      const res = await getSqlProcessProjects();
      if (res.code === 200 && res.data) {
        const items: any[] = Array.isArray(res.data) ? res.data : (res.data as any).items || [];
        setProjectOptions(items.map(item => ({ value: item.project || item.key || '', label: item.project_name || item.value || '' })));
      }
    } catch (e) { console.error('获取项目列表失败:', e); }
  }, []);

  // 获取用户列表
  const fetchUsers = useCallback(async () => {
    try {
      const res = await getProcessUsers();
      if (res.code === 200 && res.data) {
        setApprovers((res.data.approvers || []).map(u => ({
          ...u,
          nick_name: u.nick_name || u.user_name
        })));
        setExecutors((res.data.executors || []).map(u => ({
          ...u,
          nick_name: u.nick_name || u.user_name
        })));
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
    }
  }, []);

  useEffect(() => {
    fetchProcessList();
    fetchProjectList();
  }, [fetchProcessList, fetchProjectList]);

  // 打开创建弹窗
  const handleCreate = async () => {
    await fetchUsers();
    setFormData({ id: '', projectId: '', applyId: 0, executorId: 0 });
    setDialogType('create');
    setDialogVisible(true);
  };

  // 打开更新弹窗
  const handleUpdate = async (row: ProcessItem) => {
    await fetchUsers();
    setFormData({
      id: row.id,
      projectId: row.projectId,
      applyId: row.applyId,
      executorId: row.executorId
    });
    setProjectName(row.projectName);
    setDialogType('update');
    setDialogVisible(true);
  };

  // 删除流程
  const handleDelete = async (row: ProcessItem) => {
    if (!await confirm({ content: `确定要删除该流程吗？`, type: 'danger' })) return;
    try {
      const res = await deleteProcess(row.id);
      if (res.code === 200) {
        fetchProcessList();
      }
    } catch (error) {
      console.error('删除流程失败:', error);
    }
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectId || !formData.applyId || !formData.executorId) {
      toast.warning('请填写完整信息');
      return;
    }

    setSubmitting(true);
    try {
      if (dialogType === 'create') {
        await createProcess({
          project_id: formData.projectId,
          apply_id: formData.applyId,
          executor_id: formData.executorId
        });
      } else {
        await updateProcess({
          id: formData.id,
          apply_id: formData.applyId,
          executor_id: formData.executorId
        });
      }
      setDialogVisible(false);
      fetchProcessList();
    } catch (error) {
      console.error('保存流程失败:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sql-process">
      <div className="page-header">
        <h3>SQL审核流程管理</h3>
        <div className="header-actions">
          <button className="btn btn-default" onClick={fetchProcessList}>↻ 刷新</button>
          <button className="btn btn-primary" onClick={handleCreate}>+ 创建流程</button>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>项目名称</th>
                <th>审批人</th>
                <th>执行人</th>
                <th style={{ width: 180 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {processList.length === 0 ? (
                <tr><td colSpan={4} className="empty-cell">暂无数据</td></tr>
              ) : (
                processList.map(row => (
                  <tr key={row.id}>
                    <td>{row.projectName}</td>
                    <td><span className="tag tag-primary">{row.applyName}</span></td>
                    <td><span className="tag tag-success">{row.executorName}</span></td>
                    <td className="action-cell">
                      <button className="btn btn-link" onClick={() => handleUpdate(row)}>更新</button>
                      <button className="btn btn-link btn-danger" onClick={() => handleDelete(row)}>删除</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* 弹窗 */}
      {dialogVisible && (
        <div className="modal-overlay" onClick={() => setDialogVisible(false)}>
          <div className="modal-content process-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="process-modal-title">
                <span className="process-modal-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                    <path d="M9 14l2 2 4-4" />
                  </svg>
                </span>
                <h4>{dialogType === 'create' ? '创建审核流程' : '更新审核流程'}</h4>
              </div>
              <button className="process-close-btn" onClick={() => setDialogVisible(false)} title="关闭">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-item">
                  <label><span className="required">*</span>所属项目</label>
                  {dialogType === 'update' ? (
                    <div className="p-select p-select--disabled">
                      <div className="p-select__display">
                        <span>{projectName || formData.projectId}</span>
                      </div>
                    </div>
                  ) : (
                    <ProcessSelect
                      value={formData.projectId}
                      onChange={val => setFormData(p => ({ ...p, projectId: String(val) }))}
                      options={projectOptions.map(o => ({ value: o.value, label: o.label }))}
                      placeholder="请选择项目"
                    />
                  )}
                </div>
                <div className="form-item">
                  <label><span className="required">*</span>审批人</label>
                  <ProcessSelect
                    value={formData.applyId}
                    onChange={val => setFormData(p => ({ ...p, applyId: Number(val) }))}
                    options={approvers.map(u => ({ value: u.id, label: u.nick_name }))}
                    placeholder="请选择审批人"
                  />
                </div>
                <div className="form-item">
                  <label><span className="required">*</span>执行人</label>
                  <ProcessSelect
                    value={formData.executorId}
                    onChange={val => setFormData(p => ({ ...p, executorId: Number(val) }))}
                    options={executors.map(u => ({ value: u.id, label: u.nick_name }))}
                    placeholder="请选择执行人"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-default" onClick={() => setDialogVisible(false)}>取消</button>
                <button type="submit" className="btn btn-primary process-submit-btn" disabled={submitting}>
                  {submitting && <span className="process-spinner" />}
                  {submitting ? '提交中...' : '确定'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SqlProcess;
