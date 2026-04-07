/**
 * SQL 解析器
 * 负责分析光标所在位置的 SQL 上下文（子句类型、表列表、别名等）
 * 表名提取和别名解析已拆分到 tableExtractor.ts
 */

import { extractTablesFromSql, parseTableAliases, getCurrentStatement } from './tableExtractor'
import type { SqlContext } from './types'

// 重新导出，保持对外接口不变
export { extractTablesFromSql, parseTableAliases } from './tableExtractor'

/** 分析 SQL 语句的当前上下文 */
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

  const currentSql = getCurrentStatement(sql)
  const cleanSql = currentSql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim()

  // 提取别名映射
  context.tableAliases = parseTableAliases(sql)

  // 是否在数字后面
  if (/\d+\s*$/.test(cleanSql)) context.isAfterNumber = true

  // 是否在点号后面
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
      context.tables = extractTablesFromSql(sql)
    } else if (fromPos !== -1 && cursorPos > fromPos) {
      context.clause = 'FROM'
      context.tables = extractTablesFromSql(sql)
    } else {
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
      context.clause = 'SELECT'
    } else if (valuesPos !== -1 && cursorPos > valuesPos) {
      context.clause = 'VALUES'
    } else if (intoPos !== -1 && cursorPos > intoPos) {
      context.clause = 'INSERT_INTO'
    } else {
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
      context.tables = extractTablesFromSql(sql)
    } else if (orderByPos !== -1 && cursorPos > orderByPos) {
      context.clause = 'ORDER_BY'
      context.tables = extractTablesFromSql(sql)
    } else if (groupByPos !== -1 && cursorPos > groupByPos) {
      context.clause = 'GROUP_BY'
      context.tables = extractTablesFromSql(sql)
    } else if (wherePos !== -1 && cursorPos > wherePos) {
      context.clause = 'WHERE'
      context.tables = extractTablesFromSql(sql)
    } else if (fromPos !== -1 && cursorPos > fromPos) {
      const afterFrom = cleanSql.substring(fromPos + 4).trim()
      if (!afterFrom || /^\w*$/.test(afterFrom) || /\s+\w*$/.test(afterFrom)) {
        context.clause = 'FROM'
      } else {
        context.clause = cursorPos <= fromPos ? 'SELECT' : 'FROM'
      }
      context.tables = extractTablesFromSql(sql)
    } else {
      context.clause = 'SELECT'
      context.tables = extractTablesFromSql(sql)
    }
  }

  // JOIN 子句
  const joinMatch = cleanSql.match(/\b(?:LEFT|RIGHT|INNER|OUTER|CROSS|FULL)?\s*JOIN\s+(\w*)$/i)
  if (joinMatch) {
    context.clause = 'JOIN'
  }

  return context
}
