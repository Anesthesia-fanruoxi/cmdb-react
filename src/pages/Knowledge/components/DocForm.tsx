/**
 * 文档表单组件 —— 居中弹框 + 左右分屏（左编辑 / 右实时预览）
 */

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import {
  DocItem, createPersonalDoc, updatePersonalDoc,
  createPublicDoc, updatePublicDoc,
  createDocument, updateDocument, ProjectOption,
} from '../../../services/knowledge';
import type { DictItem } from '../../../services/system/dict';
import toast from '../../../components/Toast';
import MarkdownView from '../../../components/Markdown';
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

const DocForm = ({
  visible, doc, onClose, onSuccess, type,
  projectOptions = [], categoryOptions = [],
}: DocFormProps) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: '', project: '' });
  const isEdit = !!doc;

  // 同步滚动：基于源码行号锚点插值映射
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef<'editor' | 'preview' | null>(null);

  const clearSyncing = () => {
    requestAnimationFrame(() => requestAnimationFrame(() => { syncingRef.current = null; }));
  };

  const getLineHeight = () => {
    const ta = editorRef.current;
    if (!ta) return 20;
    return parseFloat(getComputedStyle(ta).lineHeight) || 20;
  };

  const getAnchors = (): { line: number; top: number }[] => {
    const pv = previewRef.current;
    if (!pv) return [];
    const els = pv.querySelectorAll<HTMLElement>('[data-source-line]');
    const pvTop = pv.getBoundingClientRect().top;
    return Array.from(els)
      .map(el => ({
        line: parseInt(el.getAttribute('data-source-line') || '0', 10),
        top: el.getBoundingClientRect().top - pvTop + pv.scrollTop,
      }))
      .sort((a, b) => a.line - b.line);
  };

  const handleEditorScroll = () => {
    if (syncingRef.current === 'preview') return;
    const ta = editorRef.current;
    const pv = previewRef.current;
    if (!ta || !pv) return;
    const anchors = getAnchors();
    if (!anchors.length) return;
    const topLine = ta.scrollTop / getLineHeight();
    let i = 0;
    while (i < anchors.length && anchors[i].line <= topLine) i++;
    const prev = anchors[i - 1];
    const next = anchors[i];
    let pvScroll: number;
    if (!prev) pvScroll = next.top;
    else if (!next) pvScroll = prev.top;
    else {
      const ratio = (topLine - prev.line) / Math.max(next.line - prev.line, 1);
      pvScroll = prev.top + (next.top - prev.top) * ratio;
    }
    syncingRef.current = 'editor';
    pv.scrollTop = pvScroll;
    clearSyncing();
  };

  const handlePreviewScroll = () => {
    if (syncingRef.current === 'editor') return;
    const ta = editorRef.current;
    const pv = previewRef.current;
    if (!ta || !pv) return;
    const anchors = getAnchors();
    if (!anchors.length) return;
    const pvScroll = pv.scrollTop;
    let i = 0;
    while (i < anchors.length && anchors[i].top <= pvScroll) i++;
    const prev = anchors[i - 1];
    const next = anchors[i];
    let line: number;
    if (!prev) line = next.line;
    else if (!next) line = prev.line;
    else {
      const ratio = (pvScroll - prev.top) / Math.max(next.top - prev.top, 1);
      line = prev.line + (next.line - prev.line) * ratio;
    }
    syncingRef.current = 'preview';
    ta.scrollTop = line * getLineHeight();
    clearSyncing();
  };

  useEffect(() => {
    if (visible && doc) {
      setForm({
        title: doc.title || '',
        content: doc.content || '',
        category: doc.category || '',
        project: (doc as any).project || '',
      });
    } else if (visible) {
      setForm({ title: '', content: '', category: '', project: '' });
    }
  }, [visible, doc]);

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('请输入文档标题'); return; }
    if (form.title.trim().length < 2 || form.title.trim().length > 50) {
      toast.error('标题长度需在 2 到 50 个字符之间'); return;
    }
    if (!form.content.trim()) { toast.error('请输入文档内容'); return; }
    if (type === 'document' && !form.project) { toast.error('请选择所属项目'); return; }
    // personal / document 类型 category 必填（与后端校验一致）
    if ((type === 'personal' || type === 'document') && !form.category) {
      toast.error('请选择文档分类'); return;
    }

    setLoading(true);
    try {
      // 按类型构造提交数据：personal/public 不传 project 字段
      const baseData = { id: doc?.id, title: form.title, content: form.content, category: form.category };
      const docData = { ...baseData, project: form.project };
      let res;
      if (type === 'personal') {
        res = isEdit ? await updatePersonalDoc(baseData) : await createPersonalDoc(baseData);
      } else if (type === 'document') {
        res = isEdit ? await updateDocument(doc!.id, docData) : await createDocument(docData);
      } else {
        res = isEdit ? await updatePublicDoc(baseData) : await createPublicDoc(baseData);
      }
      if (res.code === 200) {
        toast.success(isEdit ? '更新成功' : '创建成功');
        onSuccess({ ...docData, id: doc?.id || (res.data as any)?.id || 0 } as DocItem);
      }
    } catch (err) {
      toast.error(isEdit ? '更新失败' : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="doc-form-overlay" onClick={onClose}>
      <div className="doc-form-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? '编辑文档' : '新建文档'}</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-meta">
          <div className="form-item title-item">
            <label>标题</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="请输入文档标题"
              maxLength={50}
            />
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

          <div className="form-item">
            <label>分类</label>
            {(type === 'document' || type === 'personal' || type === 'public') && categoryOptions.length > 0 ? (
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">请选择分类</option>
                {categoryOptions.map(c => <option key={c.key} value={c.key}>{c.value}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                placeholder="可选"
              />
            )}
          </div>
        </div>

        <div className="modal-body">
          <div className="split-pane editor-pane">
            <div className="pane-title">编辑</div>
            <textarea
              ref={editorRef}
              className="md-editor"
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              onScroll={handleEditorScroll}
              placeholder="请输入文档内容，支持 Markdown 格式"
            />
          </div>
          <div className="split-pane preview-pane">
            <div className="pane-title">预览</div>
            <div className="md-preview" ref={previewRef} onScroll={handlePreviewScroll}>
              {form.content
                ? <MarkdownView content={form.content} />
                : <div className="md-empty">在左侧输入 Markdown 内容</div>}
            </div>
          </div>
        </div>

        <div className="modal-footer">
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
