/**
 * 字段详情表格
 */

interface FieldInfo {
  name?: string
  column_name?: string
  type?: string
  column_type?: string
  nullable?: boolean
  default?: string
  default_value?: string
  comment?: string
}

interface Props {
  fields: FieldInfo[]
}

const FieldDetailTable = ({ fields }: Props) => {
  // 过滤掉无效字段（type 为空的情况）
  const validFields = fields.filter(f => f.type || f.column_type)
  
  return (
    <div className="field-table">
      <div className="table-row header">
        <div className="col col-name">字段名</div>
        <div className="col col-type">类型</div>
        <div className="col col-null">可空</div>
        <div className="col col-default">默认值</div>
        <div className="col col-comment">注释</div>
      </div>
      {validFields.slice(0, 20).map((field, idx) => (
        <div key={idx} className={`table-row ${!field.comment ? 'warning-row' : ''}`}>
          <div className="col col-name">{field.name || field.column_name}</div>
          <div className="col col-type">
            <span className="type-tag">{field.type || field.column_type}</span>
          </div>
          <div className="col col-null">
            {field.nullable ? <span className="check-icon">✓</span> : '-'}
          </div>
          <div className="col col-default">{field.default || field.default_value || '-'}</div>
          <div className={`col col-comment ${!field.comment ? 'missing' : ''}`}>
            {field.comment || <span className="warning-tag">未设置</span>}
          </div>
        </div>
      ))}
      {validFields.length > 20 && (
        <div className="more-hint">... 还有 {validFields.length - 20} 个字段</div>
      )}
    </div>
  )
}

export default FieldDetailTable
