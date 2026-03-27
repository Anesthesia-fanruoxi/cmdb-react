/**
 * BI 查询结果组件
 */

interface QueryResultProps {
  loading: boolean;
  resultData: unknown[][];
  resultColumns: string[];
  took: number;
  onCopyColumn: (colIndex: number) => void;
  onCopyRow: (rowIndex: number) => void;
}

export const QueryResult = ({
  loading,
  resultData,
  resultColumns,
  took,
  onCopyColumn,
  onCopyRow
}: QueryResultProps) => {
  return (
    <div className="result-section">
      <div className="result-header">
        <span className="title">查询结果</span>
        {resultData.length > 0 && (
          <span className="info">
            共 {resultData.length} 条记录
            {took > 0 && ` | 耗时: ${took}ms`}
          </span>
        )}
      </div>

      <div className="result-content">
        {loading ? (
          <div className="loading">查询中...</div>
        ) : resultData.length > 0 ? (
          <table className="result-table">
            <thead>
              <tr>
                <th className="copy-column">#</th>
                {resultColumns.map((col, colIndex) => (
                  <th key={col}>
                    <div className="th-content">
                      <span>{col}</span>
                      <button
                        className="copy-btn"
                        onClick={() => onCopyColumn(colIndex)}
                        title="复制整列"
                      >
                        📋
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultData.map((row, rowIndex) => {
                return (
                  <tr key={rowIndex}>
                    <td className="copy-column">
                      <button
                        className="copy-btn"
                        onClick={() => onCopyRow(rowIndex)}
                        title="复制整行"
                      >
                        📋
                      </button>
                    </td>
                    {resultColumns.map((col, colIndex) => {
                      const value = typeof row === 'object' && !Array.isArray(row)
                        ? row[col]
                        : row[colIndex];
                      return (
                        <td key={colIndex}>
                          {String(value ?? '')}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <span>暂无数据</span>
          </div>
        )}
      </div>
    </div>
  );
};
