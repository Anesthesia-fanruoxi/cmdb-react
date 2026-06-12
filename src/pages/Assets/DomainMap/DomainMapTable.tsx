/**
 * 域名解析配置列表表格
 */

import { Eye, Trash2, ExternalLink } from 'lucide-react';
import type { DomainMapFile } from '../../../services/assets/domainMap';

// 测试访问路径
const TEST_PATH = '/ystg/html/xinxiaorong1.html?channelSign=uW4CsYeFoTPYSHwAWE2FH61GuAUVfDu6GHAmjaJt7K';

interface DomainMapTableProps {
  loading: boolean;
  files: DomainMapFile[];
  onPreview: (serverName: string) => void;
  onDelete: (serverName: string) => void;
  onTestVisit: (serverName: string) => void;
}

const DomainMapTable = ({ loading, files, onPreview, onDelete, onTestVisit }: DomainMapTableProps) => {
  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 240 }}>域名</th>
            <th>配置文件路径</th>
            <th style={{ width: 180 }}>创建时间</th>
            <th style={{ width: 120 }}>测试访问</th>
            <th style={{ width: 140 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={5} className="loading-cell">加载中...</td></tr>
          ) : files.length === 0 ? (
            <tr><td colSpan={5} className="empty-cell">暂无数据</td></tr>
          ) : (
            files.map(f => (
              <tr key={f.path}>
                <td className="cell-ellipsis" title={f.domain}>{f.domain}</td>
                <td className="path-cell" title={f.path}>{f.path}</td>
                <td className="cell-ellipsis">{f.created_at || '--'}</td>
                <td>
                  <button
                    className="btn-link"
                    title={`https://${f.domain}${TEST_PATH}`}
                    onClick={() => onTestVisit(f.domain)}
                  >
                    <ExternalLink size={12} /> 测试访问
                  </button>
                </td>
                <td className="action-cell">
                  <button className="btn-link" onClick={() => onPreview(f.domain)}><Eye size={12} /> 预览</button>
                  <button className="btn-link danger" onClick={() => onDelete(f.domain)}><Trash2 size={12} /> 删除</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DomainMapTable;
