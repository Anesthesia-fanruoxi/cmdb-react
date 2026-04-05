/**
 * WHERE 子句补全器
 * 支持多表字段提示，FROM 里的表字段优先级更高
 */

import { SQL_KEYWORDS } from '../keywords'
import { fuzzyMatch } from '../matcher'
import { getTableFields } from '../cache'
import type { SqlContext, Suggestion } from '../types'

/** 获取 WHERE 子句的补全建议 */
export function getWhereCompletions(context: SqlContext, prefix: string): Suggestion[] {
  const suggestions: Suggestion[] = []
  const seen = new Set<string>()

  if (context.tables && context.tables.length > 0) {
    // 遍历所有 FROM 里的表，第一张表字段评分最高
    context.tables.forEach((tableInfo, tableIdx) => {
      const shortName = tableInfo.name.includes('.')
        ? tableInfo.name.split('.').pop()!
        : tableInfo.name

      // 字段建议
      const fields = getTableFields(shortName) || getTableFields(tableInfo.name)
      if (fields && fields.length > 0) {
        const scoreBonus = tableIdx === 0 ? 200 : Math.max(0, 100 - tableIdx * 20)
        fields.forEach(field => {
          const matchResult = fuzzyMatch(prefix, field.caption)
          if (matchResult.match) {
            const key = `field:${field.caption}`
            if (!seen.has(key)) {
              seen.add(key)
              suggestions.push({
                ...field,
                comment: `${shortName}.${field.caption}`,
                score: (field.score || 900) + matchResult.score + scoreBonus
              })
            }
          }
        })
      }

      // 多表时提供表名/别名建议（用于 alias.field 场景）
      if (context.tables.length > 1) {
        const tableMatch = fuzzyMatch(prefix, shortName)
        if (tableMatch.match && !seen.has(`table:${shortName}`)) {
          seen.add(`table:${shortName}`)
          suggestions.push({
            caption: shortName,
            value: shortName,
            meta: 'table',
            comment: '表名',
            score: 850 + tableMatch.score - tableIdx * 10
          })
        }

        if (tableInfo.alias) {
          const aliasMatch = fuzzyMatch(prefix, tableInfo.alias)
          if (aliasMatch.match && !seen.has(`alias:${tableInfo.alias}`)) {
            seen.add(`alias:${tableInfo.alias}`)
            suggestions.push({
              caption: tableInfo.alias,
              value: tableInfo.alias,
              meta: 'alias',
              comment: `${shortName} 的别名`,
              score: 870 + aliasMatch.score - tableIdx * 10
            })
          }
        }
      }
    })
  }

  // WHERE 子句关键字
  SQL_KEYWORDS.WHERE.forEach(keyword => {
    const matchResult = fuzzyMatch(prefix, keyword)
    if (matchResult.match) {
      suggestions.push({ caption: keyword, value: keyword, meta: 'keyword', score: 800 + matchResult.score })
    }
  })

  return suggestions
}
