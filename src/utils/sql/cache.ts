/**
 * 缓存管理
 * 管理表和字段的缓存
 */

import { fuzzyMatch } from './matcher'
import type { FieldInfo, Suggestion, TableInfo } from './types'

/** 初始化全局缓存 */
export function initCache(): void {
  if (typeof window !== 'undefined') {
    if (!window.sqlFieldSuggestions) window.sqlFieldSuggestions = {}
    if (!window.sqlMetadataCache) window.sqlMetadataCache = {}
  }
}

/** 获取所有缓存的表名建议 */
export function getAllCachedTableSuggestions(): Suggestion[] {
  const suggestions: Suggestion[] = []
  
  if (window.sqlMetadataCache?.tables) {
    window.sqlMetadataCache.tables.forEach(table => {
      suggestions.push({
        caption: table.name,
        value: table.name,
        meta: 'table',
        comment: table.comment || '',
        score: 900
      })
    })
  }
  
  return suggestions
}

/** 获取所有缓存的字段建议 */
export function getAllCachedFieldSuggestions(prefix = ''): Suggestion[] {
  const suggestions: Suggestion[] = []
  const seen = new Set<string>()
  
  if (window.sqlFieldSuggestions) {
    Object.entries(window.sqlFieldSuggestions).forEach(([tableName, fields]) => {
      if (tableName !== tableName.toLowerCase() || !window.sqlFieldSuggestions![tableName.toUpperCase()]) {
        fields.forEach(field => {
          const key = `${field.caption}|${field.meta}`
          if (!seen.has(key)) {
            seen.add(key)
            const matchResult = fuzzyMatch(prefix, field.caption)
            if (matchResult.match) {
              suggestions.push({ ...field, score: field.score + matchResult.score })
            }
          }
        })
      }
    })
  }
  
  return suggestions.sort((a, b) => b.score - a.score)
}

/** 获取指定表的字段 */
export function getTableFields(tableName: string): FieldInfo[] {
  if (!window.sqlFieldSuggestions) return []
  const key = tableName.toLowerCase()
  return window.sqlFieldSuggestions[key] || window.sqlFieldSuggestions[tableName] || []
}

/** 缓存表字段 */
export function cacheTableFields(tableName: string, fields: FieldInfo[]): void {
  if (!window.sqlFieldSuggestions) window.sqlFieldSuggestions = {}
  window.sqlFieldSuggestions[tableName] = fields
  window.sqlFieldSuggestions[tableName.toLowerCase()] = fields
}

/** 获取所有缓存的表名列表 */
export function getAllCachedTables(): TableInfo[] {
  const tables: TableInfo[] = []
  const seen = new Set<string>()
  
  if (window.sqlFieldSuggestions) {
    Object.keys(window.sqlFieldSuggestions).forEach(tableName => {
      const key = tableName.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        tables.push({ name: tableName, comment: '' })
      }
    })
  }
  
  return tables
}

/** 缓存数据库名称列表 */
export function cacheDatabases(databases: string[]): void {
  if (!window.sqlMetadataCache) window.sqlMetadataCache = {}
  window.sqlMetadataCache.databases = databases || []
}

/** 获取所有缓存的数据库名称 */
export function getAllCachedDatabases(): string[] {
  return window.sqlMetadataCache?.databases || []
}

/** 缓存数据库->表的映射关系 */
export function cacheDbTables(dbName: string, tables: string[]): void {
  if (!window.sqlMetadataCache) window.sqlMetadataCache = {}
  if (!window.sqlMetadataCache.dbTables) window.sqlMetadataCache.dbTables = {}
  window.sqlMetadataCache.dbTables[dbName] = tables
  window.sqlMetadataCache.dbTables[dbName.toLowerCase()] = tables
}

/** 获取指定数据库的表列表 */
export function getDbTables(dbName: string): string[] {
  if (!window.sqlMetadataCache?.dbTables) return []
  return window.sqlMetadataCache.dbTables[dbName] || window.sqlMetadataCache.dbTables[dbName.toLowerCase()] || []
}
