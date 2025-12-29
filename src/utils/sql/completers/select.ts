/**
 * SELECT 子句补全器
 */

import { SQL_KEYWORDS } from '../keywords'
import { fuzzyMatch } from '../matcher'
import { getTableFields } from '../cache'
import type { SqlContext, Suggestion, TableInfo } from '../types'

/** 获取 SELECT 子句的补全建议 */
export function getSelectCompletions(context: SqlContext, prefix: string, _tables: TableInfo[]): Suggestion[] {
  const suggestions: Suggestion[] = []
  
  // 类似 Navicat：只显示 FROM 后第一张表的字段
  if (context.tables && context.tables.length > 0) {
    // 添加表名和别名建议
    context.tables.forEach(tableInfo => {
      const tableMatch = fuzzyMatch(prefix, tableInfo.name)
      if (tableMatch.match) {
        suggestions.push({
          caption: tableInfo.name,
          value: tableInfo.name,
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
            comment: `${tableInfo.name} 的别名`,
            score: 870 + aliasMatch.score
          })
        }
      }
    })
    
    // 只处理第一张表的字段
    const firstTable = context.tables[0]
    const fields = getTableFields(firstTable.name)
    
    if (fields && fields.length > 0) {
      fields.forEach(field => {
        const matchResult = fuzzyMatch(prefix, field.caption)
        if (matchResult.match) {
          suggestions.push({ ...field, score: (field.score || 900) + matchResult.score })
        }
      })
    }
  }
  
  // 添加 SELECT 子句关键词
  SQL_KEYWORDS.SELECT.forEach(keyword => {
    const matchResult = fuzzyMatch(prefix, keyword)
    if (matchResult.match) {
      suggestions.push({ caption: keyword, value: keyword, meta: 'keyword', score: 800 + matchResult.score })
    }
  })
  
  // 添加 SQL 函数
  SQL_KEYWORDS.FUNCTIONS.forEach(func => {
    const matchResult = fuzzyMatch(prefix, func)
    if (matchResult.match) {
      suggestions.push({ caption: func, value: func + '()', meta: 'function', score: 700 + matchResult.score })
    }
  })
  
  return suggestions
}
