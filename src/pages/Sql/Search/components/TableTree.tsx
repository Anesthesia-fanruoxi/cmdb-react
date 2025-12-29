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
}

const TableTree = ({
  projects, projectLoading, currentProject, currentDb,
  dbList, tableList, treeLoading, onProjectChange, onDbChange, onInsertSql: _onInsertSql, onTableDetail
}: Props) => {
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [searchKey, setSearchKey] = useState('');

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

  // 过滤表
  const filteredTables = useMemo(() => {
    if (!searchKey) return tableList;
    const kw = searchKey.toLowerCase();
    return tableList.filter(t => t.toLowerCase().includes(kw));
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
