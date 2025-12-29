/**
 * 点号补全器（表名.字段 / 别名.字段 / 库名.表名）
 */

import { fuzzyMatch } from '../matcher'
import { getTableFields, getDbTables, getAllCachedDatabases } from '../cache'
import type { Suggestion } from '../types'

/** 获取点号后的补全建议 */
export function getDotCompletions(
  identifier: string, 
  afterDotPrefix: string, 
  tableAliases: Record<string, string>
): Suggestion[] {
  const suggestions: Suggestion[] = []
  const key = identifier.toLowerCase()
  
  // 首先检查是否是数据库名
  const databases = getAllCachedDatabases() || []
  const isDatabase = databases.some(db => {
    const dbName = typeof db === 'string' ? db : ''
    return dbName && dbName.toLowerCase() === key
  })
  
  if (isDatabase) {
    // 是数据库名，返回该库的表
    const dbTables = getDbTables(identifier)
    if (dbTables && dbTables.length > 0) {
      dbTables.forEach((tableName, index) => {
        const matchResult = fuzzyMatch(afterDotPrefix, tableName)
        if (!afterDotPrefix || matchResult.match) {
          suggestions.push({
            caption: tableName,
            value: tableName,
            meta: 'table',
            comment: `[${identifier}]`,
            score: 1000 + matchResult.score - index * 0.01
          })
        }
      })
      
      return suggestions.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.caption.localeCompare(b.caption)
      })
    }
  }
  
  // 检查是否是别名
  let actualTableName = identifier
  if (tableAliases && tableAliases[key]) {
    actualTableName = tableAliases[key]
  }
  
  // 获取字段
  let fields = getTableFields(actualTableName)
  if (!fields || fields.length === 0) {
    fields = getTableFields(identifier)
  }
  
  if (fields && fields.length > 0) {
    fields.forEach(field => {
      const matchResult = fuzzyMatch(afterDotPrefix, field.caption)
      if (!afterDotPrefix || matchResult.match) {
        suggestions.push({ ...field, score: (field.score || 900) + matchResult.score })
      }
    })
  }
  
  return suggestions.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.caption.localeCompare(b.caption)
  })
}
