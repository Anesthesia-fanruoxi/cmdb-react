/**
 * 字段详情表格
 */

interface FieldInfo {
  name?: string
  column_name?: string
  type?: string
  column_type?: string
  nullable?: boolean
  default_value?: string
  comment?: string
}

interface Props {
  fields: FieldInfo[]
}

const FieldDetailTable = ({ fields }: Props) => (
  <div className="field-table">
    <div className="table-row header">
      <div className="col col-name">字段名</div>
      <div className="col col-type">类型</div>
      <div className="col col-null">允许空</div>
      <div className="col col-default">默认值</div>
      <div className="col col-comment">注释</div>
    </div>
    {fields.slice(0, 20).map((field, idx) => (
      <div key={idx} className="table-row">
        <div className="col col-name">{field.name || field.column_name}</div>
        <div className="col col-type">{field.type || field.column_type}</div>
        <div className="col col-null">{field.nullable ? '是' : '否'}</div>
        <div className="col col-default">{field.default_value || '-'}</div>
        <div className={`col col-comment ${!field.comment ? 'missing' : ''}`}>
          {field.comment || <span className="warning-text">缺少注释</span>}
        </div>
      </div>
    ))}
    {fields.length > 20 && (
      <div className="more-hint">... 还有 {fields.length - 20} 个字段</div>
    )}
  </div>
)

export default FieldDetailTable
