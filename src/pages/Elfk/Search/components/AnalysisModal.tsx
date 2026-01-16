/**
 * 字段分析弹框
 */

import { useState, useMemo } from 'react';
import { X, Loader2 } from 'lucide-react';
import { analyzeField } from '../../../../services/elfk/search';
import toast from '../../../../components/Toast';
import { useTaskCenterStore } from '../../../../stores/taskCenterStore';
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

const AnalysisModal = ({ visible, currentView, searchParams, logs, total, onClose }: Props) => {
  const { open: openTaskCenter, addRunningTask } = useTaskCenterStore();
  const [selectedField, setSelectedField] = useState('');
  const [startDelimiter, setStartDelimiter] = useState('');
  const [endDelimiter, setEndDelimiter] = useState('');
  const [loading, setLoading] = useState(false);
  const [sampleValue, setSampleValue] = useState<string>('');

  // 获取可分析的字段
  const fields = useMemo(() => {
    if (!currentView?.all_field?.properties) return [];
    return Object.entries(currentView.all_field.properties)
      .filter(([name]) => !name.includes('.keyword'))
      .map(([name, info]) => ({ name, type: info.type || 'unknown' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [currentView]);

  // 递归获取嵌套对象中的值
  const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
    if (!obj || !path) return undefined;
    const keys = path.split('.');
    let current: unknown = obj;
    for (const key of keys) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  };

  // 字段变化时获取示例值
  const handleFieldChange = (fieldName: string) => {
    setSelectedField(fieldName);
    setStartDelimiter('');
    setEndDelimiter('');
    
    if (!fieldName || !logs.length) {
      setSampleValue('');
      return;
    }
    
    // 从日志中找示例值
    for (const log of logs) {
      const source = log._source || log;
      const value = getNestedValue(source as Record<string, unknown>, fieldName);
      if (value !== undefined) {
        setSampleValue(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
        return;
      }
    }
    setSampleValue('未找到示例值');
  };

  const handleAnalyze = async () => {
    if (!selectedField) {
      toast.warning('请选择分析字段');
      return;
    }
    
    if (!searchParams.query_id) {
      toast.warning('请先执行搜索');
      return;
    }

    setLoading(true);
    try {
      // 构建分析参数（与 Vue 版本一致）
      const params: Record<string, unknown> = {
        qid: searchParams.query_id,
        field: selectedField,
        log_type: currentView?.log_type || 'elfk',
        count: total || 0
      };
      
      // 只有设置了分隔符才添加
      if (startDelimiter) params.startDelimiter = startDelimiter;
      if (endDelimiter) params.endDelimiter = endDelimiter;

      const res = await analyzeField(params as any);
      
      if (res.code === 200) {
        // 关闭弹框
        handleClose();
        
        // 显示 toast 提示
        toast.success('分析任务已创建');
        
        // 添加运行中任务并触发 SSE（如果返回了任务 ID）
        if (res.data?.task_id) {
          addRunningTask(res.data.task_id, 'analysis');
        }
        
        // 自动打开任务中心
        openTaskCenter();
      } else {
        toast.error(res.message || '创建任务失败');
      }
    } catch (err) {
      toast.error('创建任务失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedField('');
    setStartDelimiter('');
    setEndDelimiter('');
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

          {/* 提示信息 */}
          {selectedField && (
            <div className="analysis-tip">
              <p>分析任务将在后台执行，完成后可在任务中心查看结果</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisModal;
