/**
 * SQL 解析器
 * 提供 SQL 语句解析功能：别名解析、表名提取、上下文分析
 */

import { SQL_KEYWORDS_LIST } from './keywords'
import type { SqlContext, TableInfo } from './types'

/**
 * 获取当前正在编辑的 SQL 语句
 * 根据分号分隔，返回光标所在的那条 SQL
 */
function getCurrentStatement(sql: string): string {
  // 找到最后一个分号的位置
  const lastSemicolon = sql.lastIndexOf(';')
  if (lastSemicolon === -1) {
    // 没有分号，整个文本就是当前语句
    return sql
  }
  // 返回分号后面的部分（当前正在编辑的语句）
  return sql.substring(lastSemicolon + 1)
}

/** 解析SQL语句中的表别名 */
export function parseTableAliases(sql: string): Record<string, string> {
  const aliases: Record<string, string> = {}
  // 只分析当前语句
  const currentSql = getCurrentStatement(sql)
  
  try {
    const fromMatch = currentSql.match(/\bFROM\b\s+(.*?)(?:\bWHERE\b|\bGROUP BY\b|\bHAVING\b|\bORDER BY\b|\bLIMIT\b|$)/is)
    if (!fromMatch) return aliases
    
    const fromClause = fromMatch[1].trim()
    
    // 处理显式别名 (使用AS关键字)
    const explicitAsPattern = /\b([a-zA-Z0-9_\.]+)\s+AS\s+([a-zA-Z0-9_]+)(?:\s*,|\s+|$)/gi
    let aliasMatch
    
    while ((aliasMatch = explicitAsPattern.exec(fromClause)) !== null) {
      const tableName = aliasMatch[1]
      const alias = aliasMatch[2]
      if (!SQL_KEYWORDS_LIST.includes(alias.toUpperCase())) {
        aliases[alias.toLowerCase()] = tableName
      }
    }
    
    // 处理隐式别名 (不使用AS关键字)
    const tableEntries = fromClause.split(',')
    for (let entry of tableEntries) {
      entry = entry.trim()
      if (entry.toUpperCase().includes(' AS ')) continue
      if (entry.toUpperCase().includes(' JOIN ')) continue
      
      const parts = entry.trim().split(/\s+/)
      if (parts.length === 2) {
        const tableName = parts[0]
        const alias = parts[1]
        if (!SQL_KEYWORDS_LIST.includes(alias.toUpperCase())) {
          aliases[alias.toLowerCase()] = tableName
        }
      }
    }
    
    // 处理JOIN语句中的别名
    const joinPattern = /\b(?:LEFT|RIGHT|INNER|OUTER|CROSS|FULL)?\s*JOIN\s+([a-zA-Z0-9_\.]+)(?:\s+AS)?\s+([a-zA-Z0-9_]+)(?:\s+ON|\s*$)/gi
    while ((aliasMatch = joinPattern.exec(fromClause)) !== null) {
      const tableName = aliasMatch[1]
      const alias = aliasMatch[2]
      if (!SQL_KEYWORDS_LIST.includes(alias.toUpperCase())) {
        aliases[alias.toLowerCase()] = tableName
      }
    }
    
    return aliases
  } catch (error) {
    console.error('解析表别名出错:', error)
    return aliases
  }
}

