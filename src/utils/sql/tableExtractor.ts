/**
 * SQL 表名提取器
 * 单一职责：从 SQL 文本中准确提取当前语句涉及的表名
 *
 * 对外核心 API：
 *   extractTablesFromSql(sql)         — 提取当前语句（最后一条）的表名
 *   extractAllTablesFromSql(sql)      — 无脑扫全文，提取所有已确认的表名（表名后有空格视为确认）
 *   updateTabTables(tabId, sql)       — 更新指定标签页的表名注册表并打印日志
 *   getTabTables(tabId)               — 获取指定标签页已提取的表名列表
 *   parseTableAliases(sql)            — 解析当前语句的别名映射
 */

import { SQL_KEYWORDS_LIST } from './keywords'
import type { TableInfo } from './types'

// ─── 标签页表名注册表 ────────────────────────────────────────────────────────
// key: tabId, value: 该标签页中所有已确认的表名集合
const tabTableRegistry = new Map<string, Set<string>>()

/**
 * 更新指定标签页的表名注册表
 * 每次编辑器内容变化时调用，无脑扫全文提取所有已确认表名并打印日志
 */
export function updateTabTables(tabId: string, fullSql: string): void {
  const tables = extractAllTablesFromSql(fullSql)
  const names = new Set(tables.map(t => t.name))

  // 只有表名集合有变化时才更新并打印日志
  const prev = tabTableRegistry.get(tabId)
  const changed = !prev
    || prev.size !== names.size
    || [...names].some(n => !prev.has(n))

  if (!changed) return

  tabTableRegistry.set(tabId, names)
}

/**
 * 获取指定标签页已提取的表名列表
 */
export function getTabTables(tabId: string): string[] {
  return Array.from(tabTableRegistry.get(tabId) ?? [])
}

/**
 * 清除指定标签页的表名注册表（标签页关闭时调用）
 */
export function clearTabTables(tabId: string): void {
  tabTableRegistry.delete(tabId)
}

// ─── 工具函数 ────────────────────────────────────────────────────────────────

/**
 * 获取光标所在的当前 SQL 语句
 * 以分号为分隔符，取最后一条（正在编辑的那条）
 */
export function getCurrentStatement(fullSql: string): string {
  const lastSemicolon = fullSql.lastIndexOf(';')
  if (lastSemicolon === -1) return fullSql
  return fullSql.substring(lastSemicolon + 1)
}

/**
 * 判断一个词是否是 SQL 关键字
 */
function isSqlKeyword(word: string): boolean {
  return SQL_KEYWORDS_LIST.includes(word.toUpperCase())
}

/**
 * 解析 FROM 子句字符串，提取表名和别名列表
 * 支持：
 *   - 单表：FROM users
 *   - 多表：FROM users, orders
 *   - 隐式别名：FROM users u
 *   - AS 别名：FROM users AS u
 *   - JOIN：FROM users u LEFT JOIN orders o ON u.id = o.user_id
 *   - 跨库：FROM db.table_name
 */
