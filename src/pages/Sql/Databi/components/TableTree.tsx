/**
 * BI 查询表树组件
 */

import { Database, Table, ChevronRight, ChevronDown } from 'lucide-react';
import type { TreeNode } from '../types';

interface TableTreeProps {
  treeData: TreeNode[];
  expandedKeys: Set<string>;
  loading: boolean;
  refreshLoading: boolean;
  refreshProgress: number;
  refreshMessage: string;
  onNodeClick: (node: TreeNode) => void;
  onNodeContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  onToggleExpand: (nodeId: string) => void;
}

export const TableTree = ({
  treeData,
  expandedKeys,
  loading,
  refreshLoading,
  refreshProgress,
  refreshMessage,
  onNodeClick,
  onNodeContextMenu,
  onToggleExpand
}: TableTreeProps) => {
  // 渲染树节点
  const renderTreeNode = (node: TreeNode) => {
    const isExpanded = expandedKeys.has(node.id);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="tree-node-wrapper">
        <div
          className={`tree-node ${node.type}`}
          onClick={() => {
            if (node.type === 'database') {
              onToggleExpand(node.id);
            } else {
              onNodeClick(node);
            }
          }}
          onContextMenu={(e) => onNodeContextMenu(e, node)}
        >
          {node.type === 'database' && hasChildren && (
            <span className="expand-icon">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          )}
          <span className="node-icon">
            {node.type === 'database' ? (
              <Database size={16} />
            ) : (
              <Table size={16} />
            )}
          </span>
          <span className="node-label">{node.label}</span>
        </div>
        {node.type === 'database' && hasChildren && isExpanded && (
          <div className="tree-children">
            {node.children!.map(child => renderTreeNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="table-tree">
      {/* 刷新进度提示 */}
      {refreshLoading && refreshMessage && (
        <div className="refresh-status">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${refreshProgress}%` }}
            />
          </div>
          <span className="status-text">{refreshMessage}</span>
        </div>
      )}
      
      {loading ? (
        <div className="loading">加载中...</div>
      ) : treeData.length > 0 ? (
        treeData.map(node => renderTreeNode(node))
      ) : (
        <div className="empty-state">
          <span>请先选择项目</span>
        </div>
      )}
    </div>
  );
};
