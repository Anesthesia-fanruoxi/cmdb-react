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
  
  // 获取用户自定义快捷键
  const sqlShortcuts = useUserPrefsStore((state) => state.sqlShortcuts)

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
