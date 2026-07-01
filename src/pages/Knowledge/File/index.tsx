/**
 * 文件管理页面
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, Download, Trash2, FileText, Search, Link } from 'lucide-react';
import { getPublicFiles, getPrivateFiles, deleteFile, uploadFile, type FileItem, type CategorySize } from '../../../services/knowledge/file';
import { toast } from '../../../components/AppNotification';
import { confirm } from '../../../components/ConfirmModal';
import DownloadLinkModal from './components/DownloadLinkModal';
import './style.css';

const PAGE_SIZE = 20;

const FileManagement = () => {
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [dlModalItem, setDlModalItem] = useState<FileItem | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [totalSizeStr, setTotalSizeStr] = useState('');
  const [categorySizes, setCategorySizes] = useState<Record<string, CategorySize>>({});
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = useState(40);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: PAGE_SIZE, sort: 'created_at', order: 'desc' };
      if (searchKeyword) params.keyword = searchKeyword;
      const res = activeTab === 'public'
        ? await getPublicFiles(params)
        : await getPrivateFiles(params);
      if (res.code === 200 && res.data) {
        const list = (res.data.list || []).map(item => ({ ...item, is_private: activeTab === 'private' }));
        setFileList(list);
        setTotal(res.data.total || 0);
        setTotalSizeStr(res.data.total_size_str || '');
        setCategorySizes(res.data.category_sizes || {});
      }
    } catch (error) {
      console.error('获取文件列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, searchKeyword, refreshTick]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);
  useEffect(() => { setPage(1); }, [activeTab]);

  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.clientHeight;
      const theadH = el.querySelector('thead tr')?.clientHeight || 40;
      setRowHeight((h - theadH) / PAGE_SIZE);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  // 表格渲染后重新测量（loading切换时容器大小不变但thead出现）
  useEffect(() => {
    if (!loading) {
      const id = requestAnimationFrame(() => {
        const el = tableWrapRef.current;
        if (!el) return;
        const h = el.clientHeight;
        const theadH = el.querySelector('thead tr')?.clientHeight || 40;
        setRowHeight((h - theadH) / PAGE_SIZE);
      });
      return () => cancelAnimationFrame(id);
    }
  }, [loading]);

  const handleSearch = () => { setPage(1); setSearchKeyword(searchInput.trim()); setRefreshTick(t => t + 1); };
  const handleSearchKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); };

  const handleCopyLink = async (item: FileItem) => {
    if (item.is_private) {
      if (!item.uuid) { toast.info('文件UUID不存在'); return; }
      setDlModalItem(item);
      return;
    }
    if (!item.download_url) { toast.info('无下载链接'); return; }
    try {
      await navigator.clipboard.writeText(item.download_url);
      toast.success('链接已复制');
    } catch { toast.error('复制失败'); }
  };

  const handleDownload = (item: FileItem) => {
    setDlModalItem(item);
  };

  const handleDelete = async (item: FileItem) => {
    if (!item.id) return;
    const ok = await confirm({ title: '确认删除', content: `删除文件“${item.filename}”？`, type: 'danger' });
    if (!ok) return;
    try {
      const res = await deleteFile(item.id);
      if (res.code === 200) { toast.success('删除成功'); fetchFiles(); }
    } catch { toast.error('删除失败'); }
  };

  const doUploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'local');
      formData.append('resource', 'desktop');
      formData.append('is_private', activeTab === 'private' ? 'true' : 'false');
      const res = await uploadFile(formData);
      if (res.code === 200) { toast.success('上传成功'); fetchFiles(); }
    } catch { toast.error('上传失败'); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    doUploadFile(file);
  };

  // 拖拽上传
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer?.types?.includes('Files')) setIsDragging(true);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); dragCounterRef.current = 0; setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) doUploadFile(file);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="file-page" onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-content">
            <Upload size={48} />
            <p>释放鼠标上传文件</p>
            <span>文件将上传至{activeTab === 'private' ? '私有' : '公有'}文件库</span>
          </div>
        </div>
      )}
      <div className="file-header">
        <div className="file-tabs">
          <button className={`tab ${activeTab === 'public' ? 'active' : ''}`} onClick={() => setActiveTab('public')}>公有文件</button>
          <button className={`tab ${activeTab === 'private' ? 'active' : ''}`} onClick={() => setActiveTab('private')}>私有文件</button>
        </div>
        <div className="file-search">
          <Search size={14} />
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)} onKeyDown={handleSearchKeyDown} placeholder="搜索文件名..." />
          <button className="btn-search" onClick={handleSearch}>搜索</button>
        </div>
        <div className="file-size-stats">
          {totalSizeStr && <span className="size-total">总计: {totalSizeStr}</span>}
          {Object.entries(categorySizes).map(([key, val]) => (
            <span key={key} className="size-cat">
              {val.category_name || key}: {val.size_str}
            </span>
          ))}
        </div>
        <button className="btn-upload" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload size={16} />
          {uploading ? '上传中...' : '上传文件'}
        </button>
        <input ref={fileInputRef} type="file" hidden onChange={handleUpload} />
      </div>

      <div className="file-table-wrap" ref={tableWrapRef}>
        {loading ? <div className="loading">加载中...</div> : (
          <table className="file-table">
            <thead>
              <tr>
                <th>文件名</th>
                <th>上传人</th>
                <th>来源</th>
                <th>分类</th>
                <th>大小</th>
                <th>创建时间</th>
                <th style={{ width: 200 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {fileList.length === 0 ? (
                <tr><td colSpan={7} className="empty">暂无数据</td></tr>
              ) : fileList.map((item, i) => (
                <tr key={item.id || i} style={{ height: rowHeight }}>
                  <td>
                    <div className="file-name">
                      <FileText size={14} />
                      <span title={item.filename}>{item.filename}</span>
                    </div>
                  </td>
                  <td>{item.create_by || '-'}</td>
                  <td>{item.resource || '-'}</td>
                  <td>{item.category || '-'}</td>
                  <td>{item.size_str || '-'}</td>
                  <td className="file-time">{item.created_at}</td>
                  <td className="file-actions-cell">
                    <button className="link-btn" onClick={() => handleDownload(item)}>
                      <Download size={13} /> 下载
                    </button>
                    <button className="link-btn" onClick={() => handleCopyLink(item)}>
                      <Link size={13} /> 链接
                    </button>
                    <button className="link-btn danger" onClick={() => handleDelete(item)}>
                      <Trash2 size={13} /> 删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="file-pagination">
          <span>共 {total} 条</span>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
          <span>第 {page} / {totalPages} 页</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</button>
        </div>
      )}
      <DownloadLinkModal visible={!!dlModalItem} fileItem={dlModalItem} onClose={() => setDlModalItem(null)} />
    </div>
  );
};

export default FileManagement;
