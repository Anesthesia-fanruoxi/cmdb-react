/**
 * 上传明细弹窗
 */

import { useState, useEffect } from 'react';
import { X, FileText, Check, AlertCircle, Loader2 } from 'lucide-react';
import { uploadFile } from '../../../services/assets/file';

export interface UploadFileItem {
  file: File;
  path: string;  // 相对路径（目录结构）
}

interface Props {
  visible: boolean;
  files: UploadFileItem[];
  project: string;
  fileKey: string;
  targetPath: string;
  onClose: () => void;
  onSuccess: () => void;
}

type FileStatus = 'pending' | 'uploading' | 'success' | 'error';

interface FileState {
  name: string;
  size: number;
  path: string;
  status: FileStatus;
  error?: string;
}

const formatSize = (size: number) => {
  if (!size) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(size) / Math.log(k));
  return (size / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
};

const UploadDialog = ({ visible, files, project, fileKey, targetPath, onClose, onSuccess }: Props) => {
  const [fileStates, setFileStates] = useState<FileState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDone, setIsDone] = useState(false);

  // 初始化文件状态
  useEffect(() => {
    if (visible && files.length > 0) {
      setFileStates(files.map(f => ({
        name: f.file.name,
        size: f.file.size,
        path: f.path,
        status: 'pending'
      })));
      setIsDone(false);
      startUpload();
    }
  }, [visible, files]);

  const startUpload = async () => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    
    // 更新所有为上传中
    setFileStates(prev => prev.map(f => ({ ...f, status: 'uploading' as FileStatus })));

    try {
      const formData = new FormData();
      formData.append('project', project);
      formData.append('key', fileKey);
      if (targetPath) formData.append('path', targetPath);
      
      files.forEach(item => {
        formData.append('file', item.file);
        formData.append('filePath', item.path);
      });

      const res = await uploadFile(formData);
      
      if (res.code === 200) {
        setFileStates(prev => prev.map(f => ({ ...f, status: 'success' as FileStatus })));
        onSuccess();
      } else {
        setFileStates(prev => prev.map(f => ({ 
          ...f, 
          status: 'error' as FileStatus, 
          error: res.message || '上传失败' 
        })));
      }
    } catch (err) {
      setFileStates(prev => prev.map(f => ({ 
        ...f, 
        status: 'error' as FileStatus, 
        error: '上传出错' 
      })));
    } finally {
      setIsUploading(false);
      setIsDone(true);
    }
  };

  if (!visible) return null;

  const successCount = fileStates.filter(f => f.status === 'success').length;
  const errorCount = fileStates.filter(f => f.status === 'error').length;

  return (
    <div className="upload-dialog-overlay" onClick={isDone ? onClose : undefined}>
      <div className="upload-dialog" onClick={e => e.stopPropagation()}>
        <div className="upload-dialog-header">
          <span className="upload-dialog-title">
            {isUploading ? '上传中...' : isDone ? '上传完成' : '准备上传'}
          </span>
          {isDone && (
            <button className="upload-dialog-close" onClick={onClose}><X size={18} /></button>
          )}
        </div>
        
        <div className="upload-dialog-body">
          <div className="upload-file-list">
            {fileStates.map((f, i) => (
              <div key={i} className={`upload-file-item ${f.status}`}>
                <FileText size={16} className="upload-file-icon" />
                <div className="upload-file-info">
                  <span className="upload-file-name" title={f.path ? `${f.path}/${f.name}` : f.name}>
                    {f.path ? `${f.path}/` : ''}{f.name}
                  </span>
                  <span className="upload-file-size">{formatSize(f.size)}</span>
                </div>
                <div className="upload-file-status">
                  {f.status === 'pending' && <span className="status-text">等待</span>}
                  {f.status === 'uploading' && <Loader2 size={16} className="status-icon spinning" />}
                  {f.status === 'success' && <Check size={16} className="status-icon success" />}
                  {f.status === 'error' && <AlertCircle size={16} className="status-icon error" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {isDone && (
          <div className="upload-dialog-footer">
            <span className="upload-summary">
              共 {fileStates.length} 个文件，成功 {successCount} 个
              {errorCount > 0 && `，失败 ${errorCount} 个`}
            </span>
            <button className="btn-primary" onClick={onClose}>关闭</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadDialog;
