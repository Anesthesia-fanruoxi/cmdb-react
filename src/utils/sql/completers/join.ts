/**
 * JOIN 子句补全器
 */

import { SQL_KEYWORDS } from '../keywords'
import { fuzzyMatch } from '../matcher'
import type { SqlContext, Suggestion, TableInfo } from '../types'

/** 获取 JOIN 子句的补全建议 */
export function getJoinCompletions(_context: SqlContext, prefix: string, tables: TableInfo[]): Suggestion[] {
  const suggestions: Suggestion[] = []
  
  // 添加表名建议
  tables.forEach((table, index) => {
    const tableName = typeof table === 'string' ? table : table.name
    if (tableName) {
      const matchResult = fuzzyMatch(prefix, tableName)
      if (matchResult.match) {
        let baseScore = 1000 + matchResult.score
        if (tableName.toLowerCase().startsWith(prefix.toLowerCase())) baseScore += 500
        baseScore -= index * 0.01
        
        suggestions.push({
          caption: tableName,
          value: tableName,
          meta: 'table',
          comment: (table as TableInfo).comment || '',
          score: baseScore
        })
      }
    }
  })
  
  // 添加 JOIN 子句关键词
  SQL_KEYWORDS.JOIN.forEach(keyword => {
    const matchResult = fuzzyMatch(prefix, keyword)
    if (matchResult.match) {
      suggestions.push({ caption: keyword, value: keyword, meta: 'keyword', score: 900 + matchResult.score })
    }
  })
  
  return suggestions
}
