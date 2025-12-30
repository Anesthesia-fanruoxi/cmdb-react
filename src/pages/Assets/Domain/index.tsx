/**
 * 域名管理页面
 */

import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, RefreshCw, FileText } from 'lucide-react';
import { getDomainList, addDomain, updateDomain, updateDomainStatus, deleteDomain } from '../../../services/assets/domain';
import type { DomainRecord, DomainFormData } from '../../../services/assets/domain';
import toast from '../../../components/Toast';
import './index.css';

const typeOptions = [
  { label: 'A记录', value: 'A' },
  { label: 'CNAME记录', value: 'CNAME' },
  { label: 'MX记录', value: 'MX' },
  { label: 'TXT记录', value: 'TXT' },
  { label: 'NS记录', value: 'NS' },
  { label: 'AAAA记录', value: 'AAAA' }
];

const statusOptions = [
  { label: '已启用', value: 'ENABLE' },
  { label: '已停用', value: 'DISABLE' }
];

const DEFAULT_IP = '121.199.65.103';

const DomainPage = () => {
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState<DomainRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  
  // 查询条件
  const [queryParams, setQueryParams] = useState({ rrKeyWord: '', typeKeyWord: '', valueKeyWord: '', status: '' });
  
  // 弹窗状态
  const [dialogVisible, setDialogVisible] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formData, setFormData] = useState<DomainFormData>({ rr: '', type: 'A', value: '' });

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDomainList({ page: currentPage, size: pageSize, ...queryParams });
      if (res.code === 200 && res.data) {
        setTableData(res.data.list || []);
        setTotal(res.data.total || 0);
      }
    } catch (err) {
      console.error('获取域名列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, queryParams]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleQuery = () => { setCurrentPage(1); fetchList(); };
  const handleReset = () => { setQueryParams({ rrKeyWord: '', typeKeyWord: '', valueKeyWord: '', status: '' }); setCurrentPage(1); };

  const openAddDialog = () => {
    setIsEdit(false);
    setFormData({ rr: '', type: 'A', value: '' });
    setDialogVisible(true);
  };

  const openEditDialog = (row: DomainRecord) => {
    setIsEdit(true);
    setFormData({ record_id: row.recordId, rr: row.rr, type: row.type, value: row.value });
    setDialogVisible(true);
  };

  const handleSubmit = async () => {
    if (!formData.rr.trim()) { toast.warning('请输入主机记录'); return; }
    const submitData = { ...formData, value: formData.value.trim() || DEFAULT_IP };
    setFormLoading(true);
    try {
      const res = isEdit ? await updateDomain(submitData) : await addDomain(submitData);
      if (res.code === 200) {
        toast.success(isEdit ? '更新成功' : '添加成功');
        setDialogVisible(false);
        fetchList();
      } else {
        toast.error(res.message || '操作失败');
      }
    } catch (err) {
      toast.error('操作失败');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (row: DomainRecord) => {
    const newStatus = row.status === 'ENABLE' ? 'Disable' : 'Enable';
    const actionText = newStatus === 'Enable' ? '启用' : '停用';
    if (!confirm(`确定要${actionText}该域名记录吗？`)) return;
    try {
      const res = await updateDomainStatus({ record_id: row.recordId, status: newStatus });
      if (res.code === 200) { toast.success(`${actionText}成功`); fetchList(); }
      else toast.error(res.message || `${actionText}失败`);
    } catch (err) { toast.error(`${actionText}失败`); }
  };

  const handleDelete = async (row: DomainRecord) => {
    if (!confirm('确定要删除该域名记录吗？')) return;
    try {
      const res = await deleteDomain({ record_id: row.recordId });
      if (res.code === 200) { toast.success('删除成功'); fetchList(); }
      else toast.error(res.message || '删除失败');
    } catch (err) { toast.error('删除失败'); }
  };

  const formatTime = (ts: number) => ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '--';

  return (
    <div className="domain-page">
      <div className="page-header">
        <div className="title-section"><FileText size={20} /><h2>域名管理</h2></div>
        <div className="search-section">
          <input placeholder="主机记录" value={queryParams.rrKeyWord} onChange={e => setQueryParams(p => ({ ...p, rrKeyWord: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleQuery()} />
          <select value={queryParams.typeKeyWord} onChange={e => setQueryParams(p => ({ ...p, typeKeyWord: e.target.value }))}>
            <option value="">记录类型</option>
            {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input placeholder="记录值" value={queryParams.valueKeyWord} onChange={e => setQueryParams(p => ({ ...p, valueKeyWord: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleQuery()} />
          <select value={queryParams.status} onChange={e => setQueryParams(p => ({ ...p, status: e.target.value }))}>
            <option value="">状态</option>
            {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button className="btn-primary" onClick={handleQuery}><Search size={14} /> 搜索</button>
          <button className="btn-default" onClick={handleReset}><RefreshCw size={14} /> 重置</button>
        </div>
      </div>

      <div className="toolbar">
        <button className="btn-primary" onClick={openAddDialog}><Plus size={14} /> 添加域名</button>
        <button className="btn-default" onClick={fetchList} disabled={loading}><RefreshCw size={14} /> 刷新</button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>域名</th><th>主机记录</th><th>记录类型</th><th>记录值</th><th>TTL</th><th>状态</th><th>创建时间</th><th>更新时间</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={9} className="loading-cell">加载中...</td></tr> :
             tableData.length === 0 ? <tr><td colSpan={9} className="empty-cell">暂无数据</td></tr> :
             tableData.map(row => (
              <tr key={row.recordId}>
                <td title={row.domainName}>{row.domainName}</td>
                <td>{row.rr}</td>
                <td>{row.type}</td>
                <td title={row.value}>{row.value}</td>
                <td>{row.ttl}</td>
                <td><span className={`status-tag ${row.status === 'ENABLE' ? 'success' : 'info'}`}>{row.status === 'ENABLE' ? '已启用' : '已停用'}</span></td>
                <td>{formatTime(row.createTimestamp)}</td>
                <td>{formatTime(row.updateTimestamp)}</td>
                <td className="action-cell">
                  <button className="btn-link" onClick={() => openEditDialog(row)}>编辑</button>
                  <button className={`btn-link ${row.status === 'ENABLE' ? 'danger' : 'success'}`} onClick={() => handleToggleStatus(row)}>{row.status === 'ENABLE' ? '停用' : '启用'}</button>
                  <button className="btn-link danger" onClick={() => handleDelete(row)}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span>共 {total} 条</span>
        <div className="page-btns">
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>上一页</button>
          <span className="page-info">{currentPage} / {Math.ceil(total / pageSize) || 1}</span>
          <button disabled={currentPage >= Math.ceil(total / pageSize)} onClick={() => setCurrentPage(p => p + 1)}>下一页</button>
        </div>
      </div>

      {dialogVisible && (
        <div className="modal-overlay" onClick={() => setDialogVisible(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{isEdit ? '编辑域名记录' : '添加域名记录'}</h3><button className="modal-close" onClick={() => setDialogVisible(false)}>×</button></div>
            <div className="modal-body">
              <div className="form-item"><label>主机记录</label><input value={formData.rr} onChange={e => setFormData(p => ({ ...p, rr: e.target.value }))} placeholder="如: www" /><span className="form-tip">主机记录，如 www，填写@表示根域名</span></div>
              <div className="form-item"><label>记录类型</label><select value={formData.type} onChange={e => setFormData(p => ({ ...p, type: e.target.value }))}>{typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div className="form-item"><label>记录值</label><input value={formData.value} onChange={e => setFormData(p => ({ ...p, value: e.target.value }))} placeholder={`如: 1.2.3.4，不填则使用默认值 ${DEFAULT_IP}`} /><span className="form-tip">{formData.type === 'A' ? `A记录填写IPv4地址，不填写则使用默认值: ${DEFAULT_IP}` : formData.type === 'CNAME' ? 'CNAME记录填写域名，如: example.com.' : '记录值'}</span></div>
            </div>
            <div className="modal-footer"><button className="btn-default" onClick={() => setDialogVisible(false)}>取消</button><button className="btn-primary" onClick={handleSubmit} disabled={formLoading}>{formLoading ? '提交中...' : '确定'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DomainPage;