/** 从SQL中提取表名 */
export function extractTablesFromSql(sql: string): TableInfo[] {
  const tables: TableInfo[] = []
  // 只分析当前语句
  const currentSql = getCurrentStatement(sql)
  
  try {
    const fromMatch = currentSql.match(/\bFROM\b\s+([^;]*?)(?:\bWHERE\b|\bGROUP\s+BY\b|\bHAVING\b|\bORDER\s+BY\b|\bLIMIT\b|$)/i)
    if (!fromMatch) return tables
    
    let fromClause = fromMatch[1].trim()
    
    // 处理简单的表列表
    if (!fromClause.toUpperCase().includes('JOIN')) {
      const tableList = fromClause.split(',')
      tableList.forEach(tableEntry => {
        const entry = tableEntry.trim()
        
        // 处理"表名 AS 别名"格式
        const asMatch = entry.match(/^([a-zA-Z0-9_\.]+)\s+AS\s+([a-zA-Z0-9_]+)$/i)
        if (asMatch) {
          tables.push({ name: asMatch[1], alias: asMatch[2] })
          return
        }
        
        // 处理"表名 别名"格式
        const parts = entry.split(/\s+/)
        if (parts.length === 2) {
          tables.push({ name: parts[0], alias: parts[1] })
          return
        }
        
        // 单独的表名
        if (parts.length === 1 && parts[0]) {
          tables.push({ name: parts[0], alias: null })
        }
      })
    } else {
      // 处理JOIN
      let joinIndex = fromClause.toUpperCase().indexOf('JOIN')
      let mainTablePart = fromClause
      if (joinIndex > 0) {
        mainTablePart = fromClause.substring(0, joinIndex).trim()
      }
      
      // 处理主表
      const mainAsMatch = mainTablePart.match(/^([a-zA-Z0-9_\.]+)\s+AS\s+([a-zA-Z0-9_]+)$/i)
      if (mainAsMatch) {
        tables.push({ name: mainAsMatch[1], alias: mainAsMatch[2] })
      } else {
        const mainParts = mainTablePart.split(/\s+/)
        if (mainParts.length >= 1) {
          tables.push({
            name: mainParts[0],
            alias: mainParts.length > 1 ? mainParts[1] : null
          })
        }
      }
      
      // 处理所有JOIN的表
      const joinPattern = /\b(?:LEFT|RIGHT|INNER|OUTER|CROSS|FULL)?\s*JOIN\s+([a-zA-Z0-9_\.]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?/gi
      let joinMatch
      while ((joinMatch = joinPattern.exec(fromClause)) !== null) {
        const joinTable = joinMatch[1]
        const joinAlias = joinMatch[2] || null
        
        if (joinAlias && SQL_KEYWORDS_LIST.includes(joinAlias.toUpperCase())) {
          tables.push({ name: joinTable, alias: null })
        } else {
          tables.push({ name: joinTable, alias: joinAlias })
        }
      }
    }
    
    return tables
  } catch (error) {
    console.error('提取表名出错:', error)
    return tables
  }
}

/** 分析SQL语句的当前上下文 */
export function analyzeContext(sql: string): SqlContext {
  const context: SqlContext = {
    clause: 'INITIAL',
    previousWord: '',
    tables: [],
    isAfterDot: false,
    dotIdentifier: '',
    tableAliases: {},
    isAfterNumber: false
  }
  
  // 只分析当前语句（分号后的部分）
  const currentSql = getCurrentStatement(sql)
  const cleanSql = currentSql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim()
  
  // 提取表别名映射
  context.tableAliases = parseTableAliases(currentSql)
  
  // 检查是否在数字后面
  if (/\d+\s*$/.test(cleanSql)) context.isAfterNumber = true
  
  // 检查是否在点号后面
  const dotMatch = currentSql.match(/(\w+)\.(\w*)$/)
  if (dotMatch) {
    context.isAfterDot = true
    context.dotIdentifier = dotMatch[1]
  } else {
    const wordMatch = currentSql.match(/[a-zA-Z0-9_]+$/)
    if (wordMatch) context.previousWord = wordMatch[0].toUpperCase()
  }
  
  const upperSql = cleanSql.toUpperCase()
  const cursorPos = cleanSql.length
  
  // DELETE 语句
  const deletePos = upperSql.search(/\bDELETE\b/)
  if (deletePos !== -1) {
    const fromPos = upperSql.search(/\bFROM\b/)
    const wherePos = upperSql.search(/\bWHERE\b/)
    
    if (wherePos !== -1 && cursorPos > wherePos) {
      context.clause = 'WHERE'
      context.tables = extractTablesFromSql(currentSql)
    } else if (fromPos !== -1 && cursorPos > fromPos) {
      context.clause = 'FROM'
      context.tables = extractTablesFromSql(currentSql)
    } else {
      // DELETE 后面应该提示 FROM
      context.clause = 'DELETE'
    }
    return context
  }
  
  // UPDATE 语句
  const updatePos = upperSql.search(/\bUPDATE\b/)
  if (updatePos !== -1) {
    const setPos = upperSql.search(/\bSET\b/)
    const wherePos = upperSql.search(/\bWHERE\b/)
    
    if (wherePos !== -1 && cursorPos > wherePos) {
      context.clause = 'WHERE'
    } else if (setPos !== -1 && cursorPos > setPos) {
      context.clause = 'SET'
    } else {
      // UPDATE 后面应该提示表名
      context.clause = 'UPDATE'
    }
    return context
  }
  
  // INSERT 语句
  const insertPos = upperSql.search(/\bINSERT\b/)
  if (insertPos !== -1) {
    const intoPos = upperSql.search(/\bINTO\b/)
    const valuesPos = upperSql.search(/\bVALUES\b/)
    const selectPos = upperSql.search(/\bSELECT\b/)
    
    if (selectPos !== -1 && cursorPos > selectPos) {
      // INSERT ... SELECT 语句
      context.clause = 'SELECT'
    } else if (valuesPos !== -1 && cursorPos > valuesPos) {
      context.clause = 'VALUES'
    } else if (intoPos !== -1 && cursorPos > intoPos) {
      // INTO 后面应该提示表名
      context.clause = 'INSERT_INTO'
    } else {
      // INSERT 后面应该提示 INTO
      context.clause = 'INSERT'
    }
    return context
  }
  
  // SELECT 语句
  const selectPos = upperSql.search(/\bSELECT\b/)
  if (selectPos !== -1) {
    const fromPos = upperSql.search(/\bFROM\b/)
    const wherePos = upperSql.search(/\bWHERE\b/)
    const limitPos = upperSql.search(/\bLIMIT\b/)
    const orderByPos = upperSql.search(/\bORDER\s+BY\b/)
    const groupByPos = upperSql.search(/\bGROUP\s+BY\b/)
    
    if (limitPos !== -1 && cursorPos > limitPos) {
      context.clause = 'LIMIT'
      context.tables = extractTablesFromSql(currentSql)
    } else if (orderByPos !== -1 && cursorPos > orderByPos) {
      context.clause = 'ORDER_BY'
      context.tables = extractTablesFromSql(currentSql)
    } else if (groupByPos !== -1 && cursorPos > groupByPos) {
      context.clause = 'GROUP_BY'
      context.tables = extractTablesFromSql(currentSql)
    } else if (wherePos !== -1 && cursorPos > wherePos) {
      context.clause = 'WHERE'
      context.tables = extractTablesFromSql(currentSql)
    } else if (fromPos !== -1 && cursorPos > fromPos) {
      const afterFrom = cleanSql.substring(fromPos + 4).trim()
      if (!afterFrom || /^\w*$/.test(afterFrom) || /\s+\w*$/.test(afterFrom)) {
        context.clause = 'FROM'
      } else {
        context.clause = cursorPos <= fromPos ? 'SELECT' : 'FROM'
      }
      context.tables = extractTablesFromSql(currentSql)
    } else {
      context.clause = 'SELECT'
      context.tables = extractTablesFromSql(currentSql)
    }
  }
  
  // JOIN 子句 - 只有在 JOIN 关键字后面且还没有 ON 条件时才识别为 JOIN
  const joinMatch = cleanSql.match(/\b(?:LEFT|RIGHT|INNER|OUTER|CROSS|FULL)?\s*JOIN\s+(\w*)$/i)
  if (joinMatch) {
    context.clause = 'JOIN'
  }
  
  return context
}
