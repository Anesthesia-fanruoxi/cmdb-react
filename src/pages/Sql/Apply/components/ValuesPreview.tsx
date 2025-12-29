/**
 * 数据预览表格
 */

interface Props {
  columns: string[]
  values: any[][]
}

const formatValue = (val: any) => {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'string' && val.startsWith("'") && val.endsWith("'")) {
    return val.slice(1, -1)
  }
  return String(val)
}

const ValuesPreview = ({ columns, values }: Props) => {
  const previewValues = values.slice(0, 5)

  return (
    <div className="values-table-wrapper">
      <table className="values-table">
        <thead>
          <tr>
            <th className="row-num">#</th>
            {columns.map((col, idx) => <th key={idx}>{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {previewValues.map((row, idx) => (
            <tr key={idx}>
              <td className="row-num">{idx + 1}</td>
              {row.map((val, colIdx) => (
                <td key={colIdx} className="value-cell">{formatValue(val)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {values.length > 5 && (
        <div className="more-hint">... 还有 {values.length - 5} 行数据</div>
      )}
    </div>
  )
}

export default ValuesPreview
