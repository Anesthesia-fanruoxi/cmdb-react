/**
 * SQL 分析结果内容
 */

import type { SqlCheckResult } from '../../../../services/sql/apply'
import FieldDetailTable from './FieldDetailTable'
import IndexDetailList from './IndexDetailList'
import ValuesPreview from './ValuesPreview'

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

const AnalysisContent = ({ sql }: Props) => {
  if (!sql) return null

  const sqlType = sql.sql_type?.toUpperCase()
  const isDDL = ['CREATE', 'ALTER', 'DROP', 'TRUNCATE'].includes(sqlType)
  const parseResult = sql.parse_result
  const analyzeInfo = parseResult?.analyze
  const basicInfo = parseResult?.basic_info
  const tableInfo = analyzeInfo?.table_info

  return (
    <div className="analysis-detail">
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
          </div>
        </div>
      )}

      {/* DML - 操作信息 */}
      {!isDDL && analyzeInfo && (
        <div className="info-section">
          <div className="section-label">操作信息</div>
          <div className="info-cards">
            <div className="info-card">
              <div className="card-label">操作类型</div>
              <div className="card-value highlight">{analyzeInfo.operation || sql.sql_type}</div>
            </div>
            <div className="info-card">
              <div className="card-label">目标表</div>
              <div className="card-value highlight">{analyzeInfo.table || sql.table_names?.[0] || '-'}</div>
            </div>
            {analyzeInfo.data_source && (
              <div className="info-card">
                <div className="card-label">数据来源</div>
                <div className={`card-value ${analyzeInfo.data_source === 'SELECT' ? 'rule' : 'valid'}`}>
                  {analyzeInfo.data_source === 'VALUES' ? '直接赋值' : analyzeInfo.data_source === 'SELECT' ? 'SELECT 查询' : analyzeInfo.data_source}
                </div>
              </div>
            )}
            {analyzeInfo.row_count && (
              <div className="info-card">
                <div className="card-label">影响行数</div>
                <div className="card-value valid">{analyzeInfo.row_count}</div>
              </div>
            )}
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
