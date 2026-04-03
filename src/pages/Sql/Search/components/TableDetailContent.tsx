/**
 * 表详情内容组件 - 用于弹窗和独立窗口
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getTableStructure } from '../../../../services/sql/search';
import { toast } from '../../../../components/AppNotification';
import { onWindowUpdate } from '../../../../utils/window';
import '../styles/index.css';

type TabType = 'fields' | 'preview' | 'indexes' | 'ddl';

interface TableField {
  field: string;
  type: string;
  null: string;
  key: string;
  default: string | null;
  extra: string;
  comment: string;
}

interface TableIndex {
  name: string;
  columns: string[];
  unique: boolean;
  type: string;
  comment?: string;
}

interface PreviewData {
  columns: string[];
  rows: unknown[][];
  total: number;
  took: number;
}

interface TableInfo {
  name?: string;
  comment?: string;
  engine?: string;
  collation?: string;
  create_time?: string;
  columns?: TableField[];
  preview_data?: PreviewData;
  indexes?: TableIndex[];
  create_sql?: string;
  rows?: number; // 表总行数
  data_length?: number; // 表数据大小（字节）
  index_length?: number; // 索引大小（字节）
}

interface Props {
  agent: string;
  dbName: string;
  tableName: string;
  initialTab?: TabType;
  windowLabel?: string; // 窗口标识，用于监听更新事件
  onOpenInQuery?: (tableName: string, dbName: string, agent: string) => void; // 在查询中打开回调
}

const TAB_CONFIG = [
  { key: 'fields', label: '字段信息', icon: '\u{1F4CB}' },
  { key: 'preview', label: '数据预览', icon: '\u{1F441}\uFE0F' },
  { key: 'indexes', label: '索引信息', icon: '\u{1F511}' },
  { key: 'ddl', label: 'DDL语句', icon: '\u{1F4C4}' }
] as const;


const TableDetailContent = ({ agent, dbName, tableName, initialTab = 'fields', windowLabel, onOpenInQuery }: Props) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // 监听窗口更新事件，切换 Tab
  useEffect(() => {
    if (!windowLabel) return;
    
    const unlisten = onWindowUpdate<{ initialTab?: TabType }>(windowLabel, (data) => {
      if (data.initialTab) {
        setActiveTab(data.initialTab);
      }
    });

    return () => { unlisten.then(fn => fn()); };
  }, [windowLabel]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);

  const fields = useMemo(() => tableInfo?.columns || [], [tableInfo]);
  const previewData = useMemo(() => tableInfo?.preview_data, [tableInfo]);
  const indexes = useMemo(() => tableInfo?.indexes || [], [tableInfo]);
  const ddl = useMemo(() => tableInfo?.create_sql || '', [tableInfo]);

  const loadTableDetail = useCallback(async () => {
    if (!agent || !dbName || !tableName) return;
    setLoading(true);
    setError('');
    try {
      const res = await getTableStructure({ agent, dbName, tbName: tableName });
      
      if (res.code === 200 && res.data) {
        const data = res.data as unknown as TableInfo;
        
        // 从缓存中获取表统计信息
        const { getTableStats } = await import('../../../../utils/sql/cache');
        const stats = getTableStats(tableName);
        
        if (stats) {
          // 合并统计信息到 tableInfo
          data.rows = stats.rowCount;
          data.data_length = stats.dataLength;
          data.index_length = stats.indexLength;
        }
        
        setTableInfo(data);
      } else {
        setError(res.message || '获取表详情失败');
      }
    } catch (err) {
      console.error('[表详情] 请求异常:', err);
      setError('获取表详情出错，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [agent, dbName, tableName]);

  useEffect(() => { loadTableDetail(); }, [loadTableDetail]);

  const copyDDL = () => {
    if (!ddl) return;
    navigator.clipboard.writeText(ddl)
      .then(() => toast.success('DDL语句已复制到剪贴板'))
      .catch(() => toast.error('复制失败'));
  };

  const formatDDL = (ddlStr: string) => {
    if (!ddlStr) return '';
    return ddlStr
      .replace(/,\s+/g, ', ')
      .replace(/, `/g, ',\n  `')
      .replace(/, PRIMARY KEY/g, ',\n  PRIMARY KEY')
      .replace(/, UNIQUE KEY/g, ',\n  UNIQUE KEY')
      .replace(/, KEY `/g, ',\n  KEY `')
      .replace(/\) ENGINE/g, '\n) ENGINE');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    
    // 处理数组格式的日期字符串 "[50 48 50 53 45 49 50 45 50 53 32 49 56 58 48 52 58 50 52]"
    if (typeof dateString === 'string' && dateString.startsWith('[') && dateString.endsWith(']')) {
      try {
        // 移除方括号并分割
        const numbers = dateString.slice(1, -1).split(' ').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        // 将 ASCII 码转换为字符串
        const dateStr = String.fromCharCode(...numbers);
        return new Date(dateStr).toLocaleString('zh-CN');
      } catch {
        return '-';
      }
    }
    
    // 处理普通日期字符串
    try {
      return new Date(dateString).toLocaleString('zh-CN');
    } catch {
      return '-';
    }
  };

  const renderKeyTag = (key: string) => {
    if (key === 'PRI') return <span className="key-tag key-primary">主键</span>;
    if (key === 'UNI') return <span className="key-tag key-unique">唯一</span>;
    if (key === 'MUL') return <span className="key-tag key-index">索引</span>;
    return '-';
  };

  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // 格式化文件大小，并返回颜色样式
  const getSizeStyle = (bytes?: number): { text: string; color: string } => {
    if (!bytes || bytes === 0) return { text: '-', color: '' };
    
    const KB = 1024;
    const MB = 1024 * KB;
    const GB = 1024 * MB;
    
    if (bytes >= GB) {
      // GB 级别 - 红色系，按 GB 数深浅变化
      const gb = bytes / GB;
      if (gb >= 100) return { text: `${gb.toFixed(2)} GB`, color: '#ff4d4f' }; // 极深红
      if (gb >= 10)  return { text: `${gb.toFixed(2)} GB`, color: '#ff7875' }; // 深红
      if (gb >= 1)   return { text: `${gb.toFixed(2)} GB`, color: '#ffa39e' }; // 中红
      return { text: `${gb.toFixed(2)} GB`, color: '#ffccc7' }; // 浅红
    }
    
    if (bytes >= MB) {
      // MB 级别 - 蓝色系，按 MB 数深浅变化
      const mb = bytes / MB;
      if (mb >= 500) return { text: `${mb.toFixed(2)} MB`, color: '#1677ff' }; // 极深蓝
      if (mb >= 100) return { text: `${mb.toFixed(2)} MB`, color: '#4096ff' }; // 深蓝
      if (mb >= 10)  return { text: `${mb.toFixed(2)} MB`, color: '#69b1ff' }; // 中蓝
      return { text: `${mb.toFixed(2)} MB`, color: '#91caff' }; // 浅蓝
    }
    
    if (bytes >= KB) {
      // KB 级别 - 绿色
      const kb = bytes / KB;
      return { text: `${kb.toFixed(2)} KB`, color: '#95de64' };
    }
    
    return { text: `${bytes} B`, color: 'var(--text-color)' };
  };

  // 格式化文件大小（纯文本，用于详细信息）
  const formatSize = (bytes?: number): string => {
    if (!bytes || bytes === 0) return '-';
    const KB = 1024, MB = 1024 * KB, GB = 1024 * MB;
    if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
    if (bytes >= MB) return `${(bytes / MB).toFixed(2)} MB`;
    if (bytes >= KB) return `${(bytes / KB).toFixed(2)} KB`;
    return `${bytes} B`;
  };

  // 格式化行数
  const formatRows = (rows?: number): string => {
    if (!rows && rows !== 0) return '-';
    return rows.toLocaleString('zh-CN');
  };


  return (
    <div className="table-detail-content">
      {tableInfo && !loading && !error && (
        <div className="table-meta">
          <div className="meta-item">
            <span className="meta-label">引擎:</span>
            <span className="meta-value">{tableInfo.engine || '-'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">字符集:</span>
            <span className="meta-value">{tableInfo.collation || '-'}</span>
          </div>
          {(tableInfo.rows !== undefined || tableInfo.preview_data?.total) && (
            <div className="meta-item">
              <span className="meta-label">总行数:</span>
              <span className="meta-value">{formatRows(tableInfo.rows || tableInfo.preview_data?.total)}</span>
            </div>
          )}
          {(tableInfo.data_length || tableInfo.index_length) && (
            <div className="meta-item">
              <span className="meta-label">大小:</span>
              <span className="meta-value" style={{ color: getSizeStyle((tableInfo.data_length || 0) + (tableInfo.index_length || 0)).color }}>
                {getSizeStyle((tableInfo.data_length || 0) + (tableInfo.index_length || 0)).text}
                {tableInfo.data_length && tableInfo.index_length && (
                  <span className="meta-detail" style={{ color: 'var(--text-muted)' }}>
                    {' '}(数据: {formatSize(tableInfo.data_length)}, 索引: {formatSize(tableInfo.index_length)})
                  </span>
                )}
              </span>
            </div>
          )}
          <div className="meta-item">
            <span className="meta-label">创建时间:</span>
            <span className="meta-value">{formatDate(tableInfo.create_time)}</span>
          </div>
        </div>
      )}
      
      <div className="detail-tabs">
        {TAB_CONFIG.map(({ key, label, icon }) => (
          <button
            key={key}
            className={`tab-btn ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key as TabType)}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      <div className="detail-body">
        {loading && <div className="loading-state">加载中...</div>}
        {error && <div className="error-state">{error}</div>}
        
        {!loading && !error && activeTab === 'fields' && (
          <div className="fields-tab">
            {fields.length === 0 ? (
              <div className="empty-state">暂无字段信息</div>
            ) : (
              <table className="detail-table">
                <thead>
                  <tr>
                    <th>字段名</th><th>数据类型</th><th>允许为空</th>
                    <th>键类型</th><th>默认值</th><th>额外</th><th>注释</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((f, i) => (
                    <tr key={i}>
                      <td className="field-name">{f.field}</td>
                      <td className="field-type">{f.type}</td>
                      <td>{f.null === 'YES' ? '是' : '否'}</td>
                      <td>{renderKeyTag(f.key)}</td>
                      <td>{f.default || '-'}</td>
                      <td>{f.extra || '-'}</td>
                      <td className="field-comment" title={f.comment}>{f.comment || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}


        {!loading && !error && activeTab === 'preview' && (
          <div className="preview-tab">
            {!previewData?.rows?.length ? (
              <div className="empty-state">暂无预览数据</div>
            ) : (
              <>
                <div className="preview-info">
                  <span>共 {previewData.total} 条数据，耗时: {previewData.took}ms</span>
                  {onOpenInQuery && (
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => onOpenInQuery(tableName, dbName, agent)}
                      style={{ marginLeft: '12px' }}
                    >
                      📝 在查询中打开
                    </button>
                  )}
                </div>
                <div className="preview-table-wrapper">
                  <table className="detail-table preview-table">
                    <thead>
                      <tr>
                        <th className="row-num">#</th>
                        {previewData.columns.map((col, i) => <th key={i}>{col}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.rows.map((row, ri) => (
                        <tr key={ri}>
                          <td className="row-num">{ri + 1}</td>
                          {(row as unknown[]).map((cell, ci) => (
                            <td key={ci} title={formatCellValue(cell)}>
                              {cell === null ? <span className="null-value">NULL</span> : formatCellValue(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {!loading && !error && activeTab === 'indexes' && (
          <div className="indexes-tab">
            {indexes.length === 0 ? (
              <div className="empty-state">暂无索引信息</div>
            ) : (
              <table className="detail-table">
                <thead>
                  <tr><th>索引名称</th><th>索引类型</th><th>索引字段</th><th>是否唯一</th><th>备注</th></tr>
                </thead>
                <tbody>
                  {indexes.map((idx, i) => (
                    <tr key={i}>
                      <td>{idx.name}</td>
                      <td>{idx.type}</td>
                      <td>{idx.columns?.join(', ') || '-'}</td>
                      <td>{idx.unique ? '是' : '否'}</td>
                      <td>{idx.comment || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {!loading && !error && activeTab === 'ddl' && (
          <div className="ddl-tab">
            <div className="ddl-actions">
              <button className="btn btn-primary btn-sm" onClick={copyDDL} disabled={!ddl}>
                {'\u{1F4CB}'} 复制DDL
              </button>
            </div>
            {ddl ? <pre className="ddl-content">{formatDDL(ddl)}</pre> : <div className="empty-state">暂无DDL信息</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default TableDetailContent;
