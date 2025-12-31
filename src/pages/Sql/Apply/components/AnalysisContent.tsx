/**
 * SQL 分析结果内容
 */

import type { SqlCheckResult } from '../../../../services/sql/apply'
import FieldDetailTable from './FieldDetailTable'
import IndexDetailList from './IndexDetailList'
import ValuesPreview from './ValuesPreview'
import AlterDetailTable from './AlterDetailTable'

interface Props {
  sql: SqlCheckResult | null
}

// 获取风险等级样式
const getRiskClass = (level?: string) => {
  if (!level) return ''
  const map: Record<string, string> = {
    safe: 'valid', low: 'valid', warning: 'rule', high: 'danger', danger: 'danger'
  }
  return map[level] || ''
}

// 获取风险等级文本
const getRiskText = (level?: string) => {
  if (!level) return '-'
  const map: Record<string, string> = { safe: '低', low: '低', warning: '中', high: '高', danger: '高' }
  return map[level] || level
}

// 判断字段注释是否合规（100%覆盖）
const isCommentValid = (summary?: string) => {
  if (!summary) return true
  const match = summary.match(/\((\d+)%\)/)
  return match ? parseInt(match[1]) === 100 : true
}

// 预估行数样式
const getEstimatedRowsClass = (rows?: number) => {
  if (rows === undefined || rows === null) return ''
  if (rows < 100) return 'valid'
  if (rows < 1000) return 'rule'
  return 'danger'
}

