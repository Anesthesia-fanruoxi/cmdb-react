/**
 * SQL 自动补全服务 - 主入口
 */

import { SQL_KEYWORDS } from './keywords'
import { analyzeContext, extractTablesFromSql } from './parser'
import { fuzzyMatch, deduplicateSuggestions } from './matcher'
import { initCache, getTableFields } from './cache'
import { createCustomRenderer, getDocTooltip } from './renderer'
import {
  getSelectCompletions,
  getFromCompletions,
  getWhereCompletions,
  getJoinCompletions,
  getDotCompletions
} from './completers'
import type { Suggestion, TableInfo, FieldInfo } from './types'

let isProcessingCompletion = false

interface CompleterOptions {
  getTables: () => TableInfo[]
  loadTableStructure?: (tableName: string) => Promise<FieldInfo[] | null>
}

/** 创建 SQL 自动补全器 */
export function createSqlCompleter(ace: any, { getTables, loadTableStructure }: CompleterOptions) {
  const langTools = ace.require('ace/ext/language_tools')
  langTools.setCompleters([])
  initCache()
  
  const customRenderer = createCustomRenderer()
  
  const completer = {
    identifierRegexps: [/[a-zA-Z_0-9\$]/],

    getCompletions: async (
      _editor: any, 
      session: any, 
      pos: { row: number; column: number }, 
      prefix: string, 
      callback: (err: any, results: Suggestion[]) => void
    ) => {
      try {
        if (isProcessingCompletion) return callback(null, [])
        isProcessingCompletion = true
        
        const currentLine = session.getLine(pos.row)
        const lineUntilCursor = currentLine.substring(0, pos.column)
        const isDotContext = /\.\w*$/.test(lineUntilCursor)
        
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
              isProcessingCompletion = false
              return callback(null, fields)
            }
          }
        }
        
        const previousLines = session.getLines(0, pos.row - 1).join('\n')
        const contextUntilCursor = previousLines + '\n' + lineUntilCursor
        const fullSql = session.getValue()
        const tables = typeof getTables === 'function' ? getTables() : []
        const context = analyzeContext(contextUntilCursor)
        
        if (context.clause === 'SELECT' && (!context.tables || context.tables.length === 0)) {
          const tablesFromFullSql = extractTablesFromSql(fullSql)
          if (tablesFromFullSql.length > 0) context.tables = tablesFromFullSql
        }
        
        // 动态加载表字段（如果需要）
        if (loadTableStructure && context.tables && context.tables.length > 0) {
          for (const tableInfo of context.tables) {
            const shortName = tableInfo.name.includes('.') 
              ? tableInfo.name.split('.').pop()! 
              : tableInfo.name
            const fields = getTableFields(shortName) || getTableFields(tableInfo.name)
            if (!fields || fields.length === 0) {
              await loadTableStructure(shortName)
            }
          }
        }
        
        let suggestions: Suggestion[] = []
        
        switch (context.clause) {
          case 'INITIAL':
            SQL_KEYWORDS.INITIAL.forEach(keyword => {
              if (!prefix || keyword.toLowerCase().startsWith(prefix.toLowerCase())) {
                suggestions.push({ caption: keyword, value: keyword, meta: 'keyword', score: 1000 })
              }
            })
            break
          case 'DELETE':
            // DELETE 后面提示 FROM
            if (!prefix || 'FROM'.toLowerCase().startsWith(prefix.toLowerCase())) {
              suggestions.push({ caption: 'FROM', value: 'FROM', meta: 'keyword', score: 1000 })
            }
            break
          case 'UPDATE':
            // UPDATE 后面提示表名
            tables.forEach(table => {
              const matchResult = fuzzyMatch(prefix, table.name)
              if (matchResult.match) {
                suggestions.push({ 
                  caption: table.name, 
                  value: table.name, 
                  meta: 'table', 
                  score: 900 + matchResult.score 
                })
              }
            })
            break
          case 'SET':
            // SET 后面提示字段名和 WHERE
            if (!prefix || 'WHERE'.toLowerCase().startsWith(prefix.toLowerCase())) {
              suggestions.push({ caption: 'WHERE', value: 'WHERE', meta: 'keyword', score: 800 })
            }
            break
          case 'INSERT':
            // INSERT 后面提示 INTO
            if (!prefix || 'INTO'.toLowerCase().startsWith(prefix.toLowerCase())) {
              suggestions.push({ caption: 'INTO', value: 'INTO', meta: 'keyword', score: 1000 })
            }
            break
          case 'INSERT_INTO':
            // INSERT INTO 后面提示表名
            tables.forEach(table => {
              const matchResult = fuzzyMatch(prefix, table.name)
              if (matchResult.match) {
                suggestions.push({ 
                  caption: table.name, 
                  value: table.name, 
                  meta: 'table', 
                  score: 900 + matchResult.score 
                })
              }
            })
            break
          case 'VALUES':
            // VALUES 后面不需要特殊提示
            break
          case 'SELECT':
            suggestions = getSelectCompletions(context, prefix, tables)
            break
          case 'FROM':
            suggestions = getFromCompletions(context, prefix, tables)
            break
          case 'WHERE':
            suggestions = getWhereCompletions(context, prefix)
            break
          case 'JOIN':
            suggestions = getJoinCompletions(context, prefix, tables)
            break
          case 'ORDER_BY':
          case 'GROUP_BY':
            if (context.tables && context.tables.length > 0) {
              const firstTable = context.tables[0]
              const fields = getTableFields(firstTable.name)
              if (fields) {
                fields.forEach(field => {
                  const matchResult = fuzzyMatch(prefix, field.caption)
                  if (matchResult.match) {
                    suggestions.push({ ...field, score: (field.score || 900) + matchResult.score })
                  }
                })
              }
            }
            if (context.clause === 'ORDER_BY') {
              SQL_KEYWORDS.ORDER_BY.forEach(keyword => {
                const matchResult = fuzzyMatch(prefix, keyword)
                if (matchResult.match) {
                  suggestions.push({ caption: keyword, value: keyword, meta: 'keyword', score: 800 + matchResult.score })
                }
              })
            }
            break
          case 'LIMIT':
            if (context.isAfterNumber) {
              if (!prefix || 'OFFSET'.toLowerCase().startsWith(prefix.toLowerCase())) {
                suggestions.push({ caption: 'OFFSET', value: 'OFFSET', meta: 'keyword', score: 1000 })
              }
            }
            break
          default:
            SQL_KEYWORDS.INITIAL.forEach(keyword => {
              const matchResult = fuzzyMatch(prefix, keyword)
              if (matchResult.match) {
                suggestions.push({ caption: keyword, value: keyword, meta: 'keyword', score: 500 + matchResult.score })
              }
            })
        }
        
        return callback(null, deduplicateSuggestions(suggestions))
      } catch (error) {
        console.error('SQL自动补全出错:', error)
        return callback(null, [])
      } finally {
        isProcessingCompletion = false
      }
    },
    
    getDocTooltip
  }
  
  langTools.addCompleter(completer)
  
  // 设置自定义渲染器并修复滚动问题
  const AutocompleteModule = ace.require('ace/autocomplete')
  if (AutocompleteModule?.Autocomplete?.prototype) {
    const Autocomplete = AutocompleteModule.Autocomplete
    Autocomplete.prototype.customRenderer = customRenderer

    if (!Autocomplete.prototype.__cmdbUiFixScroll) {
      Autocomplete.prototype.__cmdbUiFixScroll = true
      const resetToTop = (ac: any) => {
        try {
          const popup = ac?.popup
          if (!popup) return
          if (typeof popup.setRow === 'function') popup.setRow(0)
          if (popup.renderer?.scrollToRow) popup.renderer.scrollToRow(0)
          if (popup.session?.setScrollTop) popup.session.setScrollTop(0)
        } catch { /* ignore */ }
      }
      const wrap = (name: string) => {
        const orig = Autocomplete.prototype[name]
        if (typeof orig !== 'function') return
        Autocomplete.prototype[name] = function(...args: any[]) {
          const ret = orig.apply(this, args)
          setTimeout(() => resetToTop(this), 0)
          return ret
        }
      }
      wrap('showPopup')
      wrap('updateCompletions')
      wrap('openPopup')
    }
  }
  
  return completer
}

// 导出工具函数
export { fuzzyMatch } from './matcher'
export { getTableFields, cacheTableFields, initCache } from './cache'
export { analyzeContext, extractTablesFromSql, parseTableAliases } from './parser'
export type { Suggestion, TableInfo, FieldInfo, SqlContext } from './types'
