/**
 * 索引详情列表
 */

interface IndexInfo {
  name?: string
  index_name?: string
  type?: string
  is_primary?: boolean
  is_unique?: boolean
  columns?: string[]
}

interface Props {
  indexes: IndexInfo[]
}

// 获取索引类型
const getIndexType = (index: IndexInfo) => {
  if (index.type) return index.type
  if (index.is_primary) return 'PRIMARY'
  if (index.is_unique) return 'UNIQUE'
  return 'INDEX'
}

// 获取索引类型样式
const getIndexTagType = (type: string) => {
  if (type === 'PRIMARY') return 'danger'
  if (type === 'UNIQUE') return 'warning'
  return 'info'
}

const IndexDetailList = ({ indexes }: Props) => (
  <div className="index-table">
    <div className="table-row header">
      <div className="col">索引名</div>
      <div className="col">类型</div>
      <div className="col">字段</div>
    </div>
    {indexes.map((index, idx) => {
      const indexType = getIndexType(index)
      return (
        <div key={idx} className="table-row">
          <div className="col">{index.name || index.index_name || 'PRIMARY'}</div>
          <div className="col">
            <span className={`tag tag-${getIndexTagType(indexType)}`}>{indexType}</span>
          </div>
          <div className="col">{(index.columns || []).join(', ')}</div>
        </div>
      )
    })}
  </div>
)

export default IndexDetailList
