/**
 * SQL数据导出页面
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  getExportList, getSqlExportProjects, submitExport,
  EXPORT_STATUS_MAP, type ExportItem, type ExportProject
} from '../../../services/sql/export';
import { getDatabases } from '../../../services/sql/search';
import { toast } from '../../../components/AppNotification';
import ExportDetailDrawer from './ExportDetail';
import './style.css';

const SqlExport = () => {
  const [loading, setLoading] = useState(false);
  const [exportList, setExportList] = useState<ExportItem[]>([]);
  const [projects, setProjects] = useState<ExportProject[]>([]);
  
  // 抽屉状态
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // 表单数据
  const [formData, setFormData] = useState({
    project: '',
    database_name: '',
    sql_content: '',
    export_reason: '',
    recipient_email: ''
  });
  const [databases, setDatabases] = useState<string[]>([]);

  // 获取导出列表
  const fetchExportList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getExportList();
      if (res.code === 200) {
        setExportList(res.data?.export || []);
      }
    } catch (error) {
      console.error('获取导出列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取项目列表
  const fetchProjects = useCallback(async () => {
    try {
      const res = await getSqlExportProjects();
      if (res.code === 200) {
        // 兼容 items 或直接数组
        const items = (res.data as { items?: ExportProject[] })?.items || res.data || [];
        setProjects(Array.isArray(items) ? items : []);
      }
    } catch (error) {
      console.error('获取项目列表失败:', error);
    }
  }, []);

  useEffect(() => {
    fetchExportList();
    fetchProjects();
  }, [fetchExportList, fetchProjects]);

  // 项目变更时加载数据库
  const handleProjectChange = async (project: string) => {
    setFormData(prev => ({ ...prev, project, database_name: '' }));
    if (project) {
      try {
        const selectedProject = projects.find(p => p.project === project);
        const res = await getDatabases({ agent: selectedProject?.agent || project });
        if (res.code === 200 && res.data?.databases) {
          setDatabases(res.data.databases);
        }
      } catch (error) {
        console.error('获取数据库列表失败:', error);
      }
    } else {
      setDatabases([]);
    }
  };

  // 打开创建抽屉
  const handleCreate = () => {
    setFormData({ project: '', database_name: '', sql_content: '', export_reason: '', recipient_email: '' });
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
    if (!formData.project || !formData.database_name || !formData.sql_content || !formData.recipient_email) {
      toast.warning('请填写完整信息');
      return;
    }

    setSubmitting(true);
    try {
      await submitExport(formData);
      setDrawerVisible(false);
      fetchExportList();
    } catch (error) {
      console.error('提交申请失败:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // 获取状态样式
  const getStatusInfo = (status: number) => {
    return EXPORT_STATUS_MAP[status] || { text: '未知', type: 'default' };
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
                <th>状态</th>
                <th style={{ width: 120 }}>操作</th>
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
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h4>创建数据导出申请</h4>
              <button className="close-btn" onClick={() => setDrawerVisible(false)}>×</button>
            </div>
            <form className="drawer-body" onSubmit={handleSubmit}>
              <div className="form-item">
                <label>项目 <span className="required">*</span></label>
                <select value={formData.project} onChange={e => handleProjectChange(e.target.value)} required>
                  <option value="">请选择项目</option>
                  {projects.map(p => <option key={p.project} value={p.project}>{p.project_name}</option>)}
                </select>
              </div>
              <div className="form-item">
                <label>数据库 <span className="required">*</span></label>
                <select value={formData.database_name} onChange={e => setFormData(p => ({ ...p, database_name: e.target.value }))} required disabled={!formData.project}>
                  <option value="">请选择数据库</option>
                  {databases.map(db => <option key={db} value={db}>{db}</option>)}
                </select>
              </div>
              <div className="form-item">
                <label>接收邮箱 <span className="required">*</span></label>
                <input 
                  type="email"
                  value={formData.recipient_email} 
                  onChange={e => setFormData(p => ({ ...p, recipient_email: e.target.value }))}
                  placeholder="请输入接收导出结果的邮箱"
                  required
                />
              </div>
              <div className="form-item">
                <label>SQL内容 <span className="required">*</span></label>
                <textarea 
                  value={formData.sql_content} 
                  onChange={e => setFormData(p => ({ ...p, sql_content: e.target.value }))}
                  placeholder="请输入SQL查询语句"
                  rows={10}
                  required
                />
              </div>
              <div className="form-item">
                <label>导出原因 <span className="required">*</span></label>
                <textarea 
                  value={formData.export_reason} 
                  onChange={e => setFormData(p => ({ ...p, export_reason: e.target.value }))}
                  placeholder="请输入导出原因"
                  rows={3}
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
    </div>
  );
};

export default SqlExport;
