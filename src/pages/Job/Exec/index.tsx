/**
 * 执行记录页面
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { getExecList, getJobExecProjects, getTaskListForExec, ExecRecord, ExecQueryParams, ProjectOption } from '../../../services/job/exec';
import toast from '../../../components/Toast';
import ExecDetailDrawer from './components/ExecDetailDrawer';
import './index.css';

const ExecManagement = () => {
  const [loading, setLoading] = useState(false);
  const [execList, setExecList] = useState<ExecRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [taskMap, setTaskMap] = useState<Map<number, string>>(new Map());
  
  const [queryParams, setQueryParams] = useState<ExecQueryParams>({
    page: 1, page_size: 10, job_id: '', project: '', task_name: '', exec_status: null
  });

  // 详情抽屉
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentExecId, setCurrentExecId] = useState<number | null>(null);

  // 获取项目选项
  const fetchProjectOptions = useCallback(async () => {
    try {
      const res = await getJobExecProjects();
      if (res.code === 200) {
        const items = (res.data as any)?.items || res.data || [];
        setProjectOptions(items.map((item: any) => ({
          key: item.project || item.key,
          value: item.project_name || item.value
        })));
      }
    } catch { console.error('获取项目选项失败'); }
  }, []);

  // 获取任务列表
  const fetchTaskList = useCallback(async () => {
    try {
      const res = await getTaskListForExec();
      if (res.code === 200) {
        const tasks = Array.isArray(res.data) ? res.data : (res.data as any)?.list || [];
        setTaskMap(new Map(tasks.map((t: any) => [t.id, t.name])));
      }
    } catch { console.error('获取任务列表失败'); }
  }, []);

  // 获取执行记录列表
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getExecList(queryParams);
      if (res.code === 200) {
        const data = res.data as any;
        if (data?.list) {
          setExecList(data.list);
          setTotal(data.total || 0);
        } else if (Array.isArray(data)) {
          setExecList(data);
          setTotal(data.length);
        } else {
          setExecList([]);
          setTotal(0);
        }
      }
    } catch { toast.error('获取执行记录失败'); }
    finally { setLoading(false); }
  }, [queryParams]);

  useEffect(() => {
    fetchProjectOptions();
    fetchTaskList();
  }, [fetchProjectOptions, fetchTaskList]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // 获取项目名称
  const getProjectName = (key: string) => projectOptions.find(p => p.key === key)?.value || key || '-';
  
  // 获取任务名称
  const getTaskName = (jobId: number) => taskMap.get(jobId) || '-';

  // 获取状态样式
  const getStatusClass = (status: number) => {
    const map: Record<number, string> = { 0: 'warning', 1: 'success', 2: 'danger' };
    return map[status] || 'default';
  };

  // 获取状态文本
  const getStatusText = (status: number) => {
    const map: Record<number, string> = { 0: '执行中', 1: '成功', 2: '失败' };
    return map[status] || '未知';
  };

  // 格式化执行时长
  const formatDuration = (seconds: number) => {
    if (!seconds && seconds !== 0) return '-';
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}小时${m}分${seconds % 60}秒`;
  };

  // 搜索处理
  const handleSearch = (key: keyof ExecQueryParams, value: any) => {
    setQueryParams(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  // 查看详情
  const handleViewDetail = (record: ExecRecord) => {
    setCurrentExecId(record.id);
    setDetailVisible(true);
  };

  // 分页
  const totalPages = Math.ceil(total / queryParams.page_size!);

  return (
    <div className="exec-page">
      <div className="search-bar">
        <input type="text" value={queryParams.job_id || ''} onChange={e => handleSearch('job_id', e.target.value)} placeholder="任务ID" className="search-input small" />
        <select value={queryParams.project || ''} onChange={e => handleSearch('project', e.target.value)} className="search-select">
          <option value="">选择项目</option>
          {projectOptions.map(p => <option key={p.key} value={p.key}>{p.value}</option>)}
        </select>
        <select value={queryParams.task_name || ''} onChange={e => handleSearch('task_name', e.target.value)} className="search-select">
          <option value="">选择任务</option>
          {Array.from(taskMap.entries()).map(([id, name]) => <option key={id} value={name}>{name}</option>)}
        </select>
        <select value={queryParams.exec_status ?? ''} onChange={e => handleSearch('exec_status', e.target.value === '' ? null : Number(e.target.value))} className="search-select">
          <option value="">执行状态</option>
          <option value="0">执行中</option>
          <option value="1">成功</option>
          <option value="2">失败</option>
        </select>
        <button className="btn-refresh" onClick={fetchList}><RefreshCw size={14} /></button>
      </div>

      <div className="table-section">
        <div className="section-header"><span className="title">执行记录列表</span></div>
        {loading ? (
          <div className="loading-state"><Loader2 size={24} className="spin" /> 加载中...</div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>记录ID</th><th>任务ID</th><th>任务名称</th><th>项目</th>
                    <th>执行状态</th><th>开始时间</th><th>结束时间</th><th>执行时长</th><th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {execList.map(record => (
                    <tr key={record.id}>
                      <td>{record.id}</td>
                      <td>{record.job_id}</td>
                      <td>{getTaskName(record.job_id)}</td>
                      <td>{getProjectName(record.project)}</td>
                      <td><span className={`status-tag ${getStatusClass(record.exec_status)}`}>{getStatusText(record.exec_status)}</span></td>
                      <td>{record.start_time || '-'}</td>
                      <td>{record.end_time || '-'}</td>
                      <td>{formatDuration(record.duration)}</td>
                      <td><button className="btn-link" onClick={() => handleViewDetail(record)}>详情</button></td>
                    </tr>
                  ))}
                  {execList.length === 0 && <tr><td colSpan={9} className="empty-cell">暂无数据</td></tr>}
                </tbody>
              </table>
            </div>
            {total > 0 && (
              <div className="pagination">
                <span className="total">共 {total} 条</span>
                <select value={queryParams.page_size} onChange={e => setQueryParams(p => ({ ...p, page_size: Number(e.target.value), page: 1 }))}>
                  {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}条/页</option>)}
                </select>
                <button disabled={queryParams.page === 1} onClick={() => setQueryParams(p => ({ ...p, page: p.page! - 1 }))}>上一页</button>
                <span className="page-info">{queryParams.page} / {totalPages}</span>
                <button disabled={queryParams.page === totalPages} onClick={() => setQueryParams(p => ({ ...p, page: p.page! + 1 }))}>下一页</button>
              </div>
            )}
          </>
        )}
      </div>

      <ExecDetailDrawer visible={detailVisible} execId={currentExecId} onClose={() => setDetailVisible(false)} />
    </div>
  );
};

export default ExecManagement;
