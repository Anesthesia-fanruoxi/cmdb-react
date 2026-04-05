/**
 * SELECT 子句补全器
 * 支持多表字段提示，FROM 里的表字段优先级更高
 */

import { SQL_KEYWORDS } from '../keywords'
import { fuzzyMatch } from '../matcher'
import { getTableFields } from '../cache'
import type { SqlContext, Suggestion, TableInfo } from '../types'

/** 获取 SELECT 子句的补全建议 */
export function getSelectCompletions(context: SqlContext, prefix: string, _tables: TableInfo[]): Suggestion[] {
  const suggestions: Suggestion[] = []
  const seen = new Set<string>()

  if (context.tables && context.tables.length > 0) {
    // 遍历所有 FROM 里的表，第一张表字段评分最高
    context.tables.forEach((tableInfo, tableIdx) => {
      const shortName = tableInfo.name.includes('.')
        ? tableInfo.name.split('.').pop()!
        : tableInfo.name

      // 表名建议
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

      // 别名建议
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

      // 字段建议：第一张表评分最高，后续表依次降低
      const fields = getTableFields(shortName) || getTableFields(tableInfo.name)
      if (fields && fields.length > 0) {
        const scoreBonus = tableIdx === 0 ? 200 : Math.max(0, 100 - tableIdx * 20)
        fields.forEach(field => {
          const matchResult = fuzzyMatch(prefix, field.caption)
          if (matchResult.match) {
            const key = `field:${field.caption}`
            // 同名字段只保留评分最高的（第一张表的）
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
    })
  }

  // SQL 关键字
  SQL_KEYWORDS.SELECT.forEach(keyword => {
    const matchResult = fuzzyMatch(prefix, keyword)
    if (matchResult.match) {
      suggestions.push({ caption: keyword, value: keyword, meta: 'keyword', score: 800 + matchResult.score })
    }
  })

  // SQL 函数
  SQL_KEYWORDS.FUNCTIONS.forEach(func => {
    const matchResult = fuzzyMatch(prefix, func)
    if (matchResult.match) {
      suggestions.push({ caption: func, value: func + '()', meta: 'function', score: 700 + matchResult.score })
    }
  })

  return suggestions
}
