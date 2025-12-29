/**
 * SQL编辑器组件 - 使用 ACE 编辑器，支持智能提示
 */

import { useRef, useEffect } from 'react'
import ace from 'ace-builds'
import 'ace-builds/src-noconflict/mode-sql'
import 'ace-builds/src-noconflict/theme-xcode'
import 'ace-builds/src-noconflict/theme-twilight'
import 'ace-builds/src-noconflict/ext-language_tools'
import { createSqlCompleter } from '@/utils/sql'
import type { TableInfo, FieldInfo } from '@/utils/sql'

interface Props {
  value: string
  onChange: (value: string) => void
  onExecute: () => void
  loading: boolean
  onFocus?: () => void
  onBlur?: () => void
  tables?: TableInfo[]
  currentDb?: string
  loadTableStructure?: (tableName: string) => Promise<FieldInfo[] | null>
}

const SqlEditor = ({ 
  value, onChange, onExecute, loading, onFocus, onBlur,
  tables = [], loadTableStructure 
}: Props) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const aceEditorRef = useRef<ace.Ace.Editor | null>(null)
  const completerRef = useRef<any>(null)
  const tablesRef = useRef<TableInfo[]>(tables)
  const loadTableStructureRef = useRef(loadTableStructure)

  // 更新 tables ref
  useEffect(() => {
    tablesRef.current = tables
  }, [tables])

  // 更新 loadTableStructure ref
  useEffect(() => {
    loadTableStructureRef.current = loadTableStructure
  }, [loadTableStructure])

  // 初始化编辑器
  useEffect(() => {
    if (!editorRef.current) return

    const editor = ace.edit(editorRef.current)
    aceEditorRef.current = editor

    // 设置主题（根据系统主题）
    const isDark = document.documentElement.classList.contains('dark')
    editor.setTheme(isDark ? 'ace/theme/twilight' : 'ace/theme/xcode')
    editor.session.setMode('ace/mode/sql')

    // 监听主题变化
    const observer = new MutationObserver(() => {
      const isDarkNow = document.documentElement.classList.contains('dark')
      editor.setTheme(isDarkNow ? 'ace/theme/twilight' : 'ace/theme/xcode')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    // 设置编辑器选项
    editor.setOptions({
      fontSize: '14px',
      showLineNumbers: true,
      tabSize: 2,
      wrap: true,
      printMargin: false,
      highlightActiveLine: true,
      enableBasicAutocompletion: true,
      enableLiveAutocompletion: true,
      enableSnippets: false,
      showPrintMargin: false,
      showFoldWidgets: true,
      useSoftTabs: true
    })

    // 初始化 SQL 补全器
    completerRef.current = createSqlCompleter(ace, {
      getTables: () => tablesRef.current,
      loadTableStructure: (tableName: string) => {
        if (loadTableStructureRef.current) {
          return loadTableStructureRef.current(tableName)
        }
        return Promise.resolve(null)
      }
    })

    // 监听内容变化
    editor.on('change', () => {
      const newValue = editor.getValue()
      onChange(newValue)
    })

    // 监听焦点事件
    editor.on('focus', () => onFocus?.())
    editor.on('blur', () => onBlur?.())

    // 添加执行快捷键 Ctrl+Enter
    editor.commands.addCommand({
      name: 'executeQuery',
      bindKey: { win: 'Ctrl-Enter', mac: 'Command-Enter' },
      exec: () => {
        if (!loading) onExecute()
      }
    })

    // 添加点号处理器（用于 table.field 补全）
    createDotHandler(editor, loadTableStructure)

    // 设置初始值
    if (value) {
      editor.setValue(value, 1)
    }

    // 清理
    return () => {
      observer.disconnect()
      editor.destroy()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 同步外部 value 变化
  useEffect(() => {
    const editor = aceEditorRef.current
    if (editor && editor.getValue() !== value) {
      const cursorPos = editor.getCursorPosition()
      editor.setValue(value, 1)
      editor.moveCursorToPosition(cursorPos)
    }
  }, [value])

  return (
    <div className="sql-editor">
      <div ref={editorRef} className="ace-editor" style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

/** 创建点号处理器，用于 table.field 补全 - 与 Vue 版本对齐 */
function createDotHandler(
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
                // loadTableStructure 已经缓存了表字段，现在缓存到别名
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

export default SqlEditor
