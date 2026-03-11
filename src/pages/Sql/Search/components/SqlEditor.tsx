/**
 * SQL编辑器组件 - 使用 ACE 编辑器，支持智能提示
 */

import { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react'
import ace from 'ace-builds'
import 'ace-builds/src-noconflict/mode-sql'
import 'ace-builds/src-noconflict/theme-xcode'
import 'ace-builds/src-noconflict/theme-twilight'
import 'ace-builds/src-noconflict/ext-language_tools'
import { createSqlCompleter } from '@/utils/sql'
import { useUserPrefsStore } from '@/stores/userPrefsStore'
import { formatSqlContent, createDotHandler } from './sqlEditorUtils'
import SearchDialog from './SearchDialog'
import ReplaceDialog from './ReplaceDialog'
import type { TableInfo, FieldInfo } from '@/utils/sql'
import '../styles/ace.css'  // 引入ACE编辑器自定义样式

interface Props {
  value: string
  onChange: (value: string) => void
  onExecute: () => void
  onNewTab?: () => void
  onShowHistory?: () => void
  loading: boolean
  onFocus?: () => void
  onBlur?: () => void
  tables?: TableInfo[]
  currentDb?: string
  loadTableStructure?: (tableName: string) => Promise<FieldInfo[] | null>
}

/** 暴露给父组件的方法 */
export interface SqlEditorRef {
  format: () => void
  getSelectedText: () => string
  showFind: () => void
  showReplace: () => void
  getEditor: () => ace.Ace.Editor | null
}

const SqlEditor = forwardRef<SqlEditorRef, Props>(({ 
  value, onChange, onExecute, onNewTab, onShowHistory, loading, onFocus, onBlur,
  tables = [], loadTableStructure 
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const aceEditorRef = useRef<ace.Ace.Editor | null>(null)
  const completerRef = useRef<any>(null)
  const tablesRef = useRef<TableInfo[]>(tables)
  const loadTableStructureRef = useRef(loadTableStructure)
  
  // 查找/替换对话框状态
  const [showFindDialog, setShowFindDialog] = useState(false)
  const [showReplaceDialog, setShowReplaceDialog] = useState(false)
  
  // 字体大小状态（用于Ctrl+滚轮缩放）
  const [fontSize, setFontSize] = useState(14)
  
  // 获取用户自定义快捷键
  const sqlShortcuts = useUserPrefsStore((state) => state.sqlShortcuts)
  
  // 实际使用 fontSize
  useEffect(() => {
    if (aceEditorRef.current) {
      aceEditorRef.current.setOptions({
        fontSize: `${fontSize}px`
      })
    }
  }, [fontSize])

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    format: () => {
      if (aceEditorRef.current) {
        formatSqlContent(aceEditorRef.current)
      }
    },
    getSelectedText: () => {
      return aceEditorRef.current?.getSelectedText() || ''
    },
    showFind: () => {
      setShowReplaceDialog(false)
      setShowFindDialog(true)
    },
    showReplace: () => {
      setShowFindDialog(false)
      setShowReplaceDialog(true)
    },
    getEditor: () => aceEditorRef.current
  }))

  // 更新 tables ref 并预加载字段
  useEffect(() => {
    tablesRef.current = tables
    
    // 预加载前5个表的字段（异步不阻塞）
    if (loadTableStructure && tables.length > 0) {
      tables.slice(0, 5).forEach(table => {
        loadTableStructure(table.name).catch(() => {})
      })
    }
  }, [tables, loadTableStructure])

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
    
    // 自定义补全弹窗渲染器
    const setupCustomRenderer = () => {
      const langTools = ace.require('ace/ext/language_tools')
      const Autocomplete = langTools.Autocomplete
      
      if (Autocomplete && !Autocomplete.prototype.$customRendererSetup) {
        Autocomplete.prototype.$customRendererSetup = true
        
        // 重写渲染逻辑
        Autocomplete.prototype.renderer = {
          ...Autocomplete.prototype.renderer,
          $textLayer: {
            ...Autocomplete.prototype.renderer?.$textLayer,
            renderLine: function(row: number) {
              const item = this.editor?.completer?.popup?.data?.[row]
              if (!item) return ''
              
              // 构建自定义 HTML
              const icon = item.iconText || '•'
              const color = item.iconColor || '#888'
              const name = item.caption
              const typeLabel = item.typeLabel || item.meta || ''
              
              // 只有表和字段显示库名
              let dbNameText = ''
              if (item.dbName && (item.meta === 'field' || item.meta === 'table')) {
                dbNameText = `<span style="margin-left:8px;opacity:0.7">[${item.dbName}]</span>`
              }
              
              return `<div class="ace_line" style="display:flex;align-items:center;padding:6px 10px;">
                        <span style="color:${color};margin-right:8px;">${icon}</span>
                        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;">${name}</span>
                        <span style="margin-left:auto;font-size:11px;color:#888;opacity:0.7;padding-left:8px;">${typeLabel}${dbNameText}</span>
                      </div>`
            }
          }
        }
      }
    }
    
    // 初始化自定义渲染器
    setupCustomRenderer()

    // 监听内容变化
    editor.on('change', (delta: any) => {
      const newValue = editor.getValue()
      onChange(newValue)
      
      // 如果是回车键，关闭补全弹窗
      if (delta.action === 'insert' && delta.lines && delta.lines[0] === '') {
        const completer = (editor as any).completer
        if (completer?.popup?.isOpen) {
          completer.detach()
          return
        }
      }
      
      // 如果补全弹窗已打开，强制重新触发补全
      const completer = (editor as any).completer
      if (completer?.popup?.isOpen) {
        setTimeout(() => {
          editor.execCommand('startAutocomplete')
        }, 10)
      }
      
      // 延迟修改 DOM（无论弹窗是否已打开）
      setTimeout(() => {
        const completer = (editor as any).completer
        if (completer?.popup?.isOpen && completer.popup.data) {
          const popup = completer.popup
          const rows = popup.renderer.container.querySelectorAll('.ace_line')
          
          popup.data.forEach((item: any, index: number) => {
            const row = rows[index]
            if (row && item.iconText) {
              // 清空原有内容
              row.innerHTML = ''
              
              // 构建自定义 HTML
              const icon = item.iconText || '•'
              const color = item.iconColor || '#888'
              const name = item.caption
              const typeLabel = item.typeLabel || ''
              
              // 只有表和字段显示库名
              let dbNameText = ''
              if (item.dbName && (item.meta === 'field' || item.meta === 'table')) {
                dbNameText = ` [${item.dbName}]`
              }
              
              row.innerHTML = `
                <span style="color:${color};margin-right:8px;flex-shrink:0;">${icon}</span>
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;">${name}</span>
                <span style="margin-left:auto;font-size:11px;color:#888;opacity:0.7;padding-left:8px;white-space:nowrap;">${typeLabel}${dbNameText}</span>
              `
              row.style.display = 'flex'
              row.style.alignItems = 'center'
              row.style.padding = '6px 10px'
            }
          })
        }
      }, 150)
    })
    
    // 监听焦点事件
    editor.on('focus', () => onFocus?.())
    editor.on('blur', () => onBlur?.())

    // 添加点号处理器（用于 table.field 补全）
    createDotHandler(editor, loadTableStructure)

    // 设置初始值
    if (value) {
      editor.setValue(value, 1)
    }

    // 添加鼠标滚轮缩放功能
    const handleWheel = (e: WheelEvent) => {
      // 检测是否按下 Ctrl 键
      if (e.ctrlKey) {
        e.preventDefault()
        
        setFontSize(prevSize => {
          // 根据滚轮方向调整字体大小
          const delta = e.deltaY > 0 ? -1 : 1
          const newSize = prevSize + delta
          
          // 限制字体大小范围: 10px - 24px
          const clampedSize = Math.max(10, Math.min(24, newSize))
          
          // 更新编辑器字体大小
          editor.setOptions({
            fontSize: `${clampedSize}px`
          })
          
          return clampedSize
        })
      }
    }

    // 监听编辑器容器的滚轮事件
    const editorContainer = editorRef.current
    if (editorContainer) {
      editorContainer.addEventListener('wheel', handleWheel, { passive: false })
    }

    // 清理
    return () => {
      observer.disconnect()
      if (editorContainer) {
        editorContainer.removeEventListener('wheel', handleWheel)
      }
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

  // 当快捷键配置变化时，更新编辑器命令绑定
  useEffect(() => {
    const editor = aceEditorRef.current
    if (!editor) return

    // 更新执行快捷键
    editor.commands.removeCommand('executeQuery')
    editor.commands.addCommand({
      name: 'executeQuery',
      bindKey: { win: sqlShortcuts.execute, mac: sqlShortcuts.execute.replace('Ctrl', 'Command') },
      exec: () => {
        if (!loading) onExecute()
      }
    })

    // 更新格式化快捷键
    editor.commands.removeCommand('formatSql')
    editor.commands.addCommand({
      name: 'formatSql',
      bindKey: { win: sqlShortcuts.format, mac: sqlShortcuts.format.replace('Ctrl', 'Command') },
      exec: (ed) => {
        formatSqlContent(ed)
      }
    })

    // 更新注释快捷键
    editor.commands.removeCommand('toggleComment')
    editor.commands.addCommand({
      name: 'toggleComment',
      bindKey: { win: sqlShortcuts.comment, mac: sqlShortcuts.comment.replace('Ctrl', 'Command') },
      exec: (ed) => {
        ed.toggleCommentLines()
      }
    })

    // 更新查找快捷键
    editor.commands.removeCommand('customFind')
    editor.commands.addCommand({
      name: 'customFind',
      bindKey: { win: sqlShortcuts.find, mac: sqlShortcuts.find.replace('Ctrl', 'Command') },
      exec: () => {
        setShowReplaceDialog(false)
        setShowFindDialog(true)
      }
    })

    // 更新替换快捷键
    editor.commands.removeCommand('customReplace')
    editor.commands.addCommand({
      name: 'customReplace',
      bindKey: { win: sqlShortcuts.replace, mac: sqlShortcuts.replace.replace('Ctrl', 'Command') },
      exec: () => {
        setShowFindDialog(false)
        setShowReplaceDialog(true)
      }
    })

    // 更新新建标签快捷键
    editor.commands.removeCommand('newTab')
    editor.commands.addCommand({
      name: 'newTab',
      bindKey: { win: sqlShortcuts.newTab, mac: sqlShortcuts.newTab.replace('Ctrl', 'Command') },
      exec: () => {
        onNewTab?.()
      }
    })

    // 更新历史记录快捷键
    editor.commands.removeCommand('showHistory')
    editor.commands.addCommand({
      name: 'showHistory',
      bindKey: { win: sqlShortcuts.history, mac: sqlShortcuts.history.replace('Ctrl', 'Command') },
      exec: () => {
        onShowHistory?.()
      }
    })

    // 更新复制当前行快捷键
    editor.commands.removeCommand('duplicateLine')
    editor.commands.addCommand({
      name: 'duplicateLine',
      bindKey: { win: sqlShortcuts.duplicateLine, mac: sqlShortcuts.duplicateLine.replace('Ctrl', 'Command') },
      exec: (ed) => {
        const session = ed.getSession()
        const selection = ed.getSelection()
        const range = selection.getRange()
        
        // 如果有选中内容，复制选中的内容
        if (!selection.isEmpty()) {
          const selectedText = session.getTextRange(range)
          ed.moveCursorTo(range.end.row, range.end.column)
          ed.insert('\n' + selectedText)
        } else {
          // 如果没有选中内容，复制当前行
          const cursorRow = ed.getCursorPosition().row
          const lineText = session.getLine(cursorRow)
          
          // 在当前行末尾插入换行和复制的内容
          ed.moveCursorTo(cursorRow, lineText.length)
          ed.insert('\n' + lineText)
        }
      }
    })
  }, [sqlShortcuts, loading, onExecute, onNewTab, onShowHistory])

  return (
    <div className="sql-editor">
      <div ref={editorRef} className="ace-editor" style={{ width: '100%', height: '100%' }} />
      <SearchDialog 
        visible={showFindDialog} 
        onClose={() => setShowFindDialog(false)} 
        editor={aceEditorRef.current} 
      />
      <ReplaceDialog 
        visible={showReplaceDialog} 
        onClose={() => setShowReplaceDialog(false)} 
        editor={aceEditorRef.current} 
      />
    </div>
  )
})

SqlEditor.displayName = 'SqlEditor'

export default SqlEditor
