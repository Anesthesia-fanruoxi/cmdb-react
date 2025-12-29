/**
 * 索引详情列表
 */

interface IndexInfo {
  name?: string
  index_name?: string
  is_primary?: boolean
  is_unique?: boolean
  columns?: string[]
}

interface Props {
  indexes: IndexInfo[]
}

const IndexDetailList = ({ indexes }: Props) => (
  <div className="index-table">
    <div className="table-row header">
      <div className="col col-type">类型</div>
      <div className="col col-name">索引名</div>
      <div className="col col-columns">字段</div>
    </div>
    {indexes.map((index, idx) => (
      <div key={idx} className="table-row">
        <div className="col col-type">
          <span className={`tag tag-${index.is_unique ? 'warning' : 'info'}`}>
            {index.is_primary ? 'PRIMARY' : index.is_unique ? 'UNIQUE' : 'INDEX'}
          </span>
        </div>
        <div className="col col-name">{index.name || index.index_name}</div>
        <div className="col col-columns">{(index.columns || []).join(', ')}</div>
      </div>
    ))}
  </div>
)

export default IndexDetailList
