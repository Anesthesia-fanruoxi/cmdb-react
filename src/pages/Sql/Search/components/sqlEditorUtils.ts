/**
 * SQL 编辑器工具函数
 */

import ace from 'ace-builds'
import { format } from 'sql-formatter'
import { message } from 'antd'
import type { FieldInfo } from '@/utils/sql'

/** 格式化 SQL 内容 */
export function formatSqlContent(editor: ace.Ace.Editor) {
  try {
    const selection = editor.getSelection()
    const selectedText = editor.getSelectedText()
    
    // 判断是否有选中文本
    const isSelection = selectedText && selectedText.trim().length > 0
    const sql = isSelection ? selectedText : editor.getValue()
    
    if (!sql.trim()) {
      message.warning('没有可格式化的SQL语句')
      return
    }
    
    // 使用 sql-formatter 格式化 SQL
    const formattedSql = format(sql, {
      language: 'mysql',
      keywordCase: 'upper',
      linesBetweenQueries: 2,
      indentStyle: 'standard'
    })
    
    if (isSelection) {
      // 替换选中部分
      const range = selection.getRange()
      editor.session.replace(range, formattedSql)
    } else {
      // 替换整个内容
      editor.setValue(formattedSql, 1)
    }
    
    message.success('SQL格式化成功')
  } catch (error: any) {
    message.error(`SQL格式化失败: ${error.message}`)
  }
}

/** 创建点号处理器，用于 table.field 补全 - 与 Vue 版本对齐 */
export function createDotHandler(
  editor: ace.Ace.Editor, 
  loadTableStructure?: (tableName: string) => Promise<FieldInfo[] | null>
) {
  editor.commands.addCommand({
    name: 'dotAndComplete',
    bindKey: { win: '.', mac: '.' },
    exec: async (ed) => {
      // 插入点号
      ed.insert('.')

      // 获取光标位置和当前行
      const pos = ed.getCursorPosition()
      const line = ed.session.getLine(pos.row)
      const cursorColumn = pos.column

      // 点号前的文本
      const textBeforeDot = line.substring(0, cursorColumn - 1)
      // 尝试提取表名或别名
      const match = textBeforeDot.match(/(\w+)$/)

      if (!match) {
        // 没有匹配到标识符，触发普通补全
        setTimeout(() => ed.execCommand('startAutocomplete'), 50)
        return true
      }

      const identifier = match[1]
      const key = identifier.toLowerCase()

      // 初始化缓存
      if (!window.sqlFieldSuggestions) {
        window.sqlFieldSuggestions = {}
      }

      // 检查是否需要缓存别名对应的表字段
      if (!window.sqlFieldSuggestions[key] && !window.sqlFieldSuggestions[identifier]) {
        const fullSql = ed.getValue()
        // 获取当前语句（分号后的部分）
        const lastSemicolon = fullSql.lastIndexOf(';')
        const currentSql = lastSemicolon === -1 ? fullSql : fullSql.substring(lastSemicolon + 1)
        
        // 分析当前 SQL 找出别名对应的表名
        const fromMatch = currentSql.match(/\bFROM\b\s+([^;]*?)(?:\bWHERE\b|\bGROUP\s+BY\b|\bHAVING\b|\bORDER\s+BY\b|\bLIMIT\b|$)/is)
        if (fromMatch) {
          const fromClause = fromMatch[1].trim()
          // 匹配 "表名 别名" 或 "表名 AS 别名"
          const tableAliasMatch = fromClause.match(new RegExp(`\\b(\\w+)\\s+(?:AS\\s+)?${identifier}\\b`, 'i'))
          if (tableAliasMatch) {
            const tableName = tableAliasMatch[1]
            const tableKey = tableName.toLowerCase()
            // 将表字段缓存到别名下
            const fields = window.sqlFieldSuggestions[tableKey] || window.sqlFieldSuggestions[tableName]
            if (fields) {
              window.sqlFieldSuggestions[identifier] = fields
              window.sqlFieldSuggestions[key] = fields
            } else if (loadTableStructure) {
              // 如果表字段未缓存，先加载表结构
              const loadedFields = await loadTableStructure(tableName)
              if (loadedFields && loadedFields.length > 0) {
                window.sqlFieldSuggestions[identifier] = loadedFields
                window.sqlFieldSuggestions[key] = loadedFields
              }
            }
          } else if (loadTableStructure) {
            // 不是别名，可能是表名，尝试加载表结构
            await loadTableStructure(identifier)
          }
        } else if (loadTableStructure) {
          // 没有 FROM 子句，直接尝试加载表结构
          await loadTableStructure(identifier)
        }
      }

      // 触发自动补全
      setTimeout(() => {
        ed.execCommand('startAutocomplete')
      }, 50)

      return true
    }
  })
}
