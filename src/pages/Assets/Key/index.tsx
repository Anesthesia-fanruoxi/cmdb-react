/**
 * 密钥加解密页面
 */

import { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { getKeyProjects, keyEncrypt, keyDecrypt, batchDecrypt } from '../../../services/assets/key';
import type { KeyProject, BatchDecryptResult } from '../../../services/assets/key';
import toast from '../../../components/Toast';
import './index.css';

const KeyPage = () => {
  const [projectList, setProjectList] = useState<KeyProject[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');

  // 加密
  const [encryptData, setEncryptData] = useState('');
  const [encryptResult, setEncryptResult] = useState('');
  const [encryptLoading, setEncryptLoading] = useState(false);

  // 解密
  const [decryptData, setDecryptData] = useState('');
  const [decryptResult, setDecryptResult] = useState('');
  const [decryptLoading, setDecryptLoading] = useState(false);

  // 批量解密
  const [batchData, setBatchData] = useState('');
  const [batchResults, setBatchResults] = useState<BatchDecryptResult[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  const batchDataCount = useMemo(() => {
    if (!batchData.trim()) return 0;
    return batchData.trim().split('\n').filter(l => l.trim()).length;
  }, [batchData]);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setProjectLoading(true);
    try {
      const res = await getKeyProjects();
      if (res.code === 200 && res.data) {
        const items = res.data.items || res.data || [];
        setProjectList(Array.isArray(items) ? items : []);
      }
    } catch (err) {
      console.error('获取项目列表失败:', err);
    } finally {
      setProjectLoading(false);
    }
  };

  const handleProjectSelect = (project: string) => {
    setSelectedProject(project);
    setEncryptResult('');
    setDecryptResult('');
    setBatchResults([]);
  };

  const handleEncrypt = async () => {
    if (!encryptData.trim()) { toast.warning('请输入要加密的数据'); return; }
    if (!selectedProject) { toast.warning('请先选择项目'); return; }
    setEncryptLoading(true);
    try {
      const res = await keyEncrypt(encryptData.trim(), selectedProject);
      if (res.code === 200 && res.data) {
        setEncryptResult(res.data.encryptedData);
      } else {
        toast.error(res.message || '加密失败');
      }
    } catch (err) {
      toast.error('加密失败');
    } finally {
      setEncryptLoading(false);
    }
  };

  const handleDecrypt = async () => {
    if (!decryptData.trim()) { toast.warning('请输入要解密的数据'); return; }
    if (!selectedProject) { toast.warning('请先选择项目'); return; }
    setDecryptLoading(true);
    try {
      const res = await keyDecrypt(decryptData.trim(), selectedProject);
      if (res.code === 200 && res.data) {
        setDecryptResult(res.data.data);
      } else {
        toast.error(res.message || '解密失败');
      }
    } catch (err) {
      toast.error('解密失败');
    } finally {
      setDecryptLoading(false);
    }
  };

  const handleBatchDecrypt = async () => {
    if (!batchData.trim()) { toast.warning('请输入要批量解密的数据'); return; }
    if (!selectedProject) { toast.warning('请先选择项目'); return; }
    const dataArray = batchData.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (dataArray.length > 20) {
      toast.error(`批量解密一次最多支持20个数据，当前提交了${dataArray.length}个`);
      return;
    }
    setBatchLoading(true);
    try {
      const res = await batchDecrypt(dataArray, selectedProject);
      if (res.code === 200 && Array.isArray(res.data)) {
        setBatchResults(res.data.filter(item => item.encrypted && item.decrypted));
      } else {
        toast.error(res.message || '批量解密失败');
      }
    } catch (err) {
      toast.error('批量解密失败');
    } finally {
      setBatchLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    if (!text?.trim()) { toast.warning('没有内容可复制'); return; }
    try {
      await navigator.clipboard.writeText(text);
      toast.success('复制成功');
    } catch {
      toast.error('复制失败');
    }
  };

  return (
    <div className="key-page">
      <div className="project-card">
        <div className="project-tabs">
          <span className="tabs-label">选择项目：</span>
          <div className="tabs-content">
            {projectLoading ? (
              <span className="tab-loading"><Loader2 size={14} className="spin" /> 加载中...</span>
            ) : projectList.map(p => (
              <button
                key={p.project}
                className={`tab-item ${selectedProject === p.project ? 'active' : ''}`}
                onClick={() => handleProjectSelect(p.project)}
              >
                {p.project_name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="main-content">
        <div className="left-panel">
          {/* 加密 */}
          <div className="card encrypt-card">
            <div className="card-header">数据加密</div>
            <div className="card-body">
              <div className="form-item">
                <label>要加密的数据：</label>
                <textarea rows={3} value={encryptData} onChange={e => setEncryptData(e.target.value)} placeholder="请输入要加密的数据" />
              </div>
              <button className="btn-primary" onClick={handleEncrypt} disabled={encryptLoading || !encryptData || !selectedProject}>
                {encryptLoading ? '加密中...' : '加密'}
              </button>
              <div className="form-item">
                <label>加密结果：</label>
                <textarea rows={3} readOnly value={encryptResult} placeholder="加密结果将显示在这里，双击复制" onDoubleClick={() => copyToClipboard(encryptResult)} className="result-textarea" />
              </div>
            </div>
          </div>

          {/* 解密 */}
          <div className="card decrypt-card">
            <div className="card-header">数据解密</div>
            <div className="card-body">
              <div className="form-item">
                <label>要解密的数据：</label>
                <textarea rows={3} value={decryptData} onChange={e => setDecryptData(e.target.value)} placeholder="请输入要解密的数据" />
              </div>
              <button className="btn-success" onClick={handleDecrypt} disabled={decryptLoading || !decryptData || !selectedProject}>
                {decryptLoading ? '解密中...' : '解密'}
              </button>
              <div className="form-item">
                <label>解密结果：</label>
                <textarea rows={3} readOnly value={decryptResult} placeholder="解密结果将显示在这里，双击复制" onDoubleClick={() => copyToClipboard(decryptResult)} className="result-textarea" />
              </div>
            </div>
          </div>
        </div>

        {/* 批量解密 */}
        <div className="right-panel">
          <div className="card batch-card">
            <div className="card-header">批量解密</div>
            <div className="card-body">
              <div className="form-item">
                <label>
                  批量解密数据（最多20个）：
                  {batchData && <span className={`data-count ${batchDataCount > 20 ? 'warning' : ''}`}>当前：{batchDataCount}条</span>}
                </label>
                <textarea rows={4} value={batchData} onChange={e => setBatchData(e.target.value)} placeholder="请输入要批量解密的数据，每行一个，最多支持20个" />
              </div>
              <div className="btn-group">
                <button className="btn-warning" onClick={handleBatchDecrypt} disabled={batchLoading || !batchData || !selectedProject}>
                  {batchLoading ? '解密中...' : '批量解密'}
                </button>
                {batchResults.length > 0 && (
                  <button className="btn-default" onClick={() => { setBatchResults([]); setBatchData(''); }}>清空结果</button>
                )}
              </div>
              {batchResults.length > 0 && (
                <div className="form-item">
                  <label>批量解密结果：</label>
                  <div className="batch-table-wrapper">
                    <table className="batch-table">
                      <thead><tr><th>行号</th><th>加密数据</th><th>解密结果</th></tr></thead>
                      <tbody>
                        {batchResults.map((r, i) => (
                          <tr key={i}>
                            <td className="row-num">{i + 1}</td>
                            <td className="encrypted-cell" title={r.encrypted}>{r.encrypted}</td>
                            <td className="decrypted-cell" title={`双击复制: ${r.decrypted}`} onDoubleClick={() => copyToClipboard(r.decrypted)}>{r.decrypted}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeyPage;
