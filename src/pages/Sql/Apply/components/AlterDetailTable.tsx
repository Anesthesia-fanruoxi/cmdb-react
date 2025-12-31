/**
 * ALTER 操作详情表格
 */

interface AlterDetail {
  action?: string
  target?: string
  column?: {
    name?: string
    type?: string
    nullable?: boolean
    comment?: string
  }
  index?: {
    name?: string
  }
  position?: string
  description?: string
}

interface Props {
  details: AlterDetail[]
}

// 操作类型标签颜色
const getActionClass = (action?: string) => {
  const map: Record<string, string> = {
    ADD: 'success', MODIFY: 'warning', CHANGE: 'warning', DROP: 'danger', RENAME: 'info'
  }
  return map[action || ''] || ''
}

// 操作类型中文
const getActionText = (action?: string) => {
  const map: Record<string, string> = {
    ADD: '添加', MODIFY: '修改', CHANGE: '变更', DROP: '删除', RENAME: '重命名'
  }
  return map[action || ''] || action || '-'
}

// 行样式
const getRowClass = (detail: AlterDetail) => {
  if (detail.action === 'DROP') return 'danger-row'
  if (detail.action === 'ADD' && detail.position) return 'warning-row'
  if (detail.column?.name && !detail.column?.comment) return 'warning-row'
  return ''
}

const AlterDetailTable = ({ details }: Props) => {
  if (!details || details.length === 0) return null

  return (
    <div className="alter-detail-table">
      <div className="table-row header">
        <div className="col col-action">操作类型</div>
        <div className="col col-target">目标</div>
        <div className="col col-column">对象</div>
        <div className="col col-type">类型</div>
        <div className="col col-null">可空</div>
        <div className="col col-position">位置</div>
        <div className="col col-desc">描述</div>
      </div>
      {details.map((detail, idx) => (
        <div key={idx} className={`table-row ${getRowClass(detail)}`}>
          <div className="col col-action">
            <span className={`action-tag ${getActionClass(detail.action)}`}>
              {getActionText(detail.action)}
            </span>
          </div>
          <div className="col col-target">{detail.target || '-'}</div>
          <div className="col col-column">{detail.column?.name || detail.index?.name || '-'}</div>
          <div className="col col-type">
            {detail.column?.type ? (
              <span className="type-tag">{detail.column.type}</span>
            ) : '-'}
          </div>
          <div className="col col-null">
            {detail.column?.nullable === true ? '✓' : detail.column?.nullable === false ? '✗' : '-'}
          </div>
          <div className="col col-position">
            {detail.position ? (
              <span className="position-tag">{detail.position}</span>
            ) : '-'}
          </div>
          <div className="col col-desc">{detail.description || '-'}</div>
        </div>
      ))}
    </div>
  )
}

export default AlterDetailTable