const AnalysisContent = ({ sql }: Props) => {
  if (!sql) return null

  const sqlType = sql.sql_type?.toUpperCase()
  const isDDL = ['CREATE', 'ALTER', 'DROP', 'TRUNCATE'].includes(sqlType)
  const isDML = ['UPDATE', 'DELETE', 'INSERT'].includes(sqlType)
  const isUpdateOrDelete = ['UPDATE', 'DELETE'].includes(sqlType)
  const parseResult = sql.parse_result
  const analyzeInfo = parseResult?.analyze
  const basicInfo = parseResult?.basic_info
  const tableInfo = analyzeInfo?.table_info
  const fieldInfo = analyzeInfo?.field_info
  const hasWhere = analyzeInfo?.has_where === true
  const setClauses = analyzeInfo?.set_clauses || []
  const alterInfo = analyzeInfo?.alter_info
  const alterDetail = analyzeInfo?.alter_detail || []
  const isAlter = sqlType === 'ALTER'

  return (
    <div className="analysis-detail">
      {/* 危险警告 - 无 WHERE 条件 */}
      {isUpdateOrDelete && !hasWhere && (
        <div className="danger-alert">
          <strong>⚠️ 危险操作警告</strong>
          <p>{sqlType} 语句没有 WHERE 条件，将{sqlType === 'DELETE' ? '删除' : '更新'}全表数据！此操作不可逆！</p>
        </div>
      )}

      {/* 阻断警告 */}
      {sql.has_blocker && (
        <div className="blocker-alert">
          <strong>检测到阻断规则，无法提交申请</strong>
          <p>请修改 SQL 后重新提交</p>
        </div>
      )}

      {/* 基本信息 */}
      <div className="info-section">
        <div className="section-label">基本信息</div>
        <div className="info-cards">
          <div className="info-card">
            <div className="card-label">类型</div>
            <div className="card-value highlight">{sql.sql_type || '-'}</div>
          </div>
          <div className="info-card">
            <div className="card-label">分类</div>
            <div className="card-value highlight">{sql.sql_category || (isDDL ? 'DDL' : 'DML')}</div>
          </div>
          {basicInfo?.risk_level && (
            <div className="info-card">
              <div className="card-label">风险等级</div>
              <div className={`card-value ${getRiskClass(basicInfo.risk_level)}`}>
                {getRiskText(basicInfo.risk_level)}
              </div>
            </div>
          )}
          {basicInfo?.risk_reason && (
            <div className="info-card">
              <div className="card-label">风险原因</div>
              <div className="card-value rule">{basicInfo.risk_reason}</div>
            </div>
          )}
        </div>
      </div>

      {/* DDL - 表信息 */}
      {isDDL && tableInfo && (
        <div className="info-section">
          <div className="section-label">表信息</div>
          <div className="info-cards">
            <div className="info-card">
              <div className="card-label">表名</div>
              <div className="card-value highlight">{tableInfo.table_name}</div>
            </div>
            {tableInfo.primary_key && (
              <div className="info-card">
                <div className="card-label">主键</div>
                <div className="card-value">{tableInfo.primary_key}</div>
              </div>
            )}
            <div className="info-card">
              <div className="card-label">字段数量</div>
              <div className="card-value valid">{tableInfo.field_count || 0}</div>
            </div>
            <div className="info-card">
              <div className="card-label">索引数量</div>
              <div className="card-value valid">{tableInfo.index_count || 0}</div>
            </div>
            {tableInfo.engine && (
              <div className="info-card">
                <div className="card-label">引擎</div>
                <div className="card-value rule">{tableInfo.engine}</div>
              </div>
            )}
            {tableInfo.charset && (
              <div className="info-card">
                <div className="card-label">字符集</div>
                <div className="card-value rule">{tableInfo.charset}</div>
              </div>
            )}
            {tableInfo.comment && (
              <div className="info-card full-width">
                <div className="card-label">表注释</div>
                <div className="card-value">{tableInfo.comment}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DDL - 字段信息汇总 */}
      {isDDL && fieldInfo && (
        <div className="info-section">
          <div className="section-label">字段信息</div>
          <div className="info-cards">
            {fieldInfo.comment_summary && (
              <div className="info-card">
                <div className="card-label">注释覆盖</div>
                <div className={`card-value ${isCommentValid(fieldInfo.comment_summary) ? 'valid' : 'danger'}`}>
                  {fieldInfo.comment_summary}
                </div>
              </div>
            )}
            {fieldInfo.default_summary && (
              <div className="info-card">
                <div className="card-label">默认值</div>
                <div className="card-value valid">{fieldInfo.default_summary}</div>
              </div>
            )}
            {fieldInfo.nullable_summary && (
              <div className="info-card">
                <div className="card-label">可空字段</div>
                <div className="card-value valid">{fieldInfo.nullable_summary}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ALTER - 操作信息 */}
      {isAlter && alterInfo && (
        <div className="info-section">
          <div className="section-label">ALTER操作信息</div>
          <div className="info-cards">
            <div className="info-card">
              <div className="card-label">表名</div>
              <div className="card-value highlight">{alterInfo.table_name || sql.table_names?.[0] || '-'}</div>
            </div>
            <div className="info-card">
              <div className="card-label">操作数量</div>
              <div className="card-value valid">{alterInfo.total_actions || 0}</div>
            </div>
            {alterInfo.add_field_count !== undefined && (
              <div className="info-card">
                <div className="card-label">添加字段</div>
                <div className="card-value valid">{alterInfo.add_field_count}</div>
              </div>
            )}
            {alterInfo.modify_field_count !== undefined && (
              <div className="info-card">
                <div className="card-label">修改字段</div>
                <div className="card-value valid">{alterInfo.modify_field_count}</div>
              </div>
            )}
            {alterInfo.change_field_count !== undefined && (
              <div className="info-card">
                <div className="card-label">变更字段</div>
                <div className="card-value valid">{alterInfo.change_field_count}</div>
              </div>
            )}
            {alterInfo.drop_field_count !== undefined && (
              <div className="info-card">
                <div className="card-label">删除字段</div>
                <div className={`card-value ${alterInfo.drop_field_count > 0 ? 'danger' : 'valid'}`}>
                  {alterInfo.drop_field_count}
                </div>
              </div>
            )}
            {alterInfo.add_index_count !== undefined && (
              <div className="info-card">
                <div className="card-label">添加索引</div>
                <div className="card-value valid">{alterInfo.add_index_count}</div>
              </div>
            )}
            {alterInfo.drop_index_count !== undefined && (
              <div className="info-card">
                <div className="card-label">删除索引</div>
                <div className="card-value valid">{alterInfo.drop_index_count}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ALTER - 操作详情 */}
      {isAlter && alterDetail.length > 0 && (
        <div className="info-section">
          <div className="section-label">操作详情</div>
          <AlterDetailTable details={alterDetail} />
        </div>
      )}

      {/* DML - 操作信息 */}
      {isDML && analyzeInfo && (
        <div className="info-section">
          <div className="section-label">操作信息</div>
          <div className="info-cards">
            <div className="info-card">
              <div className="card-label">操作类型</div>
              <div className={`card-value ${sqlType === 'DELETE' ? 'danger' : 'highlight'}`}>
                {analyzeInfo.operation || sql.sql_type}
              </div>
            </div>
            <div className="info-card">
              <div className="card-label">目标表</div>
              <div className="card-value highlight">{analyzeInfo.table || sql.table_names?.[0] || '-'}</div>
            </div>
            {/* UPDATE/DELETE 显示 WHERE 条件状态 */}
            {isUpdateOrDelete && (
              <div className={`info-card ${!hasWhere ? 'danger-card' : ''}`}>
                <div className="card-label">WHERE 条件</div>
                <div className={`card-value ${hasWhere ? 'valid' : 'danger'}`}>
                  {hasWhere ? '有' : '无'}
                </div>
              </div>
            )}
            {/* 预估影响行数 */}
            {analyzeInfo.estimated_rows != null && (
              <div className="info-card">
                <div className="card-label">预估影响行数</div>
                <div className={`card-value ${getEstimatedRowsClass(analyzeInfo.estimated_rows)}`}>
                  {analyzeInfo.estimated_rows.toLocaleString()} 行
                </div>
              </div>
            )}
            {/* INSERT 数据来源 */}
            {analyzeInfo.data_source && (
              <div className="info-card">
                <div className="card-label">数据来源</div>
                <div className={`card-value ${analyzeInfo.data_source === 'SELECT' ? 'rule' : 'valid'}`}>
                  {analyzeInfo.data_source === 'VALUES' ? '直接赋值' : analyzeInfo.data_source === 'SELECT' ? 'SELECT 查询' : analyzeInfo.data_source}
                </div>
              </div>
            )}
            {/* INSERT 行数 */}
            {analyzeInfo.row_count && (
              <div className="info-card">
                <div className="card-label">插入行数</div>
                <div className="card-value valid">{analyzeInfo.row_count}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* UPDATE - WHERE 条件展示 */}
      {sqlType === 'UPDATE' && analyzeInfo?.where_clause && (
        <div className="info-section">
          <div className="section-label">WHERE 条件</div>
          <div className="where-clause">{analyzeInfo.where_clause}</div>
        </div>
      )}

      {/* UPDATE - 修改字段列表 */}
      {sqlType === 'UPDATE' && setClauses.length > 0 && (
        <div className="info-section">
          <div className="section-label">修改字段 ({setClauses.length} 个)</div>
          <div className="set-clauses-table">
            <table>
              <thead>
                <tr>
                  <th>字段名</th>
                  <th>新值</th>
                  <th>类型</th>
                </tr>
              </thead>
              <tbody>
                {setClauses.map((clause: any, idx: number) => (
                  <tr key={idx}>
                    <td className="field-name">{clause.column}</td>
                    <td className="field-value">{clause.value ?? 'NULL'}</td>
                    <td>
                      <span className={`type-tag ${clause.is_expr ? 'expr' : 'const'}`}>
                        {clause.is_expr ? '表达式' : '常量'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 影响说明 - 无 WHERE 时 */}
      {isUpdateOrDelete && !hasWhere && (
        <div className="info-section">
          <div className="section-label">影响说明</div>
          <div className="impact-warning">
            <span className="warning-icon">⚠️</span>
            <div className="warning-content">
              <div className="warning-title">此操作将产生以下影响：</div>
              <ul>
                <li>{sqlType === 'DELETE' ? '删除' : '更新'}表 <strong>{analyzeInfo?.table || '未知'}</strong> 中的所有数据</li>
                <li>此操作不可逆，{sqlType === 'DELETE' ? '数据将永久丢失' : '原数据将被覆盖'}</li>
                <li>建议添加 WHERE 条件限制{sqlType === 'DELETE' ? '删除' : '更新'}范围</li>
                <li>建议在执行前进行数据备份</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 字段信息 */}
      {analyzeInfo?.columns && analyzeInfo.columns.length > 0 && (
        <div className="info-section">
          <div className="section-label">字段信息 ({analyzeInfo.columns.length} 个字段)</div>
          <div className="columns-list">
            {analyzeInfo.columns.map((col: string, idx: number) => (
              <span key={idx} className="column-tag">{col}</span>
            ))}
          </div>
        </div>
      )}

      {/* 字段详情表格 */}
      {analyzeInfo?.field_detail && analyzeInfo.field_detail.length > 0 && (
        <div className="info-section">
          <div className="section-label">字段详情</div>
          <FieldDetailTable fields={analyzeInfo.field_detail} />
        </div>
      )}

      {/* 索引详情 */}
      {analyzeInfo?.index_detail && analyzeInfo.index_detail.length > 0 && (
        <div className="info-section">
          <div className="section-label">索引详情</div>
          <IndexDetailList indexes={analyzeInfo.index_detail} />
        </div>
      )}

      {/* 数据预览 */}
      {analyzeInfo?.values && analyzeInfo.values.length > 0 && analyzeInfo?.columns && analyzeInfo.columns.length > 0 && (
        <div className="info-section">
          <div className="section-label">数据预览 ({analyzeInfo.values.length} 行)</div>
          <ValuesPreview columns={analyzeInfo.columns} values={analyzeInfo.values} />
        </div>
      )}

      {/* 无详细分析时的提示 */}
      {!tableInfo && !analyzeInfo && (
        <div className="no-analysis-tip">暂无该类型 SQL 的详细分析</div>
      )}
    </div>
  )
}

export default AnalysisContent
