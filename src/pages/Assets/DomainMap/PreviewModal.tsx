/**
 * nginx 配置预览弹框
 */

import { useEffect, useState, useRef } from 'react';
import hljs from 'highlight.js/lib/core';
import nginx from 'highlight.js/lib/languages/nginx';
import 'highlight.js/styles/atom-one-dark.css';
import { previewDomainMap } from '../../../services/assets/domainMap';
import toast from '../../../components/Toast';

hljs.registerLanguage('nginx', nginx);

interface PreviewModalProps {
  visible: boolean;
  project: string;
  serverName: string;
  onClose: () => void;
}

const PreviewModal = ({ visible, project, serverName, onClose }: PreviewModalProps) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ server_name: string; output_file: string; content: string } | null>(null);
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!visible || !serverName) return;
    setLoading(true);
    setData(null);
    previewDomainMap(project, serverName)
      .then(res => {
        if (res.code === 200 && res.data) {
          setData(res.data);
        } else {
          toast.error(res.message || '预览失败');
          onClose();
        }
      })
      .catch(() => {
        toast.error('预览失败');
        onClose();
      })
      .finally(() => setLoading(false));
  }, [visible, project, serverName, onClose]);

  useEffect(() => {
    if (data?.content && codeRef.current) {
      codeRef.current.textContent = data.content;
      hljs.highlightElement(codeRef.current);
    }
  }, [data]);

  if (!visible) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content dm-preview-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>nginx 配置预览{data ? ` - ${data.server_name}` : ''}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {data && <div className="dm-file-path">文件路径：<code>{data.output_file}</code></div>}
          {loading ? (
            <pre className="dm-config-preview">加载中...</pre>
          ) : (
            <pre className="dm-config-preview"><code ref={codeRef} className="language-nginx">{data?.content || ''}</code></pre>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-default" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;
