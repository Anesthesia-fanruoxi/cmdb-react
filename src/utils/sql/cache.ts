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

/** 持久化元数据到 localStorage */
export function persistMetadataToStorage(projectName: string): void {
  if (!window.sqlMetadataCache) return
  
  const cacheData = {
    databases: window.sqlMetadataCache.databases || [],
    dbTables: window.sqlMetadataCache.dbTables || {},
    fields: window.sqlFieldSuggestions || {},
    timestamp: Date.now(),
    version: '1.0'
  }
  
  try {
    const key = `sql-metadata-${projectName}`
    localStorage.setItem(key, JSON.stringify(cacheData))
    console.log(`[缓存持久化] ✅ 已保存到 localStorage: ${key}`)
  } catch (error) {
    console.error('[缓存持久化] ❌ 保存失败:', error)
  }
}

/** 从 localStorage 恢复元数据 */
export function restoreMetadataFromStorage(projectName: string): boolean {
  try {
    const key = `sql-metadata-${projectName}`
    const cached = localStorage.getItem(key)
    
    if (!cached) {
      console.log(`[缓存恢复] ⚠️ 未找到缓存: ${key}`)
      return false
    }
    
    const cacheData = JSON.parse(cached)
    
    // 检查缓存版本
    if (cacheData.version !== '1.0') {
      console.log('[缓存恢复] ⚠️ 缓存版本不匹配,忽略')
      return false
    }
    
    // 检查缓存时间(可选:超过24小时自动失效)
    const age = Date.now() - (cacheData.timestamp || 0)
    const maxAge = 24 * 60 * 60 * 1000 // 24小时
    if (age > maxAge) {
      console.log(`[缓存恢复] ⚠️ 缓存已过期 (${Math.floor(age / 1000 / 60 / 60)}小时前)`)
      return false
    }
    
    // 恢复到内存
    if (!window.sqlMetadataCache) window.sqlMetadataCache = {}
    if (!window.sqlFieldSuggestions) window.sqlFieldSuggestions = {}
    
    window.sqlMetadataCache.databases = cacheData.databases || []
    window.sqlMetadataCache.dbTables = cacheData.dbTables || {}
    window.sqlFieldSuggestions = cacheData.fields || {}
    
    const dbCount = cacheData.databases?.length || 0
    const tableCount = Object.keys(cacheData.dbTables || {}).length
    const fieldCount = Object.keys(cacheData.fields || {}).length
    
    console.log(`[缓存恢复] ✅ 已从 localStorage 恢复: ${dbCount} 个数据库, ${tableCount} 个表映射, ${fieldCount} 个表字段`)
    console.log(`[缓存恢复] 📅 缓存时间: ${new Date(cacheData.timestamp).toLocaleString()}`)
    
    return true
  } catch (error) {
    console.error('[缓存恢复] ❌ 恢复失败:', error)
    return false
  }
}

/** 清除指定项目的元数据缓存 */
export function clearMetadataStorage(projectName: string): void {
  try {
    const key = `sql-metadata-${projectName}`
    localStorage.removeItem(key)
    console.log(`[缓存清除] ✅ 已清除缓存: ${key}`)
  } catch (error) {
    console.error('[缓存清除] ❌ 清除失败:', error)
  }
}

/** 获取缓存的时间戳 */
export function getMetadataCacheAge(projectName: string): number | null {
  try {
    const key = `sql-metadata-${projectName}`
    const cached = localStorage.getItem(key)
    if (!cached) return null
    
    const cacheData = JSON.parse(cached)
    return cacheData.timestamp || null
  } catch {
    return null
  }
}
