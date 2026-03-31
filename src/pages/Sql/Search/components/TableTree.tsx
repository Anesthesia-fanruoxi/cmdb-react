/**
 * 表结构树组件 - 点击表名展开菜单选项
 */

import { useState, useMemo } from 'react';
import { type Project } from '../../../../services/sql/search';

interface MenuOption {
  name: string;
  command: string;
  icon: string;
}

const MENU_OPTIONS: MenuOption[] = [
  { name: '表结构', command: 'fields', icon: '\u{1F4CB}' },
  { name: '数据预览', command: 'preview', icon: '\u{1F441}\uFE0F' },
  { name: '索引信息', command: 'indexes', icon: '\u{1F511}' },
  { name: 'DDL语句', command: 'ddl', icon: '\u{1F4C4}' }
];

interface Props {
  projects: Project[];
  projectLoading: boolean;
  currentProject: string;
  currentDb: string;
  dbList: string[];
  tableList: string[];
  treeLoading: boolean;
  onProjectChange: (project: string) => void;
  onDbChange: (db: string) => void;
  onInsertSql: (sql: string) => void;
  onTableDetail?: (tableName: string, command: string) => void;
  onRefreshMetadata?: () => void;
  metadataRefreshing?: boolean;
  metadataCacheAge?: number | null;
}

const TableTree = ({
  projects, projectLoading, currentProject, currentDb,
  dbList, tableList, treeLoading, onProjectChange, onDbChange, onInsertSql: _onInsertSql, onTableDetail,
  onRefreshMetadata, metadataRefreshing = false, metadataCacheAge
}: Props) => {
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [searchKey, setSearchKey] = useState('');

  // 格式化缓存时间
  const formatCacheAge = (timestamp: number | null): string => {
    if (!timestamp) return '未缓存';
    
    const age = Date.now() - timestamp;
    const minutes = Math.floor(age / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    return '刚刚';
  };

  // 展开/收起表
  const toggleTable = (tableName: string) => {
    setExpandedTable(expandedTable === tableName ? null : tableName);
  };

  // 点击菜单选项
  const handleMenuClick = (tableName: string, command: string) => {
    if (onTableDetail) {
      // 所有选项都打开详情弹窗，传递对应的 Tab
      onTableDetail(tableName, command);
    }
  };

  // 顺序模糊匹配（忽略下划线）
  // 返回每个字符的匹配位置数组，用于排序
  const fuzzyMatch = (tableName: string, keyword: string): { match: boolean; positions: number[] } => {
    const normalizedTable = tableName.toLowerCase().replace(/_/g, '');
    const normalizedKeyword = keyword.toLowerCase().replace(/_/g, '');
    
    if (!normalizedKeyword) return { match: true, positions: [] };
    
    const positions: number[] = [];
    let tableIndex = 0;
    
    for (const char of normalizedKeyword) {
      const foundIndex = normalizedTable.indexOf(char, tableIndex);
      
      if (foundIndex === -1) {
        return { match: false, positions: [] };
      }
      
      positions.push(foundIndex);
      tableIndex = foundIndex + 1;
    }
    
    return { match: true, positions };
  };

  // 比较两个位置数组，返回 -1/0/1
  const comparePositions = (a: number[], b: number[]): number => {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const posA = a[i] ?? Infinity;
      const posB = b[i] ?? Infinity;
      if (posA !== posB) {
        return posA - posB; // 位置小的排前面
      }
    }
    return 0;
  };

  // 过滤并排序表
  const filteredTables = useMemo(() => {
    if (!searchKey) return tableList;
    
    const results: { name: string; positions: number[] }[] = [];
    
    for (const t of tableList) {
      const { match, positions } = fuzzyMatch(t, searchKey);
      if (match) {
        results.push({ name: t, positions });
      }
    }
    
    // 按位置数组排序
    results.sort((a, b) => comparePositions(a.positions, b.positions));
    
    return results.map(r => r.name);
  }, [tableList, searchKey]);

  return (
    <div className="table-tree">
      <div className="tree-selects">
        <select value={currentProject} onChange={e => onProjectChange(e.target.value)} disabled={projectLoading}>
          <option value="">选择项目</option>
          {projects.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select value={currentDb} onChange={e => onDbChange(e.target.value)} disabled={!currentProject}>
          <option value="">选择数据库</option>
          {dbList.map(db => <option key={db} value={db}>{db}</option>)}
        </select>
        {currentProject && (
          <button 
            className="refresh-btn-icon" 
            onClick={onRefreshMetadata}
            disabled={metadataRefreshing || !currentProject}
            title={metadataCacheAge ? `刷新元数据 (缓存: ${formatCacheAge(metadataCacheAge)})` : '刷新元数据'}
          >
            <svg 
              className={metadataRefreshing ? 'refresh-icon spinning' : 'refresh-icon'} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
          </button>
        )}
      </div>

      {currentDb && (
        <div className="tree-search">
          <input type="text" placeholder="搜索表，点击表名展开菜单选项" value={searchKey} onChange={e => setSearchKey(e.target.value)} />
        </div>
      )}

      <div className="tree-list">
        {treeLoading ? (
          <div className="tree-placeholder">加载中...</div>
        ) : !currentDb ? (
          <div className="tree-placeholder">请选择数据库</div>
        ) : filteredTables.length === 0 ? (
          <div className="tree-placeholder">暂无表</div>
        ) : (
          filteredTables.map(tableName => (
            <div key={tableName} className="tree-node">
              <div className="tree-node-header" onClick={() => toggleTable(tableName)}>
                <span className="tree-icon">{expandedTable === tableName ? '▼' : '▶'}</span>
                <span className="tree-label table-name">{tableName}</span>
              </div>
              {expandedTable === tableName && (
                <div className="tree-children">
                  {MENU_OPTIONS.map(opt => (
                    <div key={opt.command} className="tree-menu-item" onClick={() => handleMenuClick(tableName, opt.command)}>
                      <span className="menu-icon">{opt.icon}</span>
                      <span className="menu-label">{opt.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TableTree;
