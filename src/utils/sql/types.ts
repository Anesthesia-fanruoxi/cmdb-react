/**
 * SQL 自动补全类型定义
 */

// 补全建议项
export interface Suggestion {
  caption: string
  value: string
  meta: string
  comment?: string
  score: number
  tableName?: string
  isPrimaryKey?: boolean
  docHTML?: string
  dbName?: string // 所属数据库
}

// 表信息
export interface TableInfo {
  name: string
  alias?: string | null
  comment?: string
  isCurrentDb?: boolean
  dbName?: string // 所属数据库
  rowCount?: number // 表行数
  dataLength?: number // 数据大小（字节）
  indexLength?: number // 索引大小（字节）
}

// SQL 上下文
export interface SqlContext {
  clause: 
    | 'INITIAL' 
    | 'SELECT' | 'FROM' | 'WHERE' | 'JOIN' | 'ORDER_BY' | 'GROUP_BY' | 'LIMIT'
    | 'DELETE' | 'UPDATE' | 'SET' 
    | 'INSERT' | 'INSERT_INTO' | 'VALUES'
  previousWord: string
  tables: TableInfo[]
  isAfterDot: boolean
  dotIdentifier: string
  tableAliases: Record<string, string>
  isAfterNumber: boolean
}

// 字段信息
export interface FieldInfo {
  caption: string
  value: string
  meta: string
  comment?: string
  score: number
  tableName?: string
  isPrimaryKey?: boolean
  dbName?: string // 所属数据库
}

// 匹配结果
export interface MatchResult {
  match: boolean
  score: number
}

// 缓存类型
export interface SqlCache {
  sqlFieldSuggestions: Record<string, FieldInfo[]>
  sqlMetadataCache: {
    databases?: string[]
    dbTables?: Record<string, string[]>
    tables?: TableInfo[]
    tableStats?: Record<string, { rowCount: number; dataLength: number; indexLength?: number }> // 表统计信息
  }
}

// 扩展 Window 类型
declare global {
  interface Window {
    sqlFieldSuggestions?: Record<string, FieldInfo[]>
    sqlMetadataCache?: {
      databases?: string[]
      dbTables?: Record<string, string[]>
      tables?: TableInfo[]
      tableStats?: Record<string, { rowCount: number; dataLength: number; indexLength?: number }>
    }
  }
}
