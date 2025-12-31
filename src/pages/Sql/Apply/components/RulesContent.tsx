/**
 * 规则列表内容
 */

import type { RuleInfo } from '../../../../services/sql/apply'

interface Props {
  rules: RuleInfo[]
}

// 获取规则类型文本
const getRuleTypeText = (type: string) => {
  const map: Record<string, string> = {
    field_check: '字段检查', table_check: '表检查', index_check: '索引检查',
    syntax_check: '语法检查', security_check: '安全检查', performance_check: '性能检查'
  }
  return map[type] || type || '-'
}

// 获取规则分类文本
const getRuleCategoryText = (category?: string) => {
  if (!category) return '-'
  const map: Record<string, string> = {
    standard: '规范标准', security: '安全规则', performance: '性能规则',
    naming: '命名规范', blocker: '阻断规则', syntax: '语法规则'
  }
  return map[category] || category
}

// 获取规则卡片样式类
const getRuleClass = (rule: RuleInfo) => {
  if (rule.passed) return 'rule-passed'
  if (rule.rule_level >= 2) return 'rule-blocker'
  return 'rule-warning'
}

// 排序规则（未通过的在前）
const sortRules = (rules: RuleInfo[]) => {
  return [...rules].sort((a, b) => (a.passed === b.passed ? 0 : a.passed ? 1 : -1))
}

const RulesContent = ({ rules }: Props) => {
  if (!rules || rules.length === 0) {
    return <div className="empty">暂无关联规则</div>
  }

  return (
    <div className="rules-list">
      {sortRules(rules).map((rule, idx) => (
        <div key={idx} className={`rule-detail-card ${getRuleClass(rule)}`}>
          <div className="rule-header">
            <div className="rule-title-row">
              <span className={`tag tag-sm tag-${rule.passed ? 'success' : rule.rule_level >= 2 ? 'danger' : 'warning'}`}>
                {rule.passed ? '✓ 通过' : rule.rule_level >= 2 ? '✗ 阻断' : '⚠ 警告'}
              </span>
              <span className="rule-name-large">{rule.rule_name}</span>
            </div>
          </div>
          {rule.rule_description && (
            <div className="rule-desc">{rule.rule_description}</div>
          )}
          {!rule.passed && rule.error_message && (
            <div className="rule-info-row error-row">
              {rule.error_message}
            </div>
          )}
          {/* 违规详情 */}
          {!rule.passed && rule.violation_details && rule.violation_details.length > 0 && (
            <div className="violation-details">
              <div className="violation-title">违规详情：</div>
              <div className="violation-table">
                <div className="table-row header">
                  <div className="col col-target">目标对象</div>
                  <div className="col col-type">对象类型</div>
                  <div className="col col-issue">问题描述</div>
                  <div className="col col-value">当前值</div>
                </div>
                {rule.violation_details.map((detail, dIdx) => (
                  <div key={dIdx} className="table-row">
                    <div className="col col-target">{detail.target || '-'}</div>
                    <div className="col col-type">{detail.target_type || '-'}</div>
                    <div className="col col-issue">{detail.issue || '-'}</div>
                    <div className="col col-value">{detail.current_value || '-'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default RulesContent
