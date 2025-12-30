/**
 * 文档表单组件
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { DocItem, createPersonalDoc, updatePersonalDoc, createPublicDoc, updatePublicDoc, createDocument, updateDocument } from '../../../services/knowledge';
import toast from '../../../components/Toast';
import './DocForm.css';

interface DocFormProps {
  visible: boolean;
  doc: DocItem | null;
  onClose: () => void;
  onSuccess: (doc: DocItem) => void;
  type: 'personal' | 'public' | 'document';
}

const DocForm = ({ visible, doc, onClose, onSuccess, type }: DocFormProps) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    content: '',
    category: ''
  });

  const isEdit = !!doc;

  useEffect(() => {
    if (visible && doc) {
      setForm({
        title: doc.title || '',
        content: doc.content || '',
        category: doc.category || ''
      });
    } else if (visible) {
      setForm({ title: '', content: '', category: '' });
    }
  }, [visible, doc]);

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error('请输入文档标题');
      return;
    }
    if (!form.content.trim()) {
      toast.error('请输入文档内容');
      return;
    }

    setLoading(true);
    try {
      const data = {
        id: doc?.id,
        title: form.title,
        content: form.content,
        category: form.category
      };

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
        onSuccess({ ...data, id: doc?.id || 0 } as DocItem);
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
            <input
              type="text"
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              placeholder="请输入分类（可选）"
            />
          </div>

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
