/**
 * 文件管理页面
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Upload, Folder, FileText, ArrowLeft, Home } from 'lucide-react';
import { getFileProjects, getFileList } from '../../../services/assets/file';
import type { FileProject, FileItem } from '../../../services/assets/file';
import UploadDialog, { type UploadFileItem } from './UploadDialog';
import toast from '../../../components/Toast';
import './index.css';

const keyOptions = [
  { label: '校验文件 (verify)', value: 'verify' },
  { label: '协议文件 (html)', value: 'html' },
  { label: '小程序 (h5)', value: 'h5' }
];

const FilePage = () => {
  const [loading, setLoading] = useState(false);
  const [projectOptions, setProjectOptions] = useState<FileProject[]>([]);
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  
  // 预览弹窗状态
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  
  // 上传弹窗状态
  const [uploadVisible, setUploadVisible] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFileItem[]>([]);

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
      
      // 校验文件使用内置预览窗口
      if (queryParams.key === 'verify') {
        setPreviewUrl(url);
        setPreviewVisible(true);
      } else {
        window.open(url, '_blank');
      }
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
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer?.types?.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  // 递归遍历文件树（支持目录上传）
  const traverseFileTree = async (
    entry: FileSystemEntry,
    basePath: string,
    fileList: { file: File; path: string }[]
  ): Promise<void> => {
    if (entry.isFile) {
      return new Promise((resolve, reject) => {
        (entry as FileSystemFileEntry).file((file) => {
          fileList.push({ file, path: basePath || '' });
          resolve();
        }, reject);
      });
    } else if (entry.isDirectory) {
      const dirReader = (entry as FileSystemDirectoryEntry).createReader();
      return new Promise((resolve, reject) => {
        const allEntries: FileSystemEntry[] = [];
        
        const readEntries = () => {
          dirReader.readEntries(async (entries) => {
            if (entries.length === 0) {
              const newBasePath = basePath ? `${basePath}/${entry.name}` : entry.name;
              try {
                for (const childEntry of allEntries) {
                  await traverseFileTree(childEntry, newBasePath, fileList);
                }
                resolve();
              } catch (error) {
                reject(error);
              }
              return;
            }
            allEntries.push(...entries);
            readEntries();
          }, reject);
        };
        
        readEntries();
      });
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (!canUpload) { toast.warning('请先选择项目和功能类型'); return; }
    
    const items = e.dataTransfer?.items;
    if (!items || items.length === 0) return;

    // 立即提取所有 Entry 对象
    const entries: { entry: FileSystemEntry | null; file: File | null }[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          entries.push({ entry, file: null });
        } else {
          const file = item.getAsFile();
          if (file) entries.push({ entry: null, file });
        }
      }
    }

    if (entries.length === 0) return;
    
    try {
      const allFiles: UploadFileItem[] = [];
      
      for (const item of entries) {
        if (item.entry) {
          await traverseFileTree(item.entry, '', allFiles);
        } else if (item.file) {
          allFiles.push({ file: item.file, path: '' });
        }
      }

      if (allFiles.length === 0) {
        toast.warning('未找到可上传的文件');
        return;
      }

      // 打开上传弹窗
      setUploadFiles(allFiles);
      setUploadVisible(true);
    } catch (err) {
      toast.error('读取文件出错');
    }
  };

  const handleUploadClose = () => {
    setUploadVisible(false);
    setUploadFiles([]);
  };

  return (
    <div className="file-page" onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {isDragging && (
        <div className={`drop-overlay ${canUpload ? '' : 'disabled'}`}>
          <div className="drop-content">
            <Upload size={48} />
            <p>{canUpload ? '释放鼠标上传文件' : '无法上传'}</p>
            <span>{canUpload ? '支持同时上传文件和目录' : '请先选择项目和功能类型'}</span>
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
                  <td>
                    <div className="name-cell">
                      {item.is_dir ? <Folder size={16} className="icon folder" /> : <FileText size={16} className="icon file" />}
                      <span className={item.is_dir || item.url ? 'link-text' : ''}>{item.name}</span>
                    </div>
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

      {/* 校验文件预览弹窗 */}
      {previewVisible && (
        <div className="preview-overlay" onClick={() => setPreviewVisible(false)}>
          <div className="preview-dialog" onClick={e => e.stopPropagation()}>
            <div className="preview-header">
              <span className="preview-title">文件预览</span>
              <button className="preview-close" onClick={() => setPreviewVisible(false)}>×</button>
            </div>
            <div className="preview-url">
              <span className="url-label">URL:</span>
              <a href={previewUrl} target="_blank" rel="noreferrer" className="url-link">{previewUrl}</a>
              <button className="btn-copy" onClick={() => { navigator.clipboard.writeText(previewUrl); toast.success('已复制'); }}>复制</button>
            </div>
            <div className="preview-body">
              <iframe src={previewUrl} className="preview-iframe" title="文件预览" />
            </div>
          </div>
        </div>
      )}

      {/* 上传明细弹窗 */}
      <UploadDialog
        visible={uploadVisible}
        files={uploadFiles}
        project={queryParams.project}
        fileKey={queryParams.key}
        targetPath={queryParams.path}
        onClose={handleUploadClose}
        onSuccess={fetchList}
      />
    </div>
  );
};

export default FilePage;
