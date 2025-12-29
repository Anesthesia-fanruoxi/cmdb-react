/**
 * WHERE 子句补全器
 */

import { SQL_KEYWORDS } from '../keywords'
import { fuzzyMatch } from '../matcher'
import { getTableFields } from '../cache'
import type { SqlContext, Suggestion } from '../types'

/** 获取 WHERE 子句的补全建议 */
export function getWhereCompletions(context: SqlContext, prefix: string): Suggestion[] {
  const suggestions: Suggestion[] = []
  
  if (context.tables && context.tables.length > 0) {
    // 只显示第一张表的字段
    const firstTable = context.tables[0]
    const shortTableName = firstTable.name.includes('.') 
      ? firstTable.name.split('.').pop()! 
      : firstTable.name
    
    const fields = getTableFields(shortTableName) || getTableFields(firstTable.name)
    
    if (fields && fields.length > 0) {
      fields.forEach(field => {
        const matchResult = fuzzyMatch(prefix, field.caption)
        if (matchResult.match) {
          suggestions.push({ ...field, score: (field.score || 900) + matchResult.score })
        }
      })
    }
    
    // 多表情况下添加表名/别名建议
    if (context.tables.length > 1) {
      context.tables.forEach(tableInfo => {
        const shortName = tableInfo.name.includes('.') 
          ? tableInfo.name.split('.').pop()! 
          : tableInfo.name
        
        const tableMatch = fuzzyMatch(prefix, shortName)
        if (tableMatch.match) {
          suggestions.push({
            caption: shortName,
            value: shortName,
            meta: 'table',
            comment: '表名',
            score: 850 + tableMatch.score
          })
        }
        
        if (tableInfo.alias) {
          const aliasMatch = fuzzyMatch(prefix, tableInfo.alias)
          if (aliasMatch.match) {
            suggestions.push({
              caption: tableInfo.alias,
              value: tableInfo.alias,
              meta: 'alias',
              comment: `${shortName} 的别名`,
              score: 870 + aliasMatch.score
            })
          }
        }
      })
    }
  }
  
  // 添加 WHERE 子句关键词
  SQL_KEYWORDS.WHERE.forEach(keyword => {
    const matchResult = fuzzyMatch(prefix, keyword)
    if (matchResult.match) {
      suggestions.push({ caption: keyword, value: keyword, meta: 'keyword', score: 800 + matchResult.score })
    }
  })
  
  return suggestions
}
