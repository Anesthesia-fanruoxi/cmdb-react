/**
 * SQL编辑器组件 - 使用 ACE 编辑器，支持智能提示
 */

import { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react'
import ace from 'ace-builds'
import 'ace-builds/src-noconflict/mode-sql'
import 'ace-builds/src-noconflict/theme-xcode'
import 'ace-builds/src-noconflict/theme-tomorrow_night'
import 'ace-builds/src-noconflict/ext-language_tools'
import { createSqlCompleter } from '@/utils/sql'
import { updateTabTables } from '@/utils/sql/tableExtractor'
import { useUserPrefsStore } from '@/stores/userPrefsStore'
import { formatSqlContent, createDotHandler } from './sqlEditorUtils'
import SearchDialog from './SearchDialog'
import ReplaceDialog from './ReplaceDialog'
import type { TableInfo, FieldInfo } from '@/utils/sql'
import '../styles/ace.css'  // 引入ACE编辑器自定义样式

interface Props {
  value: string
  onChange: (value: string) => void  // 失焦或防抖时触发，不在每次输入时触发
  onExecute: () => void
  onNewTab?: () => void
  onShowHistory?: () => void
  loading: boolean
  onFocus?: () => void
  onBlur?: () => void
  tables?: TableInfo[]
  currentDb?: string
  loadTableStructure?: (tableName: string) => Promise<FieldInfo[] | null>
  tabId?: string  // 标签页唯一键，用于表名注册表
}

/** 暴露给父组件的方法 */
export interface SqlEditorRef {
  format: () => void
  getSelectedText: () => string
  getValue: () => string  // 获取当前最新值（不依赖 React 状态）
  showFind: () => void
  showReplace: () => void
  getEditor: () => ace.Ace.Editor | null
}

const SqlEditor = forwardRef<SqlEditorRef, Props>(({ 
  value, onChange, onExecute, onNewTab, onShowHistory, loading, onFocus, onBlur,
  tables = [], loadTableStructure, tabId
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const aceEditorRef = useRef<ace.Ace.Editor | null>(null)
  const completerRef = useRef<any>(null)
  const tablesRef = useRef<TableInfo[]>(tables)
  const loadTableStructureRef = useRef(loadTableStructure)
  const isInternalChange = useRef(false)
  // 内部 SQL 值 ref，输入时只更新这里，不触发 React 重渲染
  const sqlValueRef = useRef(value)
  // 防抖定时器
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 稳定的 onChange ref
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  
  // 查找/替换对话框状态
  const [showFindDialog, setShowFindDialog] = useState(false)
  const [showReplaceDialog, setShowReplaceDialog] = useState(false)
  
  // 从用户偏好获取字体大小
  const { uiPrefs, setUiPref, _hasHydrated } = useUserPrefsStore()
  const [fontSize, setFontSize] = useState(16) // 默认16px
  
  // 字体大小提示框状态
  const [showFontSizeTooltip, setShowFontSizeTooltip] = useState(false)
  const fontSizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fontSizeSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // hydration 完成后同步字体大小
  useEffect(() => {
    if (_hasHydrated) {
      // 如果有保存的值且合理（5-32之间），使用保存的值
      if (uiPrefs.codeEditorFontSize && uiPrefs.codeEditorFontSize >= 5 && uiPrefs.codeEditorFontSize <= 32) {
        setFontSize(uiPrefs.codeEditorFontSize);
        // 同时更新编辑器
        if (aceEditorRef.current) {
          aceEditorRef.current.setOptions({
            fontSize: `${uiPrefs.codeEditorFontSize}px`
          });
        }
      } else {
        // 否则使用默认值并保存
        setFontSize(16);
        setUiPref('codeEditorFontSize', 16);
        if (aceEditorRef.current) {
          aceEditorRef.current.setOptions({
            fontSize: '16px'
          });
        }
      }
    }
  }, [_hasHydrated, uiPrefs.codeEditorFontSize, setUiPref]);
  
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

  useImperativeHandle(ref, () => ({
    format: () => {
      if (aceEditorRef.current) formatSqlContent(aceEditorRef.current)
    },
    getSelectedText: () => aceEditorRef.current?.getSelectedText() || '',
    getValue: () => aceEditorRef.current?.getValue() ?? sqlValueRef.current,
    showFind: () => { setShowReplaceDialog(false); setShowFindDialog(true) },
    showReplace: () => { setShowFindDialog(false); setShowReplaceDialog(true) },
    getEditor: () => aceEditorRef.current
  }))

  // 更新 tables ref 并预加载字段
  useEffect(() => {
    tablesRef.current = tables
    
    // 元数据已在项目切换时全部缓存,无需预加载
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
    editor.setTheme(isDark ? 'ace/theme/tomorrow_night' : 'ace/theme/xcode')
    editor.session.setMode('ace/mode/sql')

    // 监听主题变化
    const observer = new MutationObserver(() => {
      const isDarkNow = document.documentElement.classList.contains('dark')
      editor.setTheme(isDarkNow ? 'ace/theme/tomorrow_night' : 'ace/theme/xcode')
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
      useSoftTabs: true,
      liveAutocompletionDelay: 150,
      liveAutocompletionThreshold: 1
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

    // 监听内容变化 — 只更新内部 ref + 防抖，不触发 React 重渲染
    let isInitializing = true
    editor.on('change', (delta: any) => {
      isInternalChange.current = true
      const newValue = editor.getValue()
      sqlValueRef.current = newValue

      // 跳过初始化时的 setValue 触发，只响应用户真实输入
      if (!isInitializing && tabId) updateTabTables(tabId, newValue)

      // 防抖 500ms 同步到 React 状态（用于自动保存）
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        onChangeRef.current(sqlValueRef.current)
      }, 500)

      // 回车键关闭补全弹窗
      if (delta.action === 'insert' && delta.lines && delta.lines[0] === '') {
        const completer = (editor as any).completer
        if (completer?.popup?.isOpen) completer.detach()
      }

      isInternalChange.current = false
    })

    // 失焦时立即同步到 React 状态
    editor.on('blur', () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      onChangeRef.current(sqlValueRef.current)
      onBlur?.()
    })

    editor.on('focus', () => onFocus?.())

    // 添加点号处理器（用于 table.field 补全）
    createDotHandler(editor, loadTableStructure)

    // 设置初始值（在 change 监听之后，但标记初始化中，不触发表名提取）
    if (value) {
      editor.setValue(value, 1)
    }
    // 初始化完成，后续 change 事件才触发表名提取
    isInitializing = false

    // 添加鼠标滚轮缩放功能
    const handleWheel = (e: WheelEvent) => {
      // 检测是否按下 Ctrl 键
      if (e.ctrlKey) {
        e.preventDefault()
        
        setFontSize(prevSize => {
          // 根据滚轮方向调整字体大小
          const delta = e.deltaY > 0 ? -1 : 1
          const newSize = prevSize + delta
          
          // 限制字体大小范围: 5px - 32px
          const clampedSize = Math.max(5, Math.min(32, newSize))
          
          // 更新编辑器字体大小
          editor.setOptions({
            fontSize: `${clampedSize}px`
          })
          
          // 显示字体大小提示
          setShowFontSizeTooltip(true)
          
          // 清除之前的提示定时器
          if (fontSizeTimerRef.current) {
            clearTimeout(fontSizeTimerRef.current)
          }
          
          // 1秒后自动隐藏提示
          fontSizeTimerRef.current = setTimeout(() => {
            setShowFontSizeTooltip(false)
          }, 1000)
          
          // 清除之前的保存定时器
          if (fontSizeSaveTimerRef.current) {
            clearTimeout(fontSizeSaveTimerRef.current)
          }
          
          // 滚动结束后 500ms 保存（防抖）
          fontSizeSaveTimerRef.current = setTimeout(() => {
            setUiPref('codeEditorFontSize', clampedSize);
          }, 500);
          
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
      if (fontSizeTimerRef.current) clearTimeout(fontSizeTimerRef.current)
      if (fontSizeSaveTimerRef.current) clearTimeout(fontSizeSaveTimerRef.current)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      editor.destroy()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 同步外部 value 变化（仅处理外部赋值，如历史记录插入，跳过用户输入触发的回环）
  useEffect(() => {
    const editor = aceEditorRef.current
    if (editor && !isInternalChange.current && editor.getValue() !== value) {
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

    // 删除整行快捷键
    editor.commands.removeCommand('deleteLine')
    editor.commands.addCommand({
      name: 'deleteLine',
      bindKey: {
        win: sqlShortcuts.deleteLine || 'Ctrl-Q',
        mac: (sqlShortcuts.deleteLine || 'Ctrl-Q').replace('Ctrl', 'Command')
      },
      exec: (ed) => {
        const session = ed.getSession()
        const row = ed.getCursorPosition().row
        const lastRow = session.getLength() - 1

        if (lastRow === 0) {
          // 只有一行，清空
          session.doc.removeLines(0, 0)
        } else if (row < lastRow) {
          // 非最后一行：删除当前行（含换行），光标移到上一行末尾
          session.doc.removeLines(row, row)
          if (row > 0) {
            ed.moveCursorTo(row - 1, session.getLine(row - 1).length)
          } else {
            ed.moveCursorTo(0, 0)
          }
        } else {
          // 最后一行：删除上一行的换行符 + 当前行，光标移到上一行末尾
          session.doc.removeLines(row, row)
          const prevLen = session.getLine(row - 1).length
          ed.moveCursorTo(row - 1, prevLen)
        }
      }
    })
  }, [sqlShortcuts, loading, onExecute, onNewTab, onShowHistory])

  return (
    <div className="sql-editor" style={{ position: 'relative' }}>
      <div ref={editorRef} className="ace-editor" style={{ width: '100%', height: '100%' }} />
      
      {/* 字体大小提示框 */}
      {showFontSizeTooltip && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '500',
          pointerEvents: 'none',
          zIndex: 10000,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
          whiteSpace: 'nowrap'
        }}>
          字体大小: {fontSize}px
        </div>
      )}
      
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
