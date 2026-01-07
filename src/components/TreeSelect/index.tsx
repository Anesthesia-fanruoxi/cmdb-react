/**
 * 树形选择组件
 * 支持层级显示，只有叶子节点可选
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './style.css';

interface TreeNode {
  id: string | number;
  name: string;
  children?: TreeNode[];
}

interface TreeSelectProps {
  value?: string;
  options: TreeNode[];
  placeholder?: string;
  onChange: (value: string | undefined) => void;
}

const TreeSelect = ({ value, options, placeholder = '请选择', onChange }: TreeSelectProps) => {
  const [open, setOpen] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // 检查是否点击在输入框或下拉框内
      if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 计算下拉框位置
  useEffect(() => {
    if (open && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 10000,
      });
    }
  }, [open]);

  // 初始化时展开包含选中值的路径
  useEffect(() => {
    if (value && options.length > 0) {
      const keys = new Set<string>();
      const findPath = (nodes: TreeNode[], path: string[]): boolean => {
        for (const node of nodes) {
          if (String(node.id) === value) {
            path.forEach(k => keys.add(k));
            return true;
          }
          if (node.children?.length) {
            if (findPath(node.children, [...path, String(node.id)])) return true;
          }
        }
        return false;
      };
      findPath(options, []);
      setExpandedKeys(keys);
    }
  }, [value, options]);

  // 查找选中节点的名称
  const findNodeName = (nodes: TreeNode[], targetId: string): string | null => {
    for (const node of nodes) {
      if (String(node.id) === targetId) return node.name;
      if (node.children?.length) {
        const found = findNodeName(node.children, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  const selectedName = value ? findNodeName(options, value) : null;

  // 切换展开/收起
  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 判断是否为叶子节点
  const isLeaf = (node: TreeNode) => !node.children || node.children.length === 0;

  // 选择节点
  const handleSelect = (node: TreeNode, e: React.MouseEvent) => {
    if (isLeaf(node)) {
      onChange(String(node.id));
      setOpen(false);
    } else {
      // 点击父节点时展开/收起
      toggleExpand(String(node.id), e);
    }
  };

  // 渲染树节点
  const renderNodes = (nodes: TreeNode[], level = 0): React.ReactNode => {
    return nodes.map(node => {
      const nodeId = String(node.id);
      const hasChildren = node.children && node.children.length > 0;
      const expanded = expandedKeys.has(nodeId);
      const leaf = isLeaf(node);
      const selected = value === nodeId;

      return (
        <div key={nodeId}>
          <div
            className={`tree-node ${leaf ? 'leaf' : 'parent'} ${selected ? 'selected' : ''}`}
            style={{ paddingLeft: 12 + level * 16 }}
            onClick={(e) => handleSelect(node, e)}
          >
            {hasChildren && (
              <span className="tree-expand" onClick={(e) => toggleExpand(nodeId, e)}>
                {expanded ? '▼' : '▶'}
              </span>
            )}
            {!hasChildren && <span className="tree-expand-placeholder" />}
            <span className="tree-label">{node.name}</span>
          </div>
          {hasChildren && expanded && (
            <div className="tree-children">
              {renderNodes(node.children!, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const dropdown = open && createPortal(
    <div className="tree-select-dropdown" style={dropdownStyle} ref={dropdownRef}>
      <div
        className={`tree-node leaf ${!value ? 'selected' : ''}`}
        style={{ paddingLeft: 12 }}
        onClick={() => { onChange(undefined); setOpen(false); }}
      >
        <span className="tree-expand-placeholder" />
        <span className="tree-label placeholder">{placeholder}</span>
      </div>
      {renderNodes(options)}
    </div>,
    document.body
  );

  return (
    <div className="tree-select" ref={containerRef}>
      <div className="tree-select-input" ref={inputRef} onClick={() => setOpen(!open)}>
        <span className={selectedName ? '' : 'placeholder'}>
          {selectedName || placeholder}
        </span>
        <span className="tree-select-arrow">{open ? '▲' : '▼'}</span>
      </div>
      {dropdown}
    </div>
  );
};

export default TreeSelect;