function parseFromClause(fromClause: string): TableInfo[] {
  const tables: TableInfo[] = []

  // 先处理 JOIN 部分
  const hasJoin = /\bJOIN\b/i.test(fromClause)

  if (hasJoin) {
    // 提取 JOIN 前的主表部分
    const mainPart = fromClause.replace(/\b(?:LEFT|RIGHT|INNER|OUTER|CROSS|FULL)?\s*JOIN\b.*/is, '').trim()
    if (mainPart) {
      tables.push(...parseSingleTableEntry(mainPart))
    }

    // 提取所有 JOIN 表
    const joinPattern = /\b(?:LEFT|RIGHT|INNER|OUTER|CROSS|FULL)?\s*JOIN\s+([a-zA-Z0-9_\.]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?(?:\s+ON\b|\s*$)/gi
    let m: RegExpExecArray | null
    while ((m = joinPattern.exec(fromClause)) !== null) {
      const tableName = m[1]
      const alias = m[2] && !isSqlKeyword(m[2]) ? m[2] : null
      if (tableName) tables.push({ name: tableName, alias })
    }
  } else {
    // 逗号分隔的多表
    fromClause.split(',').forEach(entry => {
      tables.push(...parseSingleTableEntry(entry.trim()))
    })
  }

  return tables
}

/**
 * 解析单个表条目（可能含别名）
 * 例：`users`、`users u`、`users AS u`、`db.users AS u`
 */
function parseSingleTableEntry(entry: string): TableInfo[] {
  if (!entry) return []

  // AS 别名
  const asMatch = entry.match(/^([a-zA-Z0-9_\.]+)\s+AS\s+([a-zA-Z0-9_]+)$/i)
  if (asMatch) {
    return [{ name: asMatch[1], alias: asMatch[2] }]
  }

  const parts = entry.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return []

  const tableName = parts[0]
  if (!tableName) return []

  // 两个词且第二个不是关键字 → 隐式别名
  if (parts.length === 2 && !isSqlKeyword(parts[1])) {
    return [{ name: tableName, alias: parts[1] }]
  }

  return [{ name: tableName, alias: null }]
}

/**
 * 从完整 SQL 文本中提取当前语句的表名列表
 *
 * 核心逻辑：
 * 1. 取当前语句（最后一个分号之后）
 * 2. 去掉注释
 * 3. 找到 FROM 子句
 * 4. 截取到下一个主子句关键字（WHERE / GROUP BY / ORDER BY 等）
 * 5. 解析表名和别名
 *
 * @param fullSql 编辑器中的完整 SQL 文本
 * @returns 当前语句中涉及的表信息列表
 */
export function extractTablesFromSql(fullSql: string): TableInfo[] {
  try {
    const currentSql = getCurrentStatement(fullSql)

    // 去掉单行注释和多行注释
    const cleanSql = currentSql
      .replace(/--[^\n]*/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .trim()

    if (!cleanSql) return []

    // 匹配 FROM 子句到下一个主子句关键字
    const fromMatch = cleanSql.match(
      /\bFROM\b\s+([\s\S]*?)(?:\bWHERE\b|\bGROUP\s+BY\b|\bHAVING\b|\bORDER\s+BY\b|\bLIMIT\b|\bUNION\b|$)/i
    )
    if (!fromMatch) return []

    const rawFromClause = fromMatch[1]

    // 判断末尾是否有空格
    // - 有空格 或 后面跟了关键字：表名已确认，保留完整
    // - 无空格 且 到语句末尾：
    //     单个词 → 表名完整，保留
    //     多个词 → 最后一个词还在输入中，去掉
    const endsWithSpace = /\s$/.test(rawFromClause)
    let fromClause = rawFromClause.trim()

    if (!endsWithSpace) {
      const words = fromClause.split(/\s+/).filter(Boolean)
      if (words.length > 1) {
        fromClause = words.slice(0, -1).join(' ')
      }
    }

    if (!fromClause) return []

    return parseFromClause(fromClause)
  } catch (e) {
    console.error('[tableExtractor] 提取表名出错:', e)
    return []
  }
}

/**
 * 无脑扫全文，提取所有已确认的表名
 * 规则：FROM 后面第一个词，且该词后面跟着空格，才算确认
 * 即匹配 `FROM <空格> 表名 <空格>` 这种模式
 */
export function extractAllTablesFromSql(fullSql: string): TableInfo[] {
  if (!fullSql.trim()) return []

  const seen = new Set<string>()
  const result: TableInfo[] = []

  // 匹配 FROM 后跟空格、表名、再跟空格（表名已输入完毕的标志）
  const regex = /\bFROM\s+(\w+)\s/gi
  let m: RegExpExecArray | null

  while ((m = regex.exec(fullSql)) !== null) {
    const tableName = m[1]
    const key = tableName.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      result.push({ name: tableName, alias: null })
    }
  }

  return result
}

/**
 * 从完整 SQL 文本中解析表别名映射
 * 返回 { alias -> tableName } 的映射关系
 *
 * @param fullSql 编辑器中的完整 SQL 文本
 * @returns 别名到表名的映射
 */
export function parseTableAliases(fullSql: string): Record<string, string> {
  const aliases: Record<string, string> = {}
  const tables = extractTablesFromSql(fullSql)

  tables.forEach(t => {
    if (t.alias) {
      aliases[t.alias.toLowerCase()] = t.name
    }
  })

  return aliases
}

/**
 * 根据光标行号，找出距离最近的表名（primary）以及同语句其他表（secondary）
 *
 * 算法：
 * 1. 扫全文所有 `FROM xxx ` 匹配，记录每个表名所在行号
 * 2. 找出与 cursorRow 行距最小的那条 → primary
 * 3. 同一个分号分隔语句内的其他表 → secondary
 * 4. 其余语句的表 → rest
 *
 * @param fullSql    编辑器完整文本
 * @param cursorRow  光标所在行（0-indexed）
 */
export function getTablesNearCursor(
  fullSql: string,
  cursorRow: number
): { primary: string | null; secondary: string[]; rest: string[] } {
  if (!fullSql.trim()) return { primary: null, secondary: [], rest: [] }

  // 找出光标所在的语句范围（按分号分割）
  const cursorCharPos = fullSql.split('\n').slice(0, cursorRow).join('\n').length + (cursorRow > 0 ? 1 : 0)

  const stmtBoundaries: number[] = []
  for (let i = 0; i < fullSql.length; i++) {
    if (fullSql[i] === ';') stmtBoundaries.push(i)
  }

  const prevSemicolon = stmtBoundaries.filter(p => p < cursorCharPos).pop() ?? -1
  const nextSemicolon = stmtBoundaries.find(p => p >= cursorCharPos) ?? fullSql.length

  // 扫全文所有 FROM xxx（表名后有空格才算确认）
  interface TableMatch { name: string; row: number; inCurrentStmt: boolean }
  const allMatches: TableMatch[] = []
  const seen = new Set<string>()

  const regex = /\bFROM\s+(\w+)\s/gi
  let m: RegExpExecArray | null

  while ((m = regex.exec(fullSql)) !== null) {
    const tableName = m[1]
    const key = tableName.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    // 计算该匹配在第几行
    const matchPos = m.index
    const row = fullSql.substring(0, matchPos).split('\n').length - 1
    const inCurrentStmt = matchPos > prevSemicolon && matchPos <= nextSemicolon

    allMatches.push({ name: tableName, row, inCurrentStmt })
  }

  if (allMatches.length === 0) return { primary: null, secondary: [], rest: [] }

  // 当前语句内的表
  const currentStmtTables = allMatches.filter(t => t.inCurrentStmt)
  const otherTables = allMatches.filter(t => !t.inCurrentStmt)

  // 找距离光标最近的表（优先从当前语句找，没有则从全文找）
  const candidates = currentStmtTables.length > 0 ? currentStmtTables : allMatches
  let primary = candidates.reduce((closest, t) => {
    return Math.abs(t.row - cursorRow) < Math.abs(closest.row - cursorRow) ? t : closest
  })

  const secondary = currentStmtTables
    .filter(t => t.name !== primary.name)
    .map(t => t.name)

  const rest = otherTables
    .filter(t => t.name !== primary.name)
    .map(t => t.name)

  return { primary: primary.name, secondary, rest }
}
