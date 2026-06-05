/**
 * 公开文档上传对话框
 */

import { useState, useRef } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import { createPublicDoc, updatePublicDoc, getPublicDocList, DocItem } from '../../../../services/knowledge';
import { confirm } from '../../../../components/ConfirmModal';
import type { DictItem } from '../../../../services/system/dict';
import Markdown from '../../../../components/Markdown';
import toast from '../../../../components/Toast';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: (doc: DocItem) => void;
  categoryOptions: DictItem[];
}

const UploadDialog = ({ visible, onClose, onSuccess, categoryOptions }: Props) => {
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ title: '', category: '', content: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith('.md')) { toast.error('只能上传 Markdown 文件'); return; }
    setFile(f);
    if (!form.title) setForm(prev => ({ ...prev, title: f.name.replace(/\.md$/, '') }));
    const reader = new FileReader();
    reader.onload = (ev) => setForm(prev => ({ ...prev, content: ev.target?.result as string || '' }));
    reader.readAsText(f);
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
    if (!form.title || !form.category || !form.content) { toast.error('请填写完整信息'); return; }
    setUploading(true);
    try {
      // 检查同名文档
      const listRes = await getPublicDocList();
      const list = listRes.code === 200 ? (listRes.data as any)?.list || [] : [];
      const existing = list.find((d: any) => d.title === form.title);

      if (existing) {
        const isOverwrite = await confirm({
          title: '文档已存在',
          content: `标题"${form.title}"已存在，是否覆盖？\n选择"取消"将新增一份`,
          type: 'warning',
        });
        if (isOverwrite) {
          const res = await updatePublicDoc({ id: existing.id, ...form });
          if (res.code === 200) { toast.success('覆盖成功'); onSuccess({ id: existing.id, ...form } as any); handleClose(); }
        } else {
          const res = await createPublicDoc(form);
          if (res.code === 200) { toast.success('新增成功'); onSuccess({ id: 0, ...form } as any); handleClose(); }
        }
      } else {
        const res = await createPublicDoc(form);
        if (res.code === 200) { toast.success('上传成功'); onSuccess({ id: 0, ...form } as any); handleClose(); }
      }
    } catch (err) { toast.error('上传失败'); }
    finally { setUploading(false); }
  };

  const handleClose = () => { setFile(null); setForm({ title: '', category: '', content: '' }); onClose(); };

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
          <div className="form-group"><label>文档分类 *</label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              <option value="">请选择</option>
              {categoryOptions.map(c => <option key={c.key} value={c.key}>{c.value}</option>)}
            </select>
          </div>
          {form.content && <div className="preview-section"><h4>预览</h4><div className="preview-content"><Markdown content={form.content} /></div></div>}
        </div>
        <div className="modal-footer">
          <button className="btn-default" onClick={handleClose}>取消</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={uploading}>{uploading ? '上传中...' : '确认上传'}</button>
        </div>
      </div>
    </div>
  );
};

export default UploadDialog;