/**
 * 公开文档上传对话框
 */

import { useState, useRef } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import { createPublicDoc, updatePublicDoc, getPublicDocList, DocItem, ProjectOption } from '../../../../services/knowledge';
import { confirmButtons } from '../../../../components/ConfirmModal';
import type { DictItem } from '../../../../services/system/dict';

import toast from '../../../../components/Toast';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: (doc: DocItem) => void;
  categoryOptions: DictItem[];
  projectOptions: ProjectOption[];
}

/** 读取文件为文本 */
const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve(ev.target?.result as string || '');
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
};

const UploadDialog = ({ visible, onClose, onSuccess, categoryOptions, projectOptions }: Props) => {
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ title: '', project: '', category: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith('.md')) { toast.error('只能上传 Markdown 文件'); return; }
    setFile(f);
    if (!form.title) setForm(prev => ({ ...prev, title: f.name.replace(/\.md$/, '') }));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith('.md') && fileInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(f);
      fileInputRef.current.files = dt.files;
      handleFileChange({ target: fileInputRef.current } as any);
    }
  };

  const handleSubmit = async () => {
    if (!form.title || !form.project || !form.category || !file) { toast.error('请填写完整信息'); return; }
    setUploading(true);
    try {
      // 提交时读取文件内容（与 Vue 版本一致）
      const content = await readFileAsText(file);
      const params = { title: form.title, project: form.project, category: form.category, content };

      // 检查同名文档（独立 try-catch，失败不阻塞上传）
      let existing: DocItem | null = null;
      try {
        const listRes = await getPublicDocList({ project: form.project });
        const list = listRes.code === 200 ? (Array.isArray(listRes.data) ? listRes.data : []) : [];
        existing = list.find((d: DocItem) => d.title === form.title) || null;
      } catch (e) {
        console.warn('[UploadDialog] 检查同名文档失败，跳过:', e);
      }

      if (existing) {
        const choice = await confirmButtons({
          title: '文档已存在',
          content: `标题"${form.title}"已存在，请选择操作：`,
          type: 'warning',
          buttons: [
            { text: '取消', type: 'cancel' },
            { text: '覆盖文档', type: 'warning' },
            { text: '新建文档', type: 'primary' },
          ],
        });
        if (choice === 0) return; // 取消
        if (choice === 1) {
          // 覆盖
          const res = await updatePublicDoc({ id: existing.id, ...params });
          if (res.code === 200) { toast.success('覆盖成功'); onSuccess({ id: existing.id, ...params } as DocItem); handleClose(); }
        } else if (choice === 2) {
          // 新建
          const res = await createPublicDoc(params);
          if (res.code === 200) { toast.success('新增成功'); onSuccess({ id: 0, ...params } as DocItem); handleClose(); }
        }
      } else {
        const res = await createPublicDoc(params);
        if (res.code === 200) { toast.success('上传成功'); onSuccess({ id: 0, ...params } as DocItem); handleClose(); }
      }
    } catch (err) { toast.error('上传失败: ' + (err instanceof Error ? err.message : String(err))); }
    finally { setUploading(false); }
  };

  const handleClose = () => { setFile(null); setForm({ title: '', project: '', category: '' }); onClose(); };

  const canUpload = file && form.title && form.project && form.category;

  if (!visible) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content upload-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>上传文件</h3><button onClick={handleClose}><X size={18} /></button></div>
        <div className="modal-body">
          <div className="upload-area" onDrop={handleDrop} onDragOver={e => e.preventDefault()} onClick={() => fileInputRef.current?.click()}>
            <input ref={fileInputRef} type="file" accept=".md" onChange={handleFileChange} hidden />
            {file ? <><FileText size={32} /><span>{file.name}</span></> : <><Upload size={32} /><span>拖拽或点击上传 .md 文件</span></>}
          </div>
          <div className="form-group"><label>文档标题 *</label><input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="请输入标题" /></div>
          <div className="form-group"><label>所属项目 *</label>
            <select value={form.project} onChange={e => setForm(p => ({ ...p, project: e.target.value }))}>
              <option value="">请选择项目</option>
              {projectOptions.map(p => <option key={p.project} value={p.project}>{p.project_name}</option>)}
            </select>
          </div>
          <div className="form-group"><label>文档分类 *</label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              <option value="">请选择</option>
              {categoryOptions.map(c => <option key={c.item_key} value={c.item_key}>{c.item_value}</option>)}
            </select>
          </div>
          {file && <div className="preview-section"><h4>预览</h4><div className="preview-content"><span style={{ color: 'var(--text-secondary, #888)', fontSize: 13 }}>上传后可预览内容</span></div></div>}
        </div>
        <div className="modal-footer">
          <button className="btn-default" onClick={handleClose}>取消</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={uploading || !canUpload}>{uploading ? '上传中...' : '确认上传'}</button>
        </div>
      </div>
    </div>
  );
};

export default UploadDialog;