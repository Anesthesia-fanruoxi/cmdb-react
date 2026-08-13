/**
 * SQL数据导出页面
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getExportListSSE, getSqlExportProjects, submitExport, getProcessList, getDatabases,
  generateExportDownloadLink, EXPORT_STATUS_MAP,
  type ExportItem, type ExportProject, type ProcessInfo, type CreateExportData
} from '@/services/sql';
import { toast } from '@/components/AppNotification';
import ExportDetailDrawer from './ExportDetail';
import DownloadDialog from '@/components/TaskCenter/DownloadDialog';
import './style.css';

const SqlExport = () => {
  const [loading, setLoading] = useState(false);
  const [exportList, setExportList] = useState<ExportItem[]>([]);
  const [projects, setProjects] = useState<ExportProject[]>([]);
  const eventSourceRef = useRef<{ close: () => void } | null>(null);
  
  // 下载相关
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [currentDownloadId, setCurrentDownloadId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  
  // 抽屉状态
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // 流程数据
  const [processList, setProcessList] = useState<ProcessInfo[]>([]);
  const [databases, setDatabases] = useState<string[]>([]);
  
  // 表单数据
  const [formData, setFormData] = useState({
    project: '',
    submitSql: false,
    database_name: '',
    sql_content: '',
    submitter_remark: ''
  });
  
  // 流程人员
  const [flowPersons, setFlowPersons] = useState({
    approver: '',
    reviewer: '系统管理员',
    executor: '',
    applyId: null as number | null,
    reviewerId: 1,
    executorId: null as number | null
  });

  // 关闭 SSE 连接
  const closeSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // 获取导出列表（SSE）
  const fetchExportList = useCallback(() => {
    closeSSE();
    setLoading(true);
    
    const eventSource = getExportListSSE(
      (data) => {
        setExportList(data.export || []);
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
      () => {
        // complete
      }
    );
    
    eventSourceRef.current = eventSource;
  }, [closeSSE]);

  // 组件卸载时关闭 SSE
  useEffect(() => {
    return () => closeSSE();
  }, [closeSSE]);

  // 获取项目列表
  const fetchProjects = useCallback(async () => {
    try {
      const res = await getSqlExportProjects();
      if (res.code === 200) {
        const items = (res.data as { items?: ExportProject[] })?.items || res.data || [];
        setProjects(Array.isArray(items) ? items : []);
      }
    } catch {
      // 静默处理
    }
  }, []);

  // 获取流程列表
  const fetchProcessList = useCallback(async () => {
    try {
      const res = await getProcessList();
      if (res.code === 200 && res.data?.list) {
        setProcessList(res.data.list);
      }
    } catch {
      // 静默处理
    }
  }, []);

  useEffect(() => {
    fetchExportList();
    fetchProjects();
    fetchProcessList();
  }, [fetchExportList, fetchProjects, fetchProcessList]);

  // 项目变更时加载数据库和流程人员
  const handleProjectChange = async (projectId: string) => {
    setFormData(prev => ({ ...prev, project: projectId, database_name: '' }));
    setDatabases([]);
    
    if (!projectId) {
      setFlowPersons(prev => ({ ...prev, approver: '', executor: '', applyId: null, executorId: null }));
      return;
    }

    // 查找流程配置（项目下拉值为项目ID，与流程列表 projectId 匹配）
    const selectedProject = projects.find(p => String(p.id) === projectId);
    const processData = processList.find(p =>
      (p.projectId != null && String(p.projectId) === projectId) ||
      (selectedProject?.project != null && String(p.agent) === String(selectedProject.project)) ||
      p.projectName === selectedProject?.project_name
    );
    
    if (processData) {
      setFlowPersons(prev => ({
        ...prev,
        approver: processData.applyName || '未指定审批人',
        executor: processData.executorName || '未指定执行人',
        applyId: processData.applyId || null,
        executorId: processData.executorId || null
      }));
    } else {
      setFlowPersons(prev => ({
        ...prev,
        approver: '未配置审批人',
        executor: '未配置执行人',
        applyId: null,
        executorId: null
      }));
      toast.warning('该项目未配置审批流程');
    }

    // 如果开启了提交SQL，加载数据库列表（使用项目简称作为 agent 参数）
    if (formData.submitSql && selectedProject) {
      try {
        const res = await getDatabases({ agent: selectedProject.project || projectId });
        if (res.code === 200 && res.data?.databases) {
          const dbs = res.data.databases;
          setDatabases(Array.isArray(dbs) ? dbs : Object.keys(dbs));
        }
      } catch {
        // 静默处理
      }
    }
  };

  // 提交SQL开关变更
  const handleSubmitSqlChange = async (checked: boolean) => {
    setFormData(prev => ({ ...prev, submitSql: checked, database_name: '', sql_content: '' }));
    
    if (checked && formData.project) {
      const selectedProject = projects.find(p => String(p.id) === formData.project);
      if (selectedProject) {
        try {
          const res = await getDatabases({ agent: selectedProject.project || formData.project });
          if (res.code === 200 && res.data?.databases) {
            const dbs = res.data.databases;
            setDatabases(Array.isArray(dbs) ? dbs : Object.keys(dbs));
          }
        } catch {
          // 静默处理
        }
      }
    }
  };

  // 打开创建抽屉
  const handleCreate = () => {
    setFormData({ project: '', submitSql: false, database_name: '', sql_content: '', submitter_remark: '' });
    setFlowPersons({ approver: '', reviewer: '系统管理员', executor: '', applyId: null, reviewerId: 1, executorId: null });
    setDatabases([]);
    setDrawerVisible(true);
  };

  // 查看详情
  const handleViewDetail = (item: ExportItem) => {
    setCurrentId(item.id);
    setDetailVisible(true);
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.project || Number.isNaN(Number(formData.project))) {
      toast.warning('请选择项目');
      return;
    }
    if (!formData.submitter_remark) {
      toast.warning('请输入申请说明');
      return;
    }
    if (!flowPersons.applyId || !flowPersons.executorId) {
      toast.error('当前项目未配置完整审批流程，无法提交');
      return;
    }
    if (formData.submitSql) {
      if (!formData.database_name) {
        toast.warning('请选择数据库');
        return;
      }
      if (!formData.sql_content) {
        toast.warning('请输入导出SQL');
        return;
      }
    }

    setSubmitting(true);
    try {
      const submitData: CreateExportData = {
        project: Number(formData.project),
        apply_id: flowPersons.applyId!,
        reviewer_id: flowPersons.reviewerId,
        executor_id: flowPersons.executorId!,
        submitter_remark: formData.submitter_remark,
        has_sql: formData.submitSql,
        ...(formData.submitSql ? {
          database_name: formData.database_name,
          sql_content: formData.sql_content
        } : {})
      };
      
      const res = await submitExport(submitData);
      if (res.code === 200) {
        toast.success('申请提交成功');
        setDrawerVisible(false);
        fetchExportList();
      } else {
        toast.error(res.message || '提交失败');
      }
    } catch {
      toast.error('提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 获取状态样式
  const getStatusInfo = (status: number) => {
    return EXPORT_STATUS_MAP[status] || { text: '未知', type: 'default' };
  };

  // 处理下载
  const handleDownload = async (item: ExportItem) => {
    // 如果已有下载链接，直接下载
    if (item.download_url) {
      window.open(item.download_url, '_blank');
      return;
    }

    // 否则生成下载链接
    setCurrentDownloadId(item.id);
    setGenerating(true);
    try {
      const res = await generateExportDownloadLink(item.id);
      if (res.code === 200) {
        setDownloadUrl(res.data.downloadUrl || res.data.download_url);
        setShowDownloadDialog(true);
        
        // 更新列表中的 download_url
        setExportList(prev => prev.map(exp => 
          exp.id === item.id ? { ...exp, download_url: res.data.downloadUrl || res.data.download_url } : exp
        ));
      } else {
        toast.error(res.message || '生成下载链接失败');
      }
    } catch {
      toast.error('生成下载链接失败');
    } finally {
      setGenerating(false);
      setCurrentDownloadId(null);
    }
  };

  return (
    <div className="sql-export">
      <div className="page-header">
        <h3>数据导出申请</h3>
        <div className="header-actions">
          <button className="btn btn-default" onClick={fetchExportList}>↻ 刷新</button>
          <button className="btn btn-primary" onClick={handleCreate}>+ 创建申请</button>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>所属项目</th>
                <th>提交人</th>
                <th>审批人</th>
                <th>创建时间</th>
                <th>当前操作人</th>
                <th style={{ minWidth: 200 }}>状态</th>
                <th style={{ width: 150 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {exportList.length === 0 ? (
                <tr><td colSpan={7} className="empty-cell">暂无数据</td></tr>
              ) : (
                exportList.map(item => {
                  const statusInfo = getStatusInfo(item.status);
                  
                  return (
                    <tr key={item.id}>
                      <td>{item.project_name}</td>
                      <td>{item.submitter_name}</td>
                      <td>{item.apply_name || '-'}</td>
                      <td>{item.created_at?.replace('T', ' ').substring(0, 19)}</td>
                      <td className={item.current_operator ? 'highlight-cell' : ''}>{item.current_operator || '-'}</td>
                      <td>
                        <span className={`tag tag-${statusInfo.type}`}>{statusInfo.text}</span>
                      </td>
                      <td className="action-cell">
                        <button className="btn btn-link" onClick={() => handleViewDetail(item)}>详情</button>
                        {item.status === 6 && (
                          <button 
                            className="btn btn-link" 
                            onClick={() => handleDownload(item)}
                            disabled={generating && currentDownloadId === item.id}
                          >
                            {generating && currentDownloadId === item.id ? '生成中...' : (item.download_url ? '下载' : '生成链接')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* 创建抽屉 */}
      {drawerVisible && (
        <div className="drawer-overlay" onClick={() => setDrawerVisible(false)}>
          <div className="drawer drawer-wide" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h4>创建数据导出申请</h4>
              <button className="close-btn" onClick={() => setDrawerVisible(false)}>×</button>
            </div>
            <form className="drawer-body export-form" onSubmit={handleSubmit}>
              <div className="form-item">
                <label><span className="required">*</span> 所属项目</label>
                <select value={formData.project} onChange={e => handleProjectChange(e.target.value)} required>
                  <option value="">请选择项目</option>
                  {projects.map(p => <option key={p.id} value={String(p.id)}>{p.project_name}</option>)}
                </select>
              </div>
              
              <div className="form-item form-item-switch">
                <label>提交SQL</label>
                <label className="switch">
                  <input type="checkbox" checked={formData.submitSql} onChange={e => handleSubmitSqlChange(e.target.checked)} />
                  <span className="slider"></span>
                </label>
              </div>

              {formData.submitSql && (
                <>
                  <div className="form-item">
                    <label><span className="required">*</span> 数据库</label>
                    <select 
                      value={formData.database_name} 
                      onChange={e => setFormData(p => ({ ...p, database_name: e.target.value }))} 
                      disabled={!formData.project}
                    >
                      <option value="">请选择数据库</option>
                      {databases.map(db => <option key={db} value={db}>{db}</option>)}
                    </select>
                  </div>
                  <div className="form-item">
                    <label><span className="required">*</span> 导出SQL</label>
                    <textarea 
                      value={formData.sql_content} 
                      onChange={e => setFormData(p => ({ ...p, sql_content: e.target.value }))}
                      placeholder="请输入导出SQL语句"
                      rows={6}
                    />
                  </div>
                </>
              )}

              <div className="form-item">
                <label>审批人</label>
                <input type="text" value={flowPersons.approver} disabled placeholder="选择项目后自动显示" />
              </div>
              <div className="form-item">
                <label>审核人</label>
                <input type="text" value={flowPersons.reviewer} disabled />
              </div>
              <div className="form-item">
                <label>执行人</label>
                <input type="text" value={flowPersons.executor} disabled placeholder="选择项目后自动显示" />
              </div>
              
              <div className="form-item">
                <label><span className="required">*</span> 申请说明</label>
                <textarea 
                  value={formData.submitter_remark} 
                  onChange={e => setFormData(p => ({ ...p, submitter_remark: e.target.value }))}
                  placeholder="请详细描述您需要导出的数据内容, 用途和时间要求等, 明文不允许提取, 若存在敏感信息,请详细说明字段及非明文的处理方式"
                  rows={6}
                  required
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-default" onClick={() => setDrawerVisible(false)}>取消</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? '提交中...' : '提交申请'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 详情抽屉 */}
      <ExportDetailDrawer
        visible={detailVisible}
        exportId={currentId}
        onClose={() => setDetailVisible(false)}
        onRefresh={fetchExportList}
      />

      {/* 下载对话框 */}
      <DownloadDialog
        visible={showDownloadDialog}
        downloadUrl={downloadUrl}
        taskType="sql_export"
        taskId={currentDownloadId || undefined}
        onClose={() => {
          setShowDownloadDialog(false);
          setDownloadUrl('');
          fetchExportList(); // 刷新列表
        }}
      />
    </div>
  );
};

export default SqlExport;
