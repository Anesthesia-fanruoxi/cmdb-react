/**
 * SQL 语法错误面板
 */

import type { SqlCheckResult } from '../../../../services/sql/apply'

interface Props {
  sql: SqlCheckResult
}

// 获取SQL类型标签样式
const getTypeClass = (type: string) => {
  const map: Record<string, string> = {
    CREATE: 'success', ALTER: 'warning', DROP: 'danger',
    INSERT: 'primary', UPDATE: 'warning', DELETE: 'danger', SELECT: 'info'
  }
  return map[type] || ''
}

// 获取语法错误信息
const getSyntaxError = (sql: SqlCheckResult) => {
  const rules = sql.rule_infos || sql.rule_results || []
  const syntaxRule = rules.find(r => r.rule_type === 'syntax_check' && !r.passed)
  return syntaxRule?.error_message || '未知语法错误'
}

const SyntaxErrorPanel = ({ sql }: Props) => {
  const errorMsg = getSyntaxError(sql)
  const simplifiedError = errorMsg.split('\n')[0] || '未知语法错误'
  const detailedError = errorMsg.split('\n').slice(1).join('\n') || ''

  return (
    <div className="syntax-error-panel">
      <div className="error-header">
        <span className="error-icon-large">✗</span>
        <span className="error-title">SQL 语法错误</span>
      </div>
      <div className="error-content">
        <div className="error-info-row">
          <span className="error-label">SQL类型：</span>
          <span className={`tag tag-${getTypeClass(sql?.sql_type || '')}`}>
            {sql?.sql_type || '-'}
          </span>
        </div>
        <div className="error-info-row">
          <span className="error-label">错误摘要：</span>
        </div>
        <div className="error-message-box simple">
          <div className="error-simple-text">{simplifiedError}</div>
        </div>
        {detailedError && (
          <>
            <div className="error-info-row">
              <span className="error-label">详细信息：</span>
            </div>
            <div className="error-message-box detail">
              <pre>{detailedError}</pre>
            </div>
          </>
        )}
        <div className="error-tip">
          <span>ℹ 请检查 SQL 语法后重新提交</span>
        </div>
      </div>
    </div>
  )
}

export default SyntaxErrorPanel
