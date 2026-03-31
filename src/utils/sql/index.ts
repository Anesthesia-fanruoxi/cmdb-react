/**
 * SQL 自动补全服务 - 主入口
 */

import { SQL_KEYWORDS, KEYWORD_PRIORITY } from './keywords'
import { analyzeContext } from './parser'
import { fuzzyMatch, deduplicateSuggestions } from './matcher'
import { initCache, getTableFields } from './cache'
import { getDocTooltip, createCustomRenderer, getIconForType, getColorForType, getTypeLabel } from './renderer'
import { getDotCompletions } from './completers'
import type { Suggestion, TableInfo, FieldInfo } from './types'

interface CompleterOptions {
  getTables: () => TableInfo[]
  loadTableStructure?: (tableName: string) => Promise<FieldInfo[] | null>
}

/** 创建 SQL 自动补全器 */
export function createSqlCompleter(ace: any, { getTables, loadTableStructure }: CompleterOptions) {
  const langTools = ace.require('ace/ext/language_tools')
  langTools.setCompleters([])
  initCache()
  
  const completer: any = {
    identifierRegexps: [/[a-zA-Z_0-9\$]/],
    
    getCompletions: async (
      _editor: any, 
      session: any, 
      pos: { row: number; column: number }, 
      prefix: string, 
      callback: (err: any, results: Suggestion[]) => void
    ) => {
      try {
        // 移除锁机制，允许快速输入时的多次补全请求
        const currentLine = session.getLine(pos.row)
        const lineUntilCursor = currentLine.substring(0, pos.column)
        const isDotContext = /\.\w*$/.test(lineUntilCursor)
        
        // 处理点号后的字段提示（table.field）
        if (isDotContext) {
          const dotMatch = lineUntilCursor.match(/(\w+)\.\w*$/)
          if (dotMatch) {
            const identifier = dotMatch[1]
            const afterDotPrefixMatch = lineUntilCursor.match(/\.(\w*)$/)
            const afterDotPrefix = afterDotPrefixMatch ? afterDotPrefixMatch[1] : ''
            const fullSql = session.getValue()
            const context = analyzeContext(fullSql)
            const fields = getDotCompletions(identifier, afterDotPrefix, context.tableAliases)
            
            if (fields.length > 0) {
              return callback(null, fields)
            }
          }
        }
        
        const tables = typeof getTables === 'function' ? getTables() : []
        const fullSql = session.getValue()
        const context = analyzeContext(fullSql)
        
        // 简化逻辑：没有输入就不提示
        if (!prefix || prefix.trim() === '') {
          return callback(null, [])
        }
        
        // Navicat风格：收集所有可能的建议，通过匹配分数排序
        const allSuggestions: Suggestion[] = []
        
        // 判断是否在 WHERE 子句中
        const isInWhereClause = context.clause === 'WHERE'
        
        // 获取当前 SQL 中涉及的表名集合（用于优先提示）
        const currentSqlTableNames = new Set(context.tables.map(t => t.name.toLowerCase()))
        
        // 1. SQL关键字（所有类型）
        const allKeywords = [
          ...SQL_KEYWORDS.INITIAL,
          ...SQL_KEYWORDS.SELECT,
          ...SQL_KEYWORDS.FROM,
          ...SQL_KEYWORDS.WHERE,
          ...SQL_KEYWORDS.JOIN,
          ...SQL_KEYWORDS.ORDER_BY,
          ...SQL_KEYWORDS.GROUP_BY,
          ...SQL_KEYWORDS.OPERATORS
        ]
        
        // 去重关键字
        const uniqueKeywords = Array.from(new Set(allKeywords))
        uniqueKeywords.forEach(keyword => {
          const matchResult = fuzzyMatch(prefix, keyword)
          if (matchResult.match) {
            // 使用关键字优先级权重
            const priorityBonus = KEYWORD_PRIORITY[keyword] || 50
            // WHERE 子句中降低关键字优先级
            const baseScore = isInWhereClause ? 7000 : 10000
            allSuggestions.push({ 
              caption: keyword, 
              value: keyword, 
              meta: 'keyword', 
              score: baseScore + (priorityBonus * 10) + matchResult.score
            })
          }
        })
        
        // 2. SQL函数
        SQL_KEYWORDS.FUNCTIONS.forEach(func => {
          const matchResult = fuzzyMatch(prefix, func)
          if (matchResult.match) {
            // WHERE 子句中函数优先级略微降低
            const baseScore = isInWhereClause ? 8000 : 9000
            allSuggestions.push({ 
              caption: func, 
              value: func + '()', 
              meta: 'function', 
              score: baseScore + matchResult.score
            })
          }
        })
        
        // 3. 数据库名
        const { getAllCachedDatabases } = await import('./cache')
        const databases = getAllCachedDatabases()
        databases.forEach(dbName => {
          const matchResult = fuzzyMatch(prefix, dbName)
          if (matchResult.match) {
            allSuggestions.push({
              caption: dbName,
              value: dbName,
              meta: 'database',
              score: 8500 + matchResult.score
            })
          }
        })
        
        // 4. 表名
        tables.forEach(table => {
          const matchResult = fuzzyMatch(prefix, table.name)
          if (matchResult.match) {
            // WHERE 子句中表名优先级降低（因为通常不直接使用表名）
            const baseScore = isInWhereClause ? 6000 : 8000
            allSuggestions.push({ 
              caption: table.name, 
              value: table.name, 
              meta: 'table', 
              score: baseScore + matchResult.score,
              dbName: table.dbName // 附带库名
            })
          }
        })
        
        // 5. 所有已加载的字段（来自所有表）
        // 注意：字段信息已在项目切换时通过元数据缓存，不再需要异步加载
        tables.forEach(table => {
          const fields = getTableFields(table.name)
          if (fields && fields.length > 0) {
            fields.forEach(field => {
              const matchResult = fuzzyMatch(prefix, field.caption)
              if (matchResult.match) {
                // 判断字段是否来自当前 SQL 涉及的表
                const isFromCurrentSqlTable = currentSqlTableNames.has(table.name.toLowerCase())
                
                // WHERE 子句中，当前 SQL 涉及的表的字段获得最高优先级
                let baseScore = 7000
                if (isInWhereClause && isFromCurrentSqlTable) {
                  baseScore = 9500 // WHERE 中当前表的字段优先级最高
                } else if (isInWhereClause) {
                  baseScore = 6500 // WHERE 中其他表的字段优先级较低
                }
                
                // 添加表名前缀到注释，方便识别
                const fieldWithTable = {
                  ...field,
                  comment: `${table.name}.${field.caption}`,
                  score: baseScore + matchResult.score
                }
                
                allSuggestions.push(fieldWithTable)
              }
            })
          }
          // 移除了异步加载逻辑，因为元数据已在项目切换时全部缓存
        })
        
        // 6. 如果有上下文中的表别名，提供别名建议
        if (context.tableAliases && Object.keys(context.tableAliases).length > 0) {
          Object.keys(context.tableAliases).forEach(alias => {
            const matchResult = fuzzyMatch(prefix, alias)
            if (matchResult.match) {
              // WHERE 子句中别名优先级提高（用于 alias.field 的场景）
              const baseScore = isInWhereClause ? 9800 : 8500
              allSuggestions.push({
                caption: alias,
                value: alias,
                meta: 'alias',
                score: baseScore + matchResult.score
              })
            }
          })
        }
        
        const finalSuggestions = deduplicateSuggestions(allSuggestions).map((item: any) => {
          // 为每个项添加图标和颜色
          const icon = getIconForType(item.meta || '')
          const color = getColorForType(item.meta || '')
          const typeLabel = getTypeLabel(item.meta || '')
          
          return {
            ...item,
            // 保留原始文本用于插入
            value: item.value,
            // 用于显示的文本: 名称 + 类型标签
            caption: item.caption,
            // 图标和颜色
            iconText: icon,
            iconColor: color,
            // 类型标签(中文)
            typeLabel: typeLabel
          }
        })
        
        return callback(null, finalSuggestions)
      } catch (error) {
        console.error('SQL自动补全出错:', error)
        return callback(null, [])
      }
    },
    
    getDocTooltip
  }
  
  // 设置自定义渲染器 - Ace 使用 $textCompleter 的方式
  const customRenderer = createCustomRenderer()
  completer.renderer = customRenderer
  completer.$textCompleter = customRenderer
  
  langTools.addCompleter(completer)
  
  return completer
}

// 导出工具函数
export { fuzzyMatch } from './matcher'
export { getTableFields, cacheTableFields, initCache } from './cache'
export { analyzeContext, extractTablesFromSql, parseTableAliases } from './parser'
export type { Suggestion, TableInfo, FieldInfo, SqlContext } from './types'
