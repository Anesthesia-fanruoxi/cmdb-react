/**
 * 下载链接弹框
 */

import { useState, useEffect } from 'react';
import { Copy, Download, Loader2 } from 'lucide-react';
import { generateDownloadLink, type FileItem } from '../../../../services/knowledge/file';
import { toast } from '../../../../components/AppNotification';
import { downloadWithProgress } from '../../../../utils/download';
import { getDownloadDir, openFolder } from '../../../../utils/fileSystem';
import appNotification from '../../../../components/AppNotification';

interface Props {
  visible: boolean;
  fileItem: FileItem | null;
  onClose: () => void;
}

const DownloadLinkModal = ({ visible, fileItem, onClose }: Props) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!visible || !fileItem) return;
    if (fileItem.is_private) {
      if (!fileItem.uuid) { toast.info('文件UUID不存在'); onClose(); return; }
      setLoading(true);
      setUrl('');
      generateDownloadLink(fileItem.uuid)
        .then(res => {
          if (res.code === 200 && res.data) setUrl(res.data.download_url);
          else toast.error('生成链接失败');
        })
        .catch(() => toast.error('生成链接失败'))
        .finally(() => setLoading(false));
    } else {
      setUrl(fileItem.download_url || '');
    }
  }, [visible, fileItem]);

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('链接已复制');
    } catch { toast.error('复制失败'); }
  };

  const handleDownload = async () => {
    if (!url || !fileItem) return;
    setDownloading(true);
    try {
      await downloadWithProgress({
        url,
        filename: fileItem.filename,
        onSuccess: async (result) => {
          const dir = await getDownloadDir();
          appNotification.withButtons(
            'success', '下载完成', `文件已保存: ${result.filename}`,
            [{ text: '打开文件夹', primary: true, onClick: () => openFolder(dir) }],
            8000,
          );
        },
        onError: () => toast.error('下载失败'),
      });
    } catch { toast.error('下载失败'); }
    finally { setDownloading(false); }
  };

  if (!visible || !fileItem) return null;

  return (
    <div className="dl-modal-overlay" onClick={onClose}>
      <div className="dl-modal" onClick={e => e.stopPropagation()}>
        <div className="dl-modal-header">
          <h4>下载链接</h4>
          <button className="dl-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="dl-modal-body">
          <div className="dl-modal-file">{fileItem.filename}</div>
          <div className="dl-modal-url">
            {loading ? <span className="dl-loading"><Loader2 size={14} className="spin" /> 生成链接中...</span> : (
              <input readOnly value={url} onClick={e => (e.target as HTMLInputElement).select()} />
            )}
          </div>
          <div className="dl-modal-actions">
            <button className="dl-btn dl-btn-copy" onClick={handleCopy} disabled={loading || !url}>
              <Copy size={14} /> 复制链接
            </button>
            <button className="dl-btn dl-btn-download" onClick={handleDownload} disabled={loading || !url || downloading}>
              <Download size={14} /> {downloading ? '下载中...' : '下载文件'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadLinkModal;
