/**
 * FROM 子句补全器
 */

import { SQL_KEYWORDS } from '../keywords'
import { fuzzyMatch } from '../matcher'
import { getAllCachedTables, getAllCachedDatabases } from '../cache'
import type { SqlContext, Suggestion, TableInfo } from '../types'

/** 获取 FROM 子句的补全建议 */
export function getFromCompletions(_context: SqlContext, prefix: string, tables: TableInfo[]): Suggestion[] {
  const suggestions: Suggestion[] = []
  const seen = new Set<string>()
  const p = (prefix || '').toLowerCase()
  const pNorm = p.replace(/_/g, '')
  
  // FROM 优先级：表 > 库 > 关键字（JOIN 连拼略高于普通关键字，仍低于表/库）
  SQL_KEYWORDS.FROM.forEach(keyword => {
    const matchResult = fuzzyMatch(prefix, keyword)
    if (matchResult.match) {
      const isJoinPhrase = keyword.includes('JOIN')
      const baseScore = isJoinPhrase ? 1000 : 600
      suggestions.push({ caption: keyword, value: keyword, meta: 'keyword', score: baseScore + matchResult.score })
    }
  })
  
  // 数据库名（低于表名）
  const databases = getAllCachedDatabases() || []
  
  databases.forEach(dbName => {
    const db = typeof dbName === 'string' ? dbName : ''
    if (!db) return
    
    const matchResult = fuzzyMatch(prefix, db)
    if (matchResult.match) {
      const n = db.toLowerCase()
      const nNorm = n.replace(/_/g, '')
      const isPrefixMatch = p && (n.startsWith(p) || (pNorm && nNorm.startsWith(pNorm)))
      const baseScore = isPrefixMatch ? 1600 : 1200
      
      suggestions.push({
        caption: db,
        value: db,
        meta: 'database',
        comment: '数据库',
        score: baseScore
      })
    }
  })
  
  // 合并当前库的表和缓存中所有库的表
  const currentTables = tables || []
  const cachedTables = getAllCachedTables() || []
  
  currentTables.forEach(table => {
    const tableName = typeof table === 'string' ? table : table.name
    if (tableName) seen.add(tableName.toLowerCase())
  })
  
  const allTables = [
    ...currentTables.map(t => ({ ...(typeof t === 'string' ? { name: t } : t), isCurrentDb: true })),
    ...cachedTables.filter(t => !seen.has(t.name.toLowerCase())).map(t => ({ ...t, isCurrentDb: false }))
  ]
  
  // 表名最高优先
  allTables.forEach(table => {
    const tableName = typeof table === 'string' ? table : table.name
    if (tableName) {
      const matchResult = fuzzyMatch(prefix, tableName)
      if (matchResult.match) {
        let baseScore = table.isCurrentDb ? 2500 : 2000
        const n = tableName.toLowerCase()
        const nNorm = n.replace(/_/g, '')
        if (p && (n.startsWith(p) || (pNorm && nNorm.startsWith(pNorm)))) baseScore += 500
        
        suggestions.push({
          caption: tableName,
          value: tableName,
          meta: table.isCurrentDb ? 'table' : 'table*',
          comment: table.comment || '',
          score: baseScore
        })
      }
    }
  })
  
  suggestions.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.caption.localeCompare(b.caption)
  })
  
  return suggestions
}
