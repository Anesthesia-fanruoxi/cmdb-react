/**
 * BI 查询表树组件
 */

import { useMemo } from 'react';
import { Database, Table, ChevronRight, ChevronDown } from 'lucide-react';
import type { TreeNode } from '../types';

interface TableTreeProps {
  treeData: TreeNode[];
  expandedKeys: Set<string>;
  loading: boolean;
  refreshLoading: boolean;
  refreshProgress: number;
  refreshMessage: string;
  searchKey: string;
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
  searchKey,
  onNodeClick,
  onNodeContextMenu,
  onToggleExpand
}: TableTreeProps) => {

  // 顺序模糊匹配（忽略下划线），返回匹配位置用于排序
  const fuzzyMatch = (tableName: string, keyword: string): { match: boolean; positions: number[] } => {
    const normalizedTable = tableName.toLowerCase().replace(/_/g, '');
    const normalizedKeyword = keyword.toLowerCase().replace(/_/g, '');
    if (!normalizedKeyword) return { match: true, positions: [] };

    const positions: number[] = [];
    let tableIndex = 0;
    for (const char of normalizedKeyword) {
      const foundIndex = normalizedTable.indexOf(char, tableIndex);
      if (foundIndex === -1) return { match: false, positions: [] };
      positions.push(foundIndex);
      tableIndex = foundIndex + 1;
    }
    return { match: true, positions };
  };

  // 按位置数组排序（位置越靠前越优先）
  const comparePositions = (a: number[], b: number[]): number => {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const diff = (a[i] ?? Infinity) - (b[i] ?? Infinity);
      if (diff !== 0) return diff;
    }
    return 0;
  };

  // 过滤树数据：顺序模糊匹配表名，匹配结果按位置排序，自动展开父节点
  const filteredTreeData = useMemo(() => {
    if (!searchKey.trim()) return treeData;
    return treeData
      .map(dbNode => {
        const results: { node: TreeNode; positions: number[] }[] = [];
        for (const tableNode of dbNode.children || []) {
          const { match, positions } = fuzzyMatch(tableNode.label, searchKey);
          if (match) results.push({ node: tableNode, positions });
        }
        if (results.length === 0) return null;
        results.sort((a, b) => comparePositions(a.positions, b.positions));
        return { ...dbNode, children: results.map(r => r.node) };
      })
      .filter(Boolean) as TreeNode[];
  }, [treeData, searchKey]);

  // 搜索时所有匹配的数据库节点都展开
  const effectiveExpandedKeys = useMemo(() => {
    if (!searchKey.trim()) return expandedKeys;
    const keys = new Set(expandedKeys);
    filteredTreeData.forEach(dbNode => keys.add(dbNode.id));
    return keys;
  }, [searchKey, filteredTreeData, expandedKeys]);
  // 渲染树节点
  const renderTreeNode = (node: TreeNode) => {
    const isExpanded = effectiveExpandedKeys.has(node.id);
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
      ) : filteredTreeData.length > 0 ? (
        filteredTreeData.map(node => renderTreeNode(node))
      ) : (
        <div className="empty-state">
          <span>{searchKey ? '无匹配的表' : '请先选择项目'}</span>
        </div>
      )}
    </div>
  );
};
