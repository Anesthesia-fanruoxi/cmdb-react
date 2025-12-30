/**
 * 文档表单组件
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { DocItem, createPersonalDoc, updatePersonalDoc, createPublicDoc, updatePublicDoc, createDocument, updateDocument, ProjectOption } from '../../../services/knowledge';
import type { DictItem } from '../../../services/system/dict';
import toast from '../../../components/Toast';
import './DocForm.css';

export interface DocFormProps {
  visible: boolean;
  doc: DocItem | null;
  onClose: () => void;
  onSuccess: (doc: DocItem) => void;
  type: 'personal' | 'public' | 'document';
  projectOptions?: ProjectOption[];
  categoryOptions?: DictItem[];
}

const DocForm = ({ visible, doc, onClose, onSuccess, type, projectOptions = [], categoryOptions = [] }: DocFormProps) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: '', project: '' });
  const isEdit = !!doc;

  useEffect(() => {
    if (visible && doc) {
      setForm({ title: doc.title || '', content: doc.content || '', category: doc.category || '', project: (doc as any).project || '' });
    } else if (visible) {
      setForm({ title: '', content: '', category: '', project: '' });
    }
  }, [visible, doc]);

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('请输入文档标题'); return; }
    if (!form.content.trim()) { toast.error('请输入文档内容'); return; }
    if (type === 'document' && !form.project) { toast.error('请选择所属项目'); return; }
    if (type === 'document' && !form.category) { toast.error('请选择文档分类'); return; }

    setLoading(true);
    try {
      const data = { id: doc?.id, title: form.title, content: form.content, category: form.category, project: form.project };
      let res;
      if (type === 'personal') {
        res = isEdit ? await updatePersonalDoc(data) : await createPersonalDoc(data);
      } else if (type === 'document') {
        res = isEdit ? await updateDocument(doc!.id, data) : await createDocument(data);
      } else {
        res = isEdit ? await updatePublicDoc(data) : await createPublicDoc(data);
      }
      if (res.code === 200) {
        toast.success(isEdit ? '更新成功' : '创建成功');
        onSuccess({ ...data, id: doc?.id || (res.data as any)?.id || 0 } as DocItem);
      }
    } catch (err) {
      toast.error(isEdit ? '更新失败' : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="doc-form-overlay">
      <div className="doc-form-drawer">
        <div className="drawer-header">
          <h3>{isEdit ? '编辑文档' : '新建文档'}</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="drawer-content">
          <div className="form-item">
            <label>文档标题</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="请输入文档标题"
              maxLength={50}
            />
          </div>

          <div className="form-item">
            <label>文档分类</label>
            {type === 'document' && categoryOptions.length > 0 ? (
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">请选择分类</option>
                {categoryOptions.map(c => <option key={c.key} value={c.key}>{c.value}</option>)}
              </select>
            ) : (
              <input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="请输入分类（可选）" />
            )}
          </div>

          {type === 'document' && (
            <div className="form-item">
              <label>所属项目</label>
              <select value={form.project} onChange={e => setForm({ ...form, project: e.target.value })}>
                <option value="">请选择项目</option>
                {projectOptions.map(p => <option key={p.project} value={p.project}>{p.project_name}</option>)}
              </select>
            </div>
          )}

          <div className="form-item flex-1">
            <label>文档内容</label>
            <textarea
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              placeholder="请输入文档内容，支持 Markdown 格式"
            />
          </div>
        </div>

        <div className="drawer-footer">
          <button className="btn-cancel" onClick={onClose}>取消</button>
          <button 
            className="btn-submit" 
            onClick={handleSubmit}
            disabled={loading || !form.title || !form.content}
          >
            {loading ? '提交中...' : (isEdit ? '保存' : '创建')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocForm;
