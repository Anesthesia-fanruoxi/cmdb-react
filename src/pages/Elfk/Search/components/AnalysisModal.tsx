/**
 * 字段分析弹框
 */

import { useState, useMemo } from 'react';
import { X, Copy, Loader2 } from 'lucide-react';
import { analyzeField } from '../../../../services/elfk/search';
import toast from '../../../../components/Toast';
import { useMessageStore } from '../../../../stores/messageStore';
import type { ViewDetail } from '../../../../services/elfk/view';
import type { LogHit } from '../../../../services/elfk/search';
import '../styles/analysis-modal.css';

interface Props {
  visible: boolean;
  currentView: ViewDetail | null;
  searchParams: Record<string, unknown>;
  logs: LogHit[];
  total: number;
  onClose: () => void;
}

interface BucketItem { key: string; doc_count: number; }

const AnalysisModal = ({ visible, currentView, searchParams, logs, total, onClose }: Props) => {
  const addMessage = useMessageStore(state => state.addMessage);
  const [selectedField, setSelectedField] = useState('');
  const [startDelimiter, setStartDelimiter] = useState('');
  const [endDelimiter, setEndDelimiter] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ field: string; total: number; buckets: BucketItem[] } | null>(null);
  const [sampleValue, setSampleValue] = useState<string>('');

  // 获取可分析的字段
  const fields = useMemo(() => {
    if (!currentView?.all_field?.properties) return [];
    return Object.entries(currentView.all_field.properties)
      .filter(([name]) => !name.includes('.keyword'))
      .map(([name, info]) => ({ name, type: info.type || 'unknown' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [currentView]);

  // 字段变化时获取示例值
  const handleFieldChange = (fieldName: string) => {
    setSelectedField(fieldName);
    setResult(null);
    setStartDelimiter('');
    setEndDelimiter('');
    
    if (!fieldName || !logs.length) {
      setSampleValue('');
      return;
    }
    
    // 从日志中找示例值
    for (const log of logs) {
      const source = log._source || log;
      const value = (source as Record<string, unknown>)[fieldName];
      if (value !== undefined) {
        setSampleValue(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
        return;
      }
    }
    setSampleValue('未找到示例值');
  };

  const handleAnalyze = async () => {
    if (!selectedField || !searchParams.query_id) {
      toast.warning('请选择分析字段');
      return;
    }

    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        qid: searchParams.query_id,
        field: selectedField,
        log_type: currentView?.log_type || 'elfk',
        count: total || 0
      };
      if (startDelimiter) params.startDelimiter = startDelimiter;
      if (endDelimiter) params.endDelimiter = endDelimiter;

      const res = await analyzeField(params as any);
      
      if (res.code === 200 && res.data) {
        setResult(res.data);
        toast.success('分析完成');
        addMessage({
          type: 'success',
          title: '数据分析完成',
          content: `字段 ${selectedField} 分析完成，共 ${res.data.buckets?.length || 0} 个唯一值`,
        });
      } else {
        toast.error(res.message || '分析失败');
        addMessage({
          type: 'error',
          title: '数据分析失败',
          content: res.message || '分析失败',
        });
      }
    } catch (err) {
      console.error('分析失败:', err);
      toast.error('分析失败');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label}已复制`);
    }).catch(() => {
      toast.error('复制失败');
    });
  };

  const handleClose = () => {
    setSelectedField('');
    setStartDelimiter('');
    setEndDelimiter('');
    setResult(null);
    setSampleValue('');
    onClose();
  };

  if (!visible) return null;

  return (
    <div className="analysis-overlay" onClick={handleClose}>
      <div className="analysis-drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>数据分析</h3>
          <button className="btn-close" onClick={handleClose}><X size={18} /></button>
        </div>

        <div className="drawer-body">
          {/* 选择字段 */}
          <div className="form-section">
            <label>选择字段</label>
            <select value={selectedField} onChange={e => handleFieldChange(e.target.value)}>
              <option value="">请选择分析字段</option>
              {fields.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
            </select>
          </div>

          {/* 示例值 */}
          {sampleValue && (
            <div className="form-section">
              <label>示例数据</label>
              <pre className="sample-value">{sampleValue}</pre>
            </div>
          )}

          {/* 分隔符设置 */}
          {selectedField && (
            <>
              <div className="form-divider">设置分隔符（可选）</div>
              <div className="form-row">
                <div className="form-section half">
                  <label>开始分隔符</label>
                  <input value={startDelimiter} onChange={e => setStartDelimiter(e.target.value)} placeholder="可选" />
                </div>
                <div className="form-section half">
                  <label>结束分隔符</label>
                  <input value={endDelimiter} onChange={e => setEndDelimiter(e.target.value)} placeholder="可选" />
                </div>
              </div>
              <button className="btn-analyze" onClick={handleAnalyze} disabled={loading || !searchParams.query_id}>
                {loading ? <><Loader2 size={14} className="spin" /> 分析中...</> : '开始分析'}
              </button>
            </>
          )}

          {/* 分析结果 */}
          {result && result.buckets && (
            <div className="result-section">
              <div className="form-divider">分析结果 - {result.field}</div>
              <div className="result-grid">
                {/* 去重值 */}
                <ResultColumn
                  title="去重后的数据"
                  data={result.buckets.map(b => ({ value: b.key }))}
                  columns={[{ key: 'value', label: '值' }]}
                  onCopy={() => copyToClipboard(result.buckets.map(b => b.key).join('\n'), '去重数据')}
                />
                {/* 按值排序 */}
                <ResultColumn
                  title="按值升序"
                  data={[...result.buckets].sort((a, b) => a.key.localeCompare(b.key)).map(b => ({ value: b.key, count: b.doc_count }))}
                  columns={[{ key: 'value', label: '值' }, { key: 'count', label: '数量' }]}
                  onCopy={() => copyToClipboard([...result.buckets].sort((a, b) => a.key.localeCompare(b.key)).map(b => `${b.key}\t${b.doc_count}`).join('\n'), '按值排序')}
                />
                {/* 按数量排序 */}
                <ResultColumn
                  title="按数量降序"
                  data={[...result.buckets].sort((a, b) => b.doc_count - a.doc_count).map(b => ({ value: b.key, count: b.doc_count }))}
                  columns={[{ key: 'value', label: '值' }, { key: 'count', label: '数量' }]}
                  onCopy={() => copyToClipboard([...result.buckets].sort((a, b) => b.doc_count - a.doc_count).map(b => `${b.key}\t${b.doc_count}`).join('\n'), '按数量排序')}
                />
              </div>
              <div className="result-summary">总计: {result.total} 条记录，{result.buckets.length} 个唯一值</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 结果列组件
const ResultColumn = ({ title, data, columns, onCopy }: {
  title: string;
  data: { value: string; count?: number }[];
  columns: { key: string; label: string }[];
  onCopy: () => void;
}) => (
  <div className="result-column">
    <div className="column-header">
      <span>{title}</span>
      <button className="btn-copy" onClick={onCopy}><Copy size={14} /> 复制</button>
    </div>
    <div className="column-body">
      <table>
        <thead>
          <tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {data.slice(0, 100).map((row, i) => (
            <tr key={i}>{columns.map(c => <td key={c.key}>{String((row as Record<string, unknown>)[c.key] ?? '')}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="column-footer">总数: {data.length}</div>
  </div>
);

export default AnalysisModal;
