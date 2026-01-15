/**
 * SQL分析结果对话框
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import ace from 'ace-builds'
import 'ace-builds/src-noconflict/mode-sql'
import 'ace-builds/src-noconflict/theme-xcode'
import 'ace-builds/src-noconflict/theme-twilight'
import { type SqlCheckResult } from '../../../services/sql/apply'
import SyntaxErrorPanel from './components/SyntaxErrorPanel'
import AnalysisContent from './components/AnalysisContent'
import RulesContent from './components/RulesContent'
import './drawer.css'
import './analysis.css'

interface Props {
  sqlList: SqlCheckResult[]
  mode?: 'create' | 'view'
  hasBlocker?: boolean
  submitting?: boolean
  onConfirm?: () => void
  onCancel: () => void
}

const SqlAnalysisDialog = ({ 
  sqlList, 
  mode = 'create', 
  hasBlocker = false,
  submitting = false,
  onConfirm, 
  onCancel 
}: Props) => {
  const [activeTab, setActiveTab] = useState(0)
  const [activeResultTab, setActiveResultTab] = useState<'analysis' | 'rules'>('analysis')
  const editorRefs = useRef<Record<number, ace.Ace.Editor>>({})
  const containerRefs = useRef<Record<number, HTMLDivElement | null>>({})

  const currentSql = sqlList[activeTab] || null

  // 判断是否有语法错误
  const hasSyntaxError = (sql: SqlCheckResult) => {
    const rules = sql.rule_infos || sql.rule_results || []
    return rules.some(r => r.rule_type === 'syntax_check' && !r.passed)
  }

  // 初始化编辑器
  const createEditor = useCallback((index: number) => {
    const container = containerRefs.current[index]
    if (!container || editorRefs.current[index]) return
    
    const editor = ace.edit(container)
    const isDark = document.documentElement.classList.contains('dark')
    
    editor.setTheme(isDark ? 'ace/theme/twilight' : 'ace/theme/xcode')
    editor.session.setMode('ace/mode/sql')
    editor.setReadOnly(true)
    editor.setOptions({
      fontSize: '13px',
      showLineNumbers: true,
      showGutter: true,
      highlightActiveLine: false,
      showPrintMargin: false,
      wrap: true
    })
    
    if (sqlList[index]) {
      editor.setValue(sqlList[index].sql || '', -1)
    }
    
    // 隐藏光标
    const cursorLayer = (editor.renderer as any).$cursorLayer
    if (cursorLayer?.element) {
      cursorLayer.element.style.display = 'none'
    }
    
    editorRefs.current[index] = editor
  }, [sqlList])

  // 组件挂载后初始化当前 tab 的编辑器
  useEffect(() => {
    const timer = setTimeout(() => {
      createEditor(activeTab)
      editorRefs.current[activeTab]?.resize()
    }, 100)
    return () => clearTimeout(timer)
  }, [activeTab, createEditor])

  // 清理编辑器
  useEffect(() => {
    return () => {
      Object.values(editorRefs.current).forEach(editor => editor?.destroy())
      editorRefs.current = {}
    }
  }, [])

  const currentHasSyntaxError = currentSql && hasSyntaxError(currentSql)
  const currentRules = currentSql?.rule_infos || currentSql?.rule_results || []

  // 保存容器引用
  const setContainerRef = useCallback((index: number, el: HTMLDivElement | null) => {
    containerRefs.current[index] = el
  }, [])

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content modal-xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h4>SQL分析结果</h4>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>

        <div className="analysis-layout">
          {/* 左侧：SQL列表 */}
          <div className="analysis-left">
            <div className="panel-title">SQL语句</div>
            <div className="sql-tabs">
              {sqlList.map((sql, index) => (
                <button
                  key={index}
                  className={`sql-tab ${activeTab === index ? 'active' : ''} ${hasSyntaxError(sql) ? 'has-error' : ''}`}
                  onClick={() => setActiveTab(index)}
                >
                  SQL {index + 1}
                  {hasSyntaxError(sql) && <span className="error-icon">⚠</span>}
                </button>
              ))}
            </div>
            {/* 为每个 SQL 创建独立的编辑器容器 */}
            {sqlList.map((sql, index) => (
              <div 
                key={index}
                className={`sql-editor-box ${hasSyntaxError(sql) ? 'has-error' : ''}`}
                style={{ display: activeTab === index ? 'block' : 'none' }}
                ref={el => setContainerRef(index, el)}
              />
            ))}
          </div>

          {/* 右侧：分析结果 */}
          <div className="analysis-right">
            {currentHasSyntaxError ? (
              <SyntaxErrorPanel sql={currentSql!} />
            ) : (
              <>
                <div className="result-tabs">
                  <button 
                    className={`tab-btn ${activeResultTab === 'analysis' ? 'active' : ''}`}
                    onClick={() => setActiveResultTab('analysis')}
                  >
                    分析结果
                  </button>
                  <button 
                    className={`tab-btn ${activeResultTab === 'rules' ? 'active' : ''}`}
                    onClick={() => setActiveResultTab('rules')}
                  >
                    关联规则
                  </button>
                </div>

                <div className="result-content">
                  {activeResultTab === 'analysis' ? (
                    <AnalysisContent sql={currentSql} />
                  ) : (
                    <RulesContent rules={currentRules} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-default" onClick={onCancel}>
            {mode === 'view' ? '关闭' : '取消'}
          </button>
          {mode === 'create' && onConfirm && (
            <button 
              className="btn btn-primary" 
              onClick={onConfirm}
              disabled={hasBlocker || submitting}
            >
              {hasBlocker ? '存在阻断，无法提交' : submitting ? '提交中...' : '确认提交'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default SqlAnalysisDialog
