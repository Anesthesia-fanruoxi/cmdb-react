/**
 * 视图详情弹窗
 * 展示完整视图信息，包含 time_format、create_time 及字段树
 */

import { useState } from 'react';
import type { ViewDetail as ViewDetailType } from '../../../../services/elfk/view';
import type { FieldInfo } from '../../../../services/elfk/search';
import './ViewDetail.css';

interface DictItem {
  key: string;
  value: string;
}

interface ViewDetailProps {
  visible: boolean;
  data: ViewDetailType;
  projectOptions: DictItem[];
  categoryOptions: DictItem[];
  onClose: () => void;
  onEdit: () => void;
}

interface FieldNode {
  name: string;
  path: string;
  type?: string;
  children?: FieldNode[];
}

// 将 ES properties 构建为树形结构
function buildFieldTree(properties: Record<string, FieldInfo>, prefix = ''): FieldNode[] {
  return Object.entries(properties).map(([key, info]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const node: FieldNode = { name: key, path };
    if (info.type) node.type = info.type;
    return node;
  });
}

// 格式化时间格式显示
function formatTimeFormat(fmt?: string) {
  if (!fmt) return '-';
  const map: Record<string, string> = {
    iso8601: 'ISO 8601',
    epoch_millis: 'Unix 时间戳(毫秒)',
    epoch_second: 'Unix 时间戳(秒)',
  };
  return map[fmt] || fmt;
}

// 格式化日志类型
function formatLogType(t?: string) {
  if (!t) return '-';
  return { elfk: 'ELFK', sls: 'SLS' }[t] || t;
}

// 字段树节点
const FieldTreeNode = ({ node }: { node: FieldNode }) => {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="field-node">
      <div className="field-row" onClick={() => hasChildren && setOpen(o => !o)}>
        {hasChildren && (
          <span className={`field-arrow ${open ? 'open' : ''}`}>▶</span>
        )}
        {!hasChildren && <span className="field-arrow-placeholder" />}
        <span className="field-name">{node.name}</span>
        {node.type && <span className={`field-type type-${node.type}`}>{node.type}</span>}
      </div>
      {hasChildren && open && (
        <div className="field-children">
          {node.children!.map(child => (
            <FieldTreeNode key={child.path} node={child} />
          ))}
        </div>
      )}
    </div>
  );
};

const ViewDetail = ({ visible, data, projectOptions, categoryOptions, onClose, onEdit }: ViewDetailProps) => {
  if (!visible) return null;

  const getProjectName = (key: string) => projectOptions.find(p => p.key === key)?.value || key;
  const getCategoryName = (key?: string) => {
    if (!key) return '未分类';
    return categoryOptions.find(c => c.key === key)?.value || key;
  };

  const fieldTree = data.all_field?.properties
    ? buildFieldTree(data.all_field.properties)
    : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content view-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>视图详情</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="detail-grid">
            <div className="detail-item">
              <span className="label">视图名称</span>
              <span className="value">{data.name}</span>
            </div>
            <div className="detail-item">
              <span className="label">项目</span>
              <span className="value">{getProjectName(data.project)}</span>
            </div>
            <div className="detail-item">
              <span className="label">分类</span>
              <span className="value">{getCategoryName(data.category)}</span>
            </div>
            <div className="detail-item">
              <span className="label">日志类型</span>
              <span className="value">{formatLogType(data.log_type)}</span>
            </div>
            <div className="detail-item full">
              <span className="label">索引模式</span>
              <span className="value mono">{data.index_pattern}</span>
            </div>
            <div className="detail-item">
              <span className="label">时间字段</span>
              <span className="value mono">{data.time_field || '-'}</span>
            </div>
            <div className="detail-item">
              <span className="label">时间格式</span>
              <span className="value">{formatTimeFormat(data.time_format)}</span>
            </div>
            <div className="detail-item">
              <span className="label">创建时间</span>
              <span className="value">{data.create_time || '-'}</span>
            </div>
            <div className="detail-item">
              <span className="label">更新时间</span>
              <span className="value">{data.update_time || '-'}</span>
            </div>
            <div className="detail-item full">
              <span className="label">描述</span>
              <span className="value">{data.description || '-'}</span>
            </div>
          </div>

          {fieldTree.length > 0 && (
            <div className="field-section">
              <div className="section-title">字段信息 <span className="field-count">{fieldTree.length} 个字段</span></div>
              <div className="field-tree">
                {fieldTree.map(node => (
                  <FieldTreeNode key={node.path} node={node} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>关闭</button>
          <button className="btn-submit" onClick={onEdit}>编辑</button>
        </div>
      </div>
    </div>
  );
};

export default ViewDetail;
