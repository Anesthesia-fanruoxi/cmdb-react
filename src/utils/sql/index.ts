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
        console.log('🔄 开始补全:', prefix)
        
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
            allSuggestions.push({ 
              caption: keyword, 
              value: keyword, 
              meta: 'keyword', 
              score: 10000 + (priorityBonus * 10) + matchResult.score
            })
          }
        })
        
        // 2. SQL函数
        SQL_KEYWORDS.FUNCTIONS.forEach(func => {
          const matchResult = fuzzyMatch(prefix, func)
          if (matchResult.match) {
            allSuggestions.push({ 
              caption: func, 
              value: func + '()', 
              meta: 'function', 
              score: 9000 + matchResult.score
            })
          }
        })
        
        // 3. 表名
        tables.forEach(table => {
          const matchResult = fuzzyMatch(prefix, table.name)
          if (matchResult.match) {
            allSuggestions.push({ 
              caption: table.name, 
              value: table.name, 
              meta: 'table', 
              score: 8000 + matchResult.score,
              dbName: table.dbName // 附带库名
            })
          }
        })
        
        // 4. 所有已加载的字段（来自所有表）
        tables.forEach(table => {
          const fields = getTableFields(table.name)
          if (fields) {
            fields.forEach(field => {
              const matchResult = fuzzyMatch(prefix, field.caption)
              if (matchResult.match) {
                // 添加表名前缀到注释，方便识别
                const fieldWithTable = {
                  ...field,
                  comment: `${table.name}.${field.caption}`,
                  score: 7000 + matchResult.score
                }
                // 调试日志: 检查字段的 dbName
                if (!field.dbName) {
                  console.warn(`Field ${field.caption} missing dbName in cache`)
                }
                
                allSuggestions.push(fieldWithTable)
              }
            })
          } else if (loadTableStructure) {
            // 异步加载未缓存的表字段（不阻塞当前补全）
            loadTableStructure(table.name).catch(() => {})
          }
        })
        
        // 5. 如果有上下文中的表别名，提供别名建议
        if (context.tableAliases && Object.keys(context.tableAliases).length > 0) {
          Object.keys(context.tableAliases).forEach(alias => {
            const matchResult = fuzzyMatch(prefix, alias)
            if (matchResult.match) {
              allSuggestions.push({
                caption: alias,
                value: alias,
                meta: 'alias',
                score: 8500 + matchResult.score
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
        
        console.log('🔍 补全结果:', {
          prefix,
          总数: finalSuggestions.length,
          前5项原始: finalSuggestions.slice(0, 5) // 直接打印原始对象
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
  
  console.log('🎯 渲染器已注入:', { 
    renderer: typeof completer.renderer,
    $textCompleter: typeof completer.$textCompleter
  })
  
  langTools.addCompleter(completer)
  
  return completer
}

// 导出工具函数
export { fuzzyMatch } from './matcher'
export { getTableFields, cacheTableFields, initCache } from './cache'
export { analyzeContext, extractTablesFromSql, parseTableAliases } from './parser'
export type { Suggestion, TableInfo, FieldInfo, SqlContext } from './types'
