/**
 * 字段列表组件 - 点击选中/取消选中字段
 */

import { useState, useMemo } from 'react';
import type { ViewDetail } from '../../../../services/elfk/view';

interface Props {
  currentView: ViewDetail | null;
  selectedFields: string[];
  onFieldsChange: (fields: string[]) => void;
}

const typeColors: Record<string, string> = {
  text: '#1890ff',
  keyword: '#52c41a',
  long: '#faad14',
  integer: '#faad14',
  float: '#faad14',
  double: '#faad14',
  date: '#eb2f96',
  boolean: '#722ed1',
  ip: '#13c2c2'
};

const FieldList = ({ currentView, selectedFields, onFieldsChange }: Props) => {
  const [searchKey, setSearchKey] = useState('');

  const fields = useMemo(() => {
    if (!currentView?.all_field?.properties) return [];
    return Object.entries(currentView.all_field.properties)
      .filter(([name]) => !name.includes('.keyword'))
      .map(([name, info]) => ({ name, type: info.type || 'unknown' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [currentView]);

  const filteredFields = useMemo(() => {
    if (!searchKey) return fields;
    const kw = searchKey.toLowerCase();
    return fields.filter(f => f.name.toLowerCase().includes(kw));
  }, [fields, searchKey]);

  const toggleField = (fieldName: string) => {
    if (selectedFields.includes(fieldName)) {
      onFieldsChange(selectedFields.filter(f => f !== fieldName));
    } else {
      onFieldsChange([...selectedFields, fieldName]);
    }
  };

  return (
    <div className="field-list">
      <div className="field-header">
        <span className="field-title">字段列表</span>
        {fields.length > 0 && <span className="field-count">{fields.length}</span>}
      </div>

      <div className="field-search">
        <input
          type="text"
          placeholder="搜索字段"
          value={searchKey}
          onChange={e => setSearchKey(e.target.value)}
        />
      </div>

      <div className="field-content">
        {!currentView ? (
          <div className="field-placeholder">请先选择视图</div>
        ) : filteredFields.length === 0 ? (
          <div className="field-placeholder">
            {searchKey ? '未找到匹配字段' : '暂无字段信息'}
          </div>
        ) : (
          filteredFields.map(f => (
            <div
              key={f.name}
              className={`field-item ${selectedFields.includes(f.name) ? 'selected' : ''}`}
              onClick={() => toggleField(f.name)}
              title="点击选中/取消选中字段"
            >
              <span className="field-name">{f.name}</span>
              <span
                className="field-type"
                style={{ color: typeColors[f.type] || '#999' }}
              >
                {f.type}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FieldList;
