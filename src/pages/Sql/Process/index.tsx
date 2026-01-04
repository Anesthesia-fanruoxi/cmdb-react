/**
 * SQL审核流程管理页面
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  getProcessList, getProcessUsers, createProcess, updateProcess, deleteProcess,
  type ProcessItem, type ProcessUser 
} from '../../../services/sql/process';
import { getDictDetail } from '../../../services/system/dict';
import { toast } from '../../../components/AppNotification';
import { confirm } from '../../../components/ConfirmModal';
import './style.css';

interface ProjectOption {
  value: string;
  label: string;
}

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
      const res = await getDictDetail('sys_project_dict');
      if (res.code === 200 && res.data?.items) {
        setProjectOptions(res.data.items.map((item: { id?: string; key?: string; value?: string }) => ({
          value: item.id || item.key || '',
          label: item.value || ''
        })));
      }
    } catch (error) {
      console.error('获取项目列表失败:', error);
    }
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
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>{dialogType === 'create' ? '创建审核流程' : '更新审核流程'}</h4>
              <button className="close-btn" onClick={() => setDialogVisible(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-item">
                <label>所属项目 <span className="required">*</span></label>
                <select 
                  value={formData.projectId}
                  onChange={e => setFormData(p => ({ ...p, projectId: e.target.value }))}
                  disabled={dialogType === 'update'}
                  required
                >
                  <option value="">请选择项目</option>
                  {projectOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-item">
                <label>审批人 <span className="required">*</span></label>
                <select 
                  value={formData.applyId}
                  onChange={e => setFormData(p => ({ ...p, applyId: Number(e.target.value) }))}
                  required
                >
                  <option value={0}>请选择审批人</option>
                  {approvers.map(u => (
                    <option key={u.id} value={u.id}>{u.nick_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-item">
                <label>执行人 <span className="required">*</span></label>
                <select 
                  value={formData.executorId}
                  onChange={e => setFormData(p => ({ ...p, executorId: Number(e.target.value) }))}
                  required
                >
                  <option value={0}>请选择执行人</option>
                  {executors.map(u => (
                    <option key={u.id} value={u.id}>{u.nick_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-default" onClick={() => setDialogVisible(false)}>取消</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
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
