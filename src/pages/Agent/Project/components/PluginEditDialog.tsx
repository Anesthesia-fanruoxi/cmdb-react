/**
 * 插件编辑对话框
 * 容器插件和二进制插件统一键值对编辑
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';
import hljs from 'highlight.js/lib/core';
import yamlLang from 'highlight.js/lib/languages/yaml';
import { updatePluginConfig, Project, Plugin } from '@/services/agent/project';
import toast from '@/components/Toast';

hljs.registerLanguage('yaml', yamlLang);

interface Props {
  visible: boolean;
  plugin: Plugin | null;
  project: Project | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface ConfigItem { key: string; value: string; }

type EditMode = 'kv' | 'file';

const PluginEditDialog = ({ visible, plugin, project, onClose, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [containerPort, setContainerPort] = useState<number | undefined>();
  const [configList, setConfigList] = useState<ConfigItem[]>([]);
  const [originalConfig, setOriginalConfig] = useState<Record<string, string>>({});
  const [editMode, setEditMode] = useState<EditMode>('kv');
  const [fileContent, setFileContent] = useState('');
  const [originalFileContent, setOriginalFileContent] = useState('');

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  const highlighted = useMemo(() => {
    try {
      return hljs.highlight(fileContent || '', { language: 'yaml' }).value || '&nbsp;';
    } catch {
      return (fileContent || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
    }
  }, [fileContent]);

  const syncScroll = () => {
    if (highlightRef.current && editorRef.current) {
      highlightRef.current.scrollTop = editorRef.current.scrollTop;
      highlightRef.current.scrollLeft = editorRef.current.scrollLeft;
    }
  };

  // 是否支持 YAML 文件编辑（仅 binary 且接口返回了 config_file_content）
  const supportFileEdit = plugin?.category === 'binary' && plugin?.config_file_content !== undefined;

  useEffect(() => {
    if (visible && plugin) {
      setContainerPort(plugin.container_port);
      const config = plugin.config || {};
      setOriginalConfig(config);
      const configs = Object.entries(config).map(([key, value]) => ({ key, value }));
      setConfigList(configs.length > 0 ? configs : [{ key: '', value: '' }]);
      const fc = plugin.config_file_content || '';
      setFileContent(fc);
      setOriginalFileContent(fc);
      setEditMode(plugin.category === 'binary' && fc ? 'file' : 'kv');
    }
  }, [visible, plugin]);

  // ESC 关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) onClose();
    };
    if (visible) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [visible, onClose]);

  const handleAddConfig = () => setConfigList(prev => [...prev, { key: '', value: '' }]);
  const handleRemoveConfig = (index: number) => setConfigList(prev => prev.filter((_, i) => i !== index));
  const handleConfigChange = (index: number, field: 'key' | 'value', value: string) => {
    setConfigList(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const handleSubmit = async () => {
    if (!plugin || !project) return;

    setLoading(true);
    try {
      // YAML 文件整体覆盖模式
      if (editMode === 'file') {
        if (fileContent === originalFileContent) {
          toast.warning('配置未修改');
          setLoading(false);
          return;
        }
        const res = await updatePluginConfig({
          project: project.project,
          name: plugin.name,
          config_file_content: fileContent,
        });
        if (res.code === 200) {
          toast.success('保存成功');
          onSuccess();
          onClose();
        } else {
          toast.error(res.message || '保存失败');
        }
        return;
      }

      // 键值对增量模式
      const hasEmpty = configList.some(item => (item.key && !item.value) || (!item.key && item.value));
      if (hasEmpty) { toast.warning('请填写完整的配置信息或删除空配置'); setLoading(false); return; }

      const currentConfigMap: Record<string, string> = {};
      configList.forEach(item => { if (item.key && item.value) currentConfigMap[item.key] = item.value; });

      const config_set: Record<string, string> = {};
      const config_delete: string[] = [];

      Object.keys(currentConfigMap).forEach(key => {
        const cur = currentConfigMap[key];
        const orig = originalConfig[key];
        if (orig === undefined) {
          config_set[key] = cur;
        } else if (orig !== cur && !(orig === '******' && cur === '******')) {
          config_set[key] = cur;
        }
      });
      Object.keys(originalConfig).forEach(key => {
        if (currentConfigMap[key] === undefined) config_delete.push(key);
      });

      const hasConfigChange = Object.keys(config_set).length > 0 || config_delete.length > 0;
      const portChanged = containerPort !== plugin.container_port;

      if (!hasConfigChange && !portChanged) {
        toast.warning('没有任何修改');
        setLoading(false);
        return;
      }

      const res = await updatePluginConfig({
        project: project.project,
        name: plugin.name,
        ...(Object.keys(config_set).length > 0 && { config_set }),
        ...(config_delete.length > 0 && { config_delete }),
      });

      if (res.code === 200) {
        toast.success('保存成功');
        onSuccess();
        onClose();
      } else {
        toast.error(res.message || '保存失败');
      }
    } catch (e) {
      const err = e as Error;
      console.error('[PluginEditDialog] 保存失败:', err.message);
      toast.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
        <div className="modal-content pe-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>编辑插件 - {plugin?.name}</h3>
            <button className="close-btn" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="modal-body">
            {plugin?.category === 'container' && (
              <div className="pe-form-item">
                <label>容器端口</label>
                <input
                  type="number"
                  value={containerPort || ''}
                  onChange={e => setContainerPort(Number(e.target.value) || undefined)}
                  placeholder="8080"
                  min={1}
                  max={65535}
                  className="pe-port-input"
                />
              </div>
            )}

            {supportFileEdit && (
              <div className="pe-tabs">
                <button
                  className={`pe-tab ${editMode === 'file' ? 'active' : ''}`}
                  onClick={() => setEditMode('file')}
                >配置文件 (YAML)</button>
                <button
                  className={`pe-tab ${editMode === 'kv' ? 'active' : ''}`}
                  onClick={() => setEditMode('kv')}
                >环境变量</button>
              </div>
            )}

            {editMode === 'file' ? (
              <div className="pe-form-item">
                <label>配置文件内容</label>
                <div className="pe-editor-wrap">
                  <pre ref={highlightRef} className="pe-yaml-highlight hljs" aria-hidden="true">
                    <code dangerouslySetInnerHTML={{ __html: highlighted + '\n' }} />
                  </pre>
                  <textarea
                    ref={editorRef}
                    value={fileContent}
                    onChange={e => setFileContent(e.target.value)}
                    onScroll={syncScroll}
                    className="pe-yaml-editor"
                    spellCheck={false}
                    placeholder="# YAML 配置内容"
                  />
                </div>
                <div className="pe-tip">保存后将整体覆盖插件配置文件并重启服务</div>
              </div>
            ) : (
              <div className="pe-form-item">
                <label>配置参数</label>
                <div className="pe-config-list">
                  {configList.map((item, index) => (
                    <div key={index} className="pe-config-row">
                      <input
                        type="text" value={item.key}
                        onChange={e => handleConfigChange(index, 'key', e.target.value)}
                        placeholder="参数名"
                        className="pe-config-key"
                      />
                      <span className="pe-sep">=</span>
                      <input
                        type="text" value={item.value}
                        onChange={e => handleConfigChange(index, 'value', e.target.value)}
                        placeholder="参数值"
                        className="pe-config-val"
                      />
                      <button className="pe-btn-remove" onClick={() => handleRemoveConfig(index)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button className="pe-btn-add" onClick={handleAddConfig}>
                    <Plus size={14} /> 添加配置
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn-default" onClick={onClose}>取消</button>
            <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 size={14} className="spin" />} 保存
            </button>
          </div>
        </div>
      </div>
      <style>{`
        .pe-modal { width: 90vw; max-width: 1100px; max-height: 88vh; display: flex; flex-direction: column; }
        .pe-modal .modal-body { flex: 1; overflow-y: auto; max-height: calc(88vh - 120px); }
        .pe-form-item { margin-bottom: 16px; }
        .pe-form-item label { display: block; margin-bottom: 8px; font-size: 14px; color: var(--text-color); font-weight: 500; }
        .pe-port-input { width: 200px; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-color); font-size: 13px; }
        .pe-config-list { display: flex; flex-direction: column; gap: 10px; }
        .pe-config-row { display: flex; align-items: center; gap: 8px; }
        .pe-config-key, .pe-config-val { flex: 1; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-color); font-size: 13px; }
        .pe-sep { font-weight: bold; color: var(--text-secondary); }
        .pe-btn-remove { background: none; border: none; cursor: pointer; padding: 6px; color: #ff4d4f; border-radius: 4px; }
        .pe-btn-remove:hover { background: rgba(255, 77, 79, 0.1); }
        .pe-btn-add { display: flex; align-items: center; gap: 4px; padding: 8px 12px; background: var(--bg-secondary); border: 1px dashed var(--border-color); border-radius: 6px; cursor: pointer; font-size: 13px; color: var(--primary-color); }
        .pe-btn-add:hover { border-color: var(--primary-color); }
        .pe-tabs { display: flex; gap: 4px; margin-bottom: 14px; border-bottom: 1px solid var(--border-color); }
        .pe-tab { background: none; border: none; padding: 8px 14px; cursor: pointer; font-size: 13px; color: var(--text-secondary); border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.2s; }
        .pe-tab:hover { color: var(--text-color); }
        .pe-tab.active { color: var(--primary-color); border-bottom-color: var(--primary-color); font-weight: 500; }
        .pe-yaml-editor { width: 100%; min-height: 480px; padding: 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-color); font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; line-height: 1.6; resize: vertical; tab-size: 2; }
        .pe-yaml-editor:focus { outline: none; border-color: var(--primary-color); }
        .pe-tip { margin-top: 6px; font-size: 12px; color: var(--text-secondary); }
        .pe-editor-wrap { position: relative; width: 100%; height: 480px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); overflow: hidden; resize: vertical; min-height: 240px; }
        .pe-editor-wrap:focus-within { border-color: var(--primary-color); }
        .pe-editor-wrap .pe-yaml-highlight,
        .pe-editor-wrap .pe-yaml-editor { position: absolute; inset: 0; margin: 0; padding: 12px; border: none; outline: none; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; line-height: 1.6; white-space: pre; word-wrap: normal; overflow-wrap: normal; tab-size: 2; overflow: auto; box-sizing: border-box; }
        .pe-editor-wrap .pe-yaml-highlight { pointer-events: none; background: transparent; color: var(--text-color); }
        .pe-editor-wrap .pe-yaml-highlight code { font: inherit; background: transparent; padding: 0; display: block; min-height: 100%; }
        .pe-editor-wrap .pe-yaml-editor { background: transparent; color: transparent; caret-color: var(--text-color); resize: none; min-height: 0; border-radius: 0; }
        .pe-editor-wrap .pe-yaml-editor::selection { background: rgba(24, 144, 255, 0.35); }
        /* YAML 高亮色彩（深色主题） */
        .pe-yaml-highlight .hljs-attr { color: #79b8ff; }
        .pe-yaml-highlight .hljs-string { color: #9ecbff; }
        .pe-yaml-highlight .hljs-comment { color: #6a737d; font-style: italic; }
        .pe-yaml-highlight .hljs-number { color: #f78c6c; }
        .pe-yaml-highlight .hljs-literal,
        .pe-yaml-highlight .hljs-built_in { color: #f97583; }
        .pe-yaml-highlight .hljs-bullet,
        .pe-yaml-highlight .hljs-meta { color: #f97583; }
        .pe-yaml-highlight .hljs-type { color: #b392f0; }
      `}</style>
    </>
  );
};

export default PluginEditDialog;
