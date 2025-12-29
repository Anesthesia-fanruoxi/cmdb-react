/**
 * 文件管理页面
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Upload, Folder, FileText, ArrowLeft, Home } from 'lucide-react';
import { getFileProjects, getFileList, uploadFile } from '../../../services/assets/file';
import type { FileProject, FileItem } from '../../../services/assets/file';
import toast from '../../../components/Toast';
import './index.css';

const keyOptions = [
  { label: '校验文件 (verify)', value: 'verify' },
  { label: '协议文件 (html)', value: 'html' },
  { label: '小程序 (h5)', value: 'h5' }
];

const FilePage = () => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [projectOptions, setProjectOptions] = useState<FileProject[]>([]);
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const [queryParams, setQueryParams] = useState({
    project: '', key: '', search: '', path: '', page: 1, sort: 'name' as const
  });

  const canQuery = queryParams.project && queryParams.key;
  const canUpload = canQuery;
  const pathSegments = useMemo(() => queryParams.path ? queryParams.path.split('/').filter(Boolean) : [], [queryParams.path]);

  useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    try {
      const res = await getFileProjects();
      if (res.code === 200 && res.data) {
        const items = res.data.items || res.data || [];
        setProjectOptions(Array.isArray(items) ? items : []);
      }
    } catch (err) {
      console.error('获取项目列表失败:', err);
    }
  };

  const fetchList = useCallback(async () => {
    if (!canQuery) return;
    setLoading(true);
    try {
      const res = await getFileList(queryParams);
      if (res.code === 200 && res.data?.data) {
        setFileList(res.data.data.files || []);
        setTotal(res.data.data.total || 0);
      } else {
        setFileList([]);
        setTotal(0);
      }
    } catch (err) {
      setFileList([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [queryParams, canQuery]);

  useEffect(() => { if (canQuery) fetchList(); }, [fetchList, canQuery]);

  const handleFilterChange = (field: string, value: string) => {
    setQueryParams(p => ({ ...p, [field]: value, path: '', search: '', page: 1 }));
    if (field === 'project') setFileList([]);
  };

  const handleEnterDir = (item: FileItem) => {
    if (item.is_dir) {
      const newPath = queryParams.path ? `${queryParams.path}/${item.name}` : item.name;
      setQueryParams(p => ({ ...p, path: newPath, page: 1 }));
    } else if (item.url) {
      let url = item.url;
      if (!/^https?:\/\//.test(url)) url = `https://${url}`;
      window.open(url, '_blank');
    }
  };

  const handleGoUp = () => {
    if (!queryParams.path) return;
    const parts = queryParams.path.split('/').filter(Boolean);
    parts.pop();
    setQueryParams(p => ({ ...p, path: parts.join('/'), page: 1 }));
  };

  const handleGoRoot = () => {
    if (!queryParams.path) return;
    setQueryParams(p => ({ ...p, path: '', page: 1 }));
  };

  const handleBreadcrumb = (index: number) => {
    if (index >= pathSegments.length - 1) return;
    const newPath = pathSegments.slice(0, index + 1).join('/');
    setQueryParams(p => ({ ...p, path: newPath, page: 1 }));
  };

  const formatSize = (size: number, isDir: boolean) => {
    if (isDir) return '-';
    if (!size) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(size) / Math.log(k));
    return (size / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
  };

  // 拖拽上传
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.types?.includes('Files')) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!canUpload) { toast.warning('请先选择项目和功能类型'); return; }
    
    const items = e.dataTransfer?.items;
    if (!items || items.length === 0) return;

    const allFiles: { file: File; path: string }[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) allFiles.push({ file, path: '' });
      }
    }

    if (allFiles.length === 0) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('project', queryParams.project);
      formData.append('key', queryParams.key);
      if (queryParams.path) formData.append('path', queryParams.path);
      
      allFiles.forEach(item => {
        formData.append('file', item.file);
        formData.append('filePath', item.path);
      });

      const res = await uploadFile(formData);
      if (res.code === 200) {
        toast.success(`成功上传 ${allFiles.length} 个文件`);
        fetchList();
      } else {
        toast.error(res.message || '上传失败');
      }
    } catch (err) {
      toast.error('上传出错');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="file-page" onDragEnter={handleDragEnter} onDragOver={e => e.preventDefault()} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {isDragging && canUpload && (
        <div className="drop-overlay">
          <div className="drop-content">
            <Upload size={48} />
            <p>释放鼠标上传文件</p>
            <span>支持同时上传文件和目录</span>
          </div>
        </div>
      )}

      <div className="page-card">
        <div className="card-header">
          <span className="title">文件管理</span>
          {canUpload && <div className="upload-tip">拖拽文件或目录到页面即可上传</div>}
        </div>

        <div className="filter-section">
          <div className="filter-item">
            <label>项目选择</label>
            <select value={queryParams.project} onChange={e => handleFilterChange('project', e.target.value)}>
              <option value="">请选择项目</option>
              {projectOptions.map(p => <option key={p.project} value={p.project}>{p.project_name}</option>)}
            </select>
          </div>
          <div className="filter-item">
            <label>功能类型</label>
            <select value={queryParams.key} onChange={e => handleFilterChange('key', e.target.value)} disabled={!queryParams.project}>
              <option value="">请选择功能</option>
              {keyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="filter-item">
            <label>文件名</label>
            <input value={queryParams.search} onChange={e => setQueryParams(p => ({ ...p, search: e.target.value }))} placeholder="搜索文件名" onKeyDown={e => e.key === 'Enter' && fetchList()} />
          </div>
          <div className="filter-item">
            <label>排序</label>
            <select value={queryParams.sort} onChange={e => setQueryParams(p => ({ ...p, sort: e.target.value as any }))}>
              <option value="name">按名称</option>
              <option value="time">按时间倒序</option>
              <option value="size">按大小倒序</option>
            </select>
          </div>
          <button className="btn-primary" onClick={fetchList} disabled={!canQuery}><Search size={14} /> 查询</button>
        </div>

        {canQuery && (
          <div className="path-nav">
            <button className="btn-link" onClick={handleGoUp} disabled={!queryParams.path}><ArrowLeft size={14} /> 返回上一级</button>
            <span className="divider">|</span>
            <div className="breadcrumb">
              <span className={queryParams.path ? 'link' : ''} onClick={handleGoRoot}><Home size={12} /> 根目录</span>
              {pathSegments.map((seg, i) => (
                <span key={i}>
                  <span className="sep">/</span>
                  <span className={i < pathSegments.length - 1 ? 'link' : ''} onClick={() => handleBreadcrumb(i)}>{seg}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>文件名</th><th>大小</th><th>更新时间</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={3} className="loading-cell">加载中...</td></tr> :
               !canQuery ? <tr><td colSpan={3} className="empty-cell">{!queryParams.project ? '请先选择项目' : '请选择功能类型'}</td></tr> :
               fileList.length === 0 ? <tr><td colSpan={3} className="empty-cell">暂无数据</td></tr> :
               fileList.map((item, i) => (
                <tr key={i} className={item.is_dir || item.url ? 'clickable' : ''} onClick={() => handleEnterDir(item)}>
                  <td className="name-cell">
                    {item.is_dir ? <Folder size={16} className="icon folder" /> : <FileText size={16} className="icon file" />}
                    <span className={item.is_dir || item.url ? 'link-text' : ''}>{item.name}</span>
                  </td>
                  <td>{formatSize(item.size, item.is_dir)}</td>
                  <td>{item.mod_time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canQuery && total > 0 && (
          <div className="pagination">
            <span>共 {total} 条</span>
            <div className="page-btns">
              <button disabled={queryParams.page <= 1} onClick={() => setQueryParams(p => ({ ...p, page: p.page - 1 }))}>上一页</button>
              <span>{queryParams.page}</span>
              <button onClick={() => setQueryParams(p => ({ ...p, page: p.page + 1 }))}>下一页</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilePage;
