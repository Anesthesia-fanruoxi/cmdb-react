/**
 * 发版管理页面
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Lock, Unlock, Edit2 } from 'lucide-react';
import { getProjectUpdateList, updateProjectConfig } from '@/services/assets';
import type { ProjectUpdate } from '@/services/assets';
import { useAuthStore } from '@/stores';
import ProjectDetailDrawer from './components/ProjectDetailDrawer';
import Switch from '@/components/Switch';
import toast from '@/components/Toast';
import './index.css';

interface UserWithRole {
  role?: { level?: number };
  role_id?: string | number;
}

const ProUpdatePage = () => {
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState<ProjectUpdate[]>([]);
  const [currentType, setCurrentType] = useState<'default' | 'web'>('default');
  const [editMode, setEditMode] = useState(false);
  const [cellHover, setCellHover] = useState<Record<string, boolean>>({});
  
  // 详情抽屉
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentDetail, setCurrentDetail] = useState<ProjectUpdate | null>(null);

  // 编辑弹窗
  const [editDialog, setEditDialog] = useState({ visible: false, row: null as ProjectUpdate | null, field: '', label: '', value: '' });

  const { user, hasPermission } = useAuthStore();
  const userWithRole = user as UserWithRole | null;
  const roleLevel = userWithRole?.role?.level;
  const roleId = userWithRole?.role_id;
  const canShowBackend = roleLevel === 0 || roleLevel === 1 || roleId === '1' || roleId === '2' || Number(roleId) <= 2;
  const hasWritePermission = hasPermission('assets:proUpdate:w') && canShowBackend;

  useEffect(() => {
    if (!canShowBackend && currentType === 'default') setCurrentType('web');
  }, [canShowBackend, currentType]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getProjectUpdateList({ type: currentType === 'web' ? 'web' : undefined });
      if (res.code === 200 && res.data) {
        const items = res.data.items || res.data || [];
        setTableData(Array.isArray(items) ? items.map(item => ({ ...item, type: currentType })) : []);
      }
    } catch {
      // 错误已在控制台记录
    } finally {
      setLoading(false);
    }
  }, [currentType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCellHover = (project: string, field: string, hover: boolean) => {
    if (!editMode) return;
    setCellHover(prev => ({ ...prev, [`${project}-${field}`]: hover }));
  };

  const handleCellEdit = (row: ProjectUpdate, field: string, label: string) => {
    let value = '';
    if (field === 'tool') {
      value = currentType === 'web' ? row.frontend_tool : row.backend_tool;
    } else {
      value = (row as unknown as Record<string, string>)[field] || '';
    }
    setEditDialog({ visible: true, row, field, label, value });
  };

  const handleEditSubmit = async () => {
    if (!editDialog.row) return;
    let apiField = editDialog.field;
    if (editDialog.field === 'git_url') apiField = currentType === 'web' ? 'git_vue' : 'git_backend';
    else if (editDialog.field === 'feishu_url') apiField = 'update_feishu';
    else if (editDialog.field === 'tool') apiField = currentType === 'web' ? 'frontend_tool' : 'backend_tool';

    try {
      const res = await updateProjectConfig({ project: editDialog.row.project, [apiField]: editDialog.value });
      if (res.code === 200) {
        toast.success('更新成功');
        setEditDialog(prev => ({ ...prev, visible: false }));
        fetchData();
      } else {
        toast.error(res.message || '更新失败');
      }
    } catch {
      toast.error('更新失败');
    }
  };

  const handleSwitchChange = async (row: ProjectUpdate, field: keyof ProjectUpdate, value: boolean) => {
    try {
      const res = await updateProjectConfig({ project: row.project, [field]: value });
      if (res.code === 200) {
        toast.success('更新成功');
        fetchData();
      }
    } catch {
      toast.error('更新失败');
    }
  };

  const handleToolChange = async (row: ProjectUpdate, value: string) => {
    const field = currentType === 'web' ? 'frontend_tool' : 'backend_tool';
    try {
      const res = await updateProjectConfig({ project: row.project, [field]: value });
      if (res.code === 200) {
        toast.success('更新成功');
        fetchData();
      }
    } catch {
      toast.error('更新失败');
    }
  };

  const formatFeishuUrl = (url: string) => {
    if (!url) return '-';
    const prefix = 'https://open.feishu.cn/open-apis/bot/v2/hook/';
    return url.startsWith(prefix) ? url.replace(prefix, '') : url;
  };

  const getStatusClass = (status: string) => {
    if (status === 'success') return 'success';
    if (status === 'failed') return 'danger';
    if (status === 'running') return 'warning';
    return 'default';
  };

  const getStatusText = (status: string) => {
    if (status === 'success') return '成功';
    if (status === 'failed') return '失败';
    if (status === 'running') return '进行中';
    return status || '-';
  };

  return (
    <div className="pro-update-page">
      <div className="page-card">
        <div className="card-header">
          <span className="title">项目更新信息</span>
          <div className="header-actions">
            <div className="type-switch">
              {canShowBackend && <button className={currentType === 'default' ? 'active' : ''} onClick={() => setCurrentType('default')}>后端</button>}
              <button className={currentType === 'web' ? 'active' : ''} onClick={() => setCurrentType('web')}>前端</button>
            </div>
            {hasWritePermission && (
              <button className={`btn-edit ${editMode ? 'warning' : 'primary'}`} onClick={() => { setEditMode(!editMode); toast.success(editMode ? '已关闭编辑模式' : '已开启编辑模式'); }}>
                {editMode ? <><Lock size={14} /> 关闭编辑</> : <><Unlock size={14} /> 开启编辑</>}
              </button>
            )}
            <button className="btn-default" onClick={fetchData}><RefreshCw size={14} /> 刷新</button>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr><th>序号</th><th>项目名称</th><th>Git仓库</th><th>飞书通知</th><th>链路追踪</th><th>工具</th><th>更新时间</th><th>状态</th><th>更新总数</th><th>操作</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={10} className="loading-cell">加载中...</td></tr> :
               tableData.length === 0 ? <tr><td colSpan={10} className="empty-cell">暂无数据</td></tr> :
               tableData.map((row, i) => (
                <tr key={row.project}>
                  <td>{i + 1}</td>
                  <td>{row.project_name}</td>
                  <td className="editable-cell" onMouseEnter={() => handleCellHover(row.project, 'git_url', true)} onMouseLeave={() => handleCellHover(row.project, 'git_url', false)}>
                    <div className="cell-content">
                      <span className="cell-text" title={row.git_url}>{row.git_url || '-'}</span>
                      {cellHover[`${row.project}-git_url`] && <Edit2 size={12} className="edit-icon" onClick={() => handleCellEdit(row, 'git_url', 'Git仓库')} />}
                    </div>
                  </td>
                  <td className="editable-cell" onMouseEnter={() => handleCellHover(row.project, 'feishu_url', true)} onMouseLeave={() => handleCellHover(row.project, 'feishu_url', false)}>
                    <div className="cell-content">
                      <span className="cell-text feishu" title={row.feishu_url}>{formatFeishuUrl(row.feishu_url)}</span>
                      {cellHover[`${row.project}-feishu_url`] && <Edit2 size={12} className="edit-icon" onClick={() => handleCellEdit(row, 'feishu_url', '飞书通知')} />}
                    </div>
                  </td>
                  <td><Switch checked={row.enable_skywalking} disabled={!editMode} onChange={checked => handleSwitchChange(row, 'enable_skywalking', checked)} /></td>
                  <td>
                    <select value={currentType === 'web' ? (row.frontend_tool || '') : (row.backend_tool || '')} disabled={!editMode} onChange={e => handleToolChange(row, e.target.value)}>
                      {currentType === 'web' ? (
                        <><option value="">请选择</option><option value="node14">node14</option><option value="node16">node16</option></>
                      ) : (
                        <><option value="">请选择</option><option value="java8">java8</option><option value="java17">java17</option><option value="java21">java21</option><option value="proxy">代理</option></>
                      )}
                    </select>
                  </td>
                  <td>{row.last_update}</td>
                  <td>{row.status !== '-' ? <span className={`status-tag ${getStatusClass(row.status)}`}>{getStatusText(row.status)}</span> : '-'}</td>
                  <td>{row.total_updates}</td>
                  <td><button className="btn-link" onClick={() => { setCurrentDetail(row); setDrawerVisible(true); }}>详情</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ProjectDetailDrawer visible={drawerVisible} project={currentDetail} onClose={() => setDrawerVisible(false)} />

      {editDialog.visible && (
        <div className="modal-overlay" onClick={() => setEditDialog(prev => ({ ...prev, visible: false }))}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>编辑{editDialog.label}</h3></div>
            <div className="modal-body">
              {editDialog.field === 'tool' ? (
                <select value={editDialog.value} onChange={e => setEditDialog(prev => ({ ...prev, value: e.target.value }))}>
                  {currentType === 'web' ? <><option value="node14">node14</option><option value="node16">node16</option></> : <><option value="java8">java8</option><option value="java17">java17</option><option value="java21">java21</option></>}
                </select>
              ) : (
                <textarea rows={3} value={editDialog.value} onChange={e => setEditDialog(prev => ({ ...prev, value: e.target.value }))} placeholder={`请输入${editDialog.label}`} />
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-default" onClick={() => setEditDialog(prev => ({ ...prev, visible: false }))}>取消</button>
              <button className="btn-primary" onClick={handleEditSubmit}>确定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProUpdatePage;
