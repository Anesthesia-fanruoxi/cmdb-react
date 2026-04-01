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

/** 缓存表的统计信息 */
export function cacheTableStats(tableName: string, stats: { rowCount: number; dataLength: number; indexLength?: number }): void {
  if (!window.sqlMetadataCache) window.sqlMetadataCache = {}
  if (!window.sqlMetadataCache.tableStats) window.sqlMetadataCache.tableStats = {}
  
  const key = tableName.toLowerCase()
  window.sqlMetadataCache.tableStats[key] = stats
  window.sqlMetadataCache.tableStats[tableName] = stats
}

/** 获取表的统计信息 */
export function getTableStats(tableName: string): { rowCount: number; dataLength: number; indexLength?: number } | null {
  if (!window.sqlMetadataCache?.tableStats) return null
  
  const key = tableName.toLowerCase()
  return window.sqlMetadataCache.tableStats[key] || window.sqlMetadataCache.tableStats[tableName] || null
}

/** 持久化元数据到文件存储 */
export async function persistMetadataToStorage(projectName: string, username: string): Promise<void> {
  if (!window.sqlMetadataCache) return
  
  const cacheData = {
    databases: window.sqlMetadataCache.databases || [],
    dbTables: window.sqlMetadataCache.dbTables || {},
    tableStats: window.sqlMetadataCache.tableStats || {},
    fields: window.sqlFieldSuggestions || {},
  }
  
  try {
    const { saveSqlMetadata } = await import('../../services/storage/stateStorage')
    await saveSqlMetadata(username, projectName, cacheData)
    console.log(`[缓存持久化] ✅ 已保存到 states.dat: 项目=${projectName}, 用户=${username}`)
  } catch (error) {
    console.error('[缓存持久化] ❌ 保存失败:', error)
  }
}

/** 从文件存储恢复元数据 */
export async function restoreMetadataFromStorage(projectName: string, username: string): Promise<boolean> {
  try {
    const { getSqlMetadata } = await import('../../services/storage/stateStorage')
    const cacheData = getSqlMetadata(username, projectName)
    
    if (!cacheData) {
      console.log(`[缓存恢复] ⚠️ 未找到缓存: 项目=${projectName}, 用户=${username}`)
      return false
    }
    
    // 检查缓存版本
    if (cacheData.version !== '1.0') {
      console.log('[缓存恢复] ⚠️ 缓存版本不匹配,忽略')
      return false
    }
    
    // 恢复到内存
    if (!window.sqlMetadataCache) window.sqlMetadataCache = {}
    if (!window.sqlFieldSuggestions) window.sqlFieldSuggestions = {}
    
    window.sqlMetadataCache.databases = cacheData.databases || []
    window.sqlMetadataCache.dbTables = cacheData.dbTables || {}
    window.sqlMetadataCache.tableStats = cacheData.tableStats || {}
    window.sqlFieldSuggestions = cacheData.fields || {}
    
    const dbCount = cacheData.databases?.length || 0
    const tableCount = Object.keys(cacheData.dbTables || {}).length
    const fieldCount = Object.keys(cacheData.fields || {}).length
    const statsCount = Object.keys(cacheData.tableStats || {}).length
    
    const cacheAge = Date.now() - (cacheData.timestamp || 0)
    const ageHours = Math.floor(cacheAge / 1000 / 60 / 60)
    const ageDays = Math.floor(ageHours / 24)
    const ageDisplay = ageDays > 0 ? `${ageDays}天前` : `${ageHours}小时前`
    
    console.log(`[缓存恢复] ✅ 已从 states.dat 恢复: ${dbCount} 个数据库, ${tableCount} 个表映射, ${fieldCount} 个表字段, ${statsCount} 个表统计`)
    console.log(`[缓存恢复] 📅 缓存时间: ${new Date(cacheData.timestamp).toLocaleString()} (${ageDisplay})`)
    
    return true
  } catch (error) {
    console.error('[缓存恢复] ❌ 恢复失败:', error)
    return false
  }
}

/** 清除指定项目的元数据缓存 */
export async function clearMetadataStorage(projectName: string, username: string): Promise<void> {
  try {
    const { clearSqlMetadata } = await import('../../services/storage/stateStorage')
    await clearSqlMetadata(username, projectName)
    console.log(`[缓存清除] ✅ 已清除缓存: 项目=${projectName}, 用户=${username}`)
  } catch (error) {
    console.error('[缓存清除] ❌ 清除失败:', error)
  }
}

/** 获取缓存的时间戳 */
export async function getMetadataCacheAge(projectName: string, username: string): Promise<number | null> {
  try {
    const { getSqlMetadata } = await import('../../services/storage/stateStorage')
    const cacheData = getSqlMetadata(username, projectName)
    return cacheData?.timestamp || null
  } catch {
    return null
  }
}
