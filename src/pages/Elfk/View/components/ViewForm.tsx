/**
 * 视图表单弹窗
 * 支持索引匹配、时间字段下拉选择、time_format 自动识别
 */

import { useState, useEffect } from 'react';
import { createView, updateView, getViewDetail } from '../../../../services/elfk/view';
import { matchIndexFields } from '../../../../services/elfk/search';
import { toast } from '../../../../components/AppNotification';
import type { ViewListItem, CreateViewParams, FieldItem } from '../../../../services/elfk/view';
import type { FieldInfo } from '../../../../services/elfk/search';
import './ViewForm.css';

interface DictItem {
  key: string;
  value: string;
}

interface ViewFormProps {
  visible: boolean;
  editData: ViewListItem | null;
  projectOptions: DictItem[];
  categoryOptions: DictItem[];
  onClose: () => void;
  onSuccess: () => void;
}

const emptyForm = (): CreateViewParams => ({
  name: '',
  project: '',
  category: '',
  index_pattern: '',
  time_field: '',
  time_format: '',
  description: '',
  log_type: 'elfk',
  fields: [],
});

const ViewForm = ({ visible, editData, projectOptions, categoryOptions, onClose, onSuccess }: ViewFormProps) => {
  const [loading, setLoading] = useState(false);
  const [matchLoading, setMatchLoading] = useState(false);
  const [form, setForm] = useState<CreateViewParams>(emptyForm());
  const [allFields, setAllFields] = useState<FieldItem[]>([]);

  useEffect(() => {
    if (!visible) return;
    if (editData) {
      loadDetail();
    } else {
      setForm(emptyForm());
      setAllFields([]);
    }
  }, [editData, visible]);

  const loadDetail = async () => {
    if (!editData) return;
    try {
      const res = await getViewDetail(editData.id);
      if (res.code === 200 && res.data) {
        const d = res.data;
        setForm({
          name: d.name,
          project: d.project,
          category: d.category || '',
          index_pattern: d.index_pattern,
          time_field: d.time_field,
          time_format: d.time_format || '',
          description: d.description || '',
          log_type: d.log_type || 'elfk',
          fields: d.all_field ? flattenFields(d.all_field.properties) : [],
        });
        if (d.all_field) {
          setAllFields(flattenFields(d.all_field.properties));
        }
      }
    } catch (err) {
      console.error('获取视图详情失败:', err);
    }
  };

  // 将 ES properties 展平为字段列表（含子字段）
  const flattenFields = (properties: Record<string, FieldInfo & { fields?: Record<string, FieldInfo> }>, prefix = ''): FieldItem[] => {
    const result: FieldItem[] = [];
    Object.entries(properties).forEach(([key, info]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      result.push({
        path,
        type: info.type,
        format: info.format,
        aggregatable: ['keyword', 'date', 'long', 'integer', 'boolean'].includes(info.type),
        searchable: true,
      });
      // 处理子字段（如 message.keyword）
      if (info.fields) {
        Object.entries(info.fields).forEach(([subKey, subInfo]) => {
          result.push({
            path: `${path}.${subKey}`,
            type: subInfo.type,
            format: subInfo.format,
            aggregatable: subInfo.type === 'keyword',
            searchable: true,
          });
        });
      }
    });
    return result;
  };

  const dateFields = allFields.filter(f => f.type === 'date');

  const handleChange = (field: keyof CreateViewParams, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // 日志类型变更时清空字段
  const handleLogTypeChange = (value: string) => {
    if (allFields.length > 0) {
      setAllFields([]);
      setForm(prev => ({ ...prev, log_type: value, time_field: '', time_format: '', fields: [] }));
      toast.info('日志类型已变更，请重新匹配索引');
    } else {
      handleChange('log_type', value);
    }
  };

  // 时间字段变更时自动填充 time_format
  const handleTimeFieldChange = (value: string) => {
    const field = allFields.find(f => f.path === value);
    const fmt = field?.format || 'epoch_millis';
    setForm(prev => ({ ...prev, time_field: value, time_format: value ? fmt : '' }));
  };

  // 匹配索引
  const handleMatchIndex = async () => {
    if (!form.index_pattern.trim()) return toast.warning('请先输入索引模式');
    if (!form.project) return toast.warning('请先选择项目');

    setMatchLoading(true);
    try {
      const res = await matchIndexFields({
        project: form.project,
        index: form.index_pattern,
        log_type: form.log_type,
      });
      if (res.code === 200 && res.data?.fields?.properties) {
        const fields = flattenFields(res.data.fields.properties);
        setAllFields(fields);

        // 自动选第一个 date 字段
        const firstDate = fields.find(f => f.type === 'date');
        if (firstDate) {
          setForm(prev => ({
            ...prev,
            fields,
            time_field: firstDate.path,
            time_format: firstDate.format || 'epoch_millis',
          }));
        } else {
          setForm(prev => ({ ...prev, fields, time_field: '', time_format: '' }));
        }
        toast.success(`成功匹配到 ${fields.length} 个字段`);
      } else {
        toast.error('匹配索引失败');
      }
    } catch (err) {
      console.error('匹配索引失败:', err);
      toast.error('匹配索引失败');
    } finally {
      setMatchLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.warning('请输入视图名称');
    if (!form.project) return toast.warning('请选择项目');
    if (!form.index_pattern.trim()) return toast.warning('请输入索引模式');
    if (allFields.length === 0) return toast.warning('请先匹配索引获取字段');

    setLoading(true);
    try {
      const { time_field, time_format, ...rest } = form;
      const payload: CreateViewParams = time_field
        ? { ...rest, time_field, time_format }
        : { ...rest, time_field: '' };
      const res = editData
        ? await updateView({ ...payload, id: editData.id })
        : await createView(payload);

      if (res.code === 200) {
        onSuccess();
      }
    } catch (err) {
      console.error('保存视图失败:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content view-form-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editData ? '编辑视图' : '新建视图'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-item">
            <label className="required">视图名称</label>
            <input
              type="text"
              value={form.name}
              onChange={e => handleChange('name', e.target.value)}
              placeholder="请输入视图名称"
            />
          </div>

          <div className="form-row">
            <div className="form-item">
              <label className="required">项目</label>
              <select
                value={form.project}
                onChange={e => handleChange('project', e.target.value)}
                disabled={!!editData}
              >
                <option value="">请选择项目</option>
                {projectOptions.map(item => (
                  <option key={item.key} value={item.key}>{item.value}</option>
                ))}
              </select>
            </div>

            <div className="form-item">
              <label>分类</label>
              <select value={form.category} onChange={e => handleChange('category', e.target.value)}>
                <option value="">请选择分类</option>
                {categoryOptions.map(item => (
                  <option key={item.key} value={item.key}>{item.value}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-item">
            <label className="required">日志类型</label>
            <select value={form.log_type} onChange={e => handleLogTypeChange(e.target.value)}>
              <option value="elfk">ELFK</option>
              <option value="sls">SLS</option>
            </select>
          </div>

          <div className="form-item">
            <label className="required">索引模式</label>
            <div className="input-with-btn">
              <input
                type="text"
                value={form.index_pattern}
                onChange={e => handleChange('index_pattern', e.target.value)}
                placeholder="例如: logs-* 或 app-2024.*"
              />
              <button
                className="btn-match"
                onClick={handleMatchIndex}
                disabled={matchLoading}
              >
                {matchLoading ? '匹配中...' : '匹配'}
              </button>
            </div>
            {allFields.length > 0 && (
              <span className="match-hint">已匹配 {allFields.length} 个字段</span>
            )}
          </div>

          <div className="form-row">
            <div className="form-item">
              <label>时间字段</label>
              <select
                value={form.time_field}
                onChange={e => handleTimeFieldChange(e.target.value)}
                disabled={dateFields.length === 0}
              >
                <option value="">{dateFields.length === 0 ? '请先匹配索引' : '请选择时间字段'}</option>
                {dateFields.map(f => (
                  <option key={f.path} value={f.path}>{f.path}</option>
                ))}
              </select>
            </div>

            <div className="form-item">
              <label>时间格式</label>
              <input
                type="text"
                value={form.time_format}
                readOnly
                placeholder="自动识别"
                className="readonly"
              />
            </div>
          </div>

          <div className="form-item">
            <label>描述</label>
            <textarea
              value={form.description}
              onChange={e => handleChange('description', e.target.value)}
              placeholder="请输入视图描述"
              rows={3}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>取消</button>
          <button className="btn-submit" onClick={handleSubmit} disabled={loading}>
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewForm;
