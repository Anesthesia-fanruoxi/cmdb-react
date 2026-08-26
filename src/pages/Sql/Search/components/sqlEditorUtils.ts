/**
 * SQL 编辑器工具函数
 */

import ace from 'ace-builds'
import { format } from 'sql-formatter'
import { message } from 'antd'

/**
 * Ace 默认 SQL 关键字不含 EXPLAIN/SHOW 等，补全后高亮才生效。
 * 须在 import mode-sql 之后、setMode 之前调用。
 */
export function ensureAceSqlKeywordsPatched() {
  const modeMod = ace.require('ace/mode/sql') as { Mode: new () => unknown; __cmdbSqlKwPatched?: boolean }
  if (modeMod.__cmdbSqlKwPatched) return
  modeMod.__cmdbSqlKwPatched = true

  const rulesMod = ace.require('ace/mode/sql_highlight_rules') as {
    SqlHighlightRules: new () => unknown
  }
  const oop = ace.require('ace/lib/oop') as {
    inherits: (ctor: unknown, superCtor: unknown) => void
  }
  const TextHighlightRules = ace.require('ace/mode/text_highlight_rules').TextHighlightRules

  // Ace 原词表 + MySQL 常用缺失项（explain 为首要修复）
  const keywords =
    'select|insert|update|delete|from|where|and|or|group|by|order|limit|offset|having|as|case|' +
    'when|then|else|end|type|left|right|join|on|outer|desc|asc|union|create|table|primary|key|if|' +
    'foreign|not|references|default|null|inner|cross|natural|database|drop|grant|distinct|is|in|' +
    'all|alter|any|array|at|authorization|between|both|cast|check|collate|column|commit|constraint|' +
    'cube|current|current_date|current_time|current_timestamp|current_user|describe|escape|except|' +
    'exists|external|extract|fetch|filter|for|full|function|global|grouping|intersect|interval|' +
    'into|leading|like|local|no|of|only|out|overlaps|partition|position|range|revoke|rollback|rollup|' +
    'row|rows|session_user|set|some|start|tablesample|time|to|trailing|truncate|unique|unknown|' +
    'user|using|values|window|with|' +
    'explain|show|analyze|replace|call|use|optimize'
  const builtinConstants = 'true|false'
  const builtinFunctions =
    'avg|count|first|last|max|min|sum|ucase|lcase|mid|len|round|rank|now|format|' +
    'coalesce|ifnull|isnull|nvl'
  const dataTypes =
    'int|numeric|decimal|date|varchar|char|bigint|float|double|bit|binary|text|set|timestamp|' +
    'money|real|number|integer|string'

  function CmdbSqlHighlightRules(this: {
    createKeywordMapper: (
      map: Record<string, string>,
      defaultToken: string,
      ignoreCase?: boolean
    ) => unknown
    $rules: Record<string, unknown[]>
    normalizeRules: () => void
  }) {
    const keywordMapper = this.createKeywordMapper(
      {
        'support.function': builtinFunctions,
        keyword: keywords,
        'constant.language': builtinConstants,
        'storage.type': dataTypes,
      },
      'identifier',
      true
    )
    this.$rules = {
      start: [
        { token: 'comment', regex: '--.*$' },
        { token: 'comment', start: '/\\*', end: '\\*/' },
        { token: 'string', regex: '".*?"' },
        { token: 'string', regex: "'.*?'" },
        { token: 'string', regex: '`.*?`' },
        {
          token: 'constant.numeric',
          regex: '[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?\\b',
        },
        { token: keywordMapper, regex: '[a-zA-Z_$][a-zA-Z0-9_$]*\\b' },
        {
          token: 'keyword.operator',
          regex: '\\+|\\-|\\/|\\/\\/|%|<@>|@>|<@|&|\\^|~|<|>|<=|=>|==|!=|<>|=',
        },
        { token: 'paren.lparen', regex: '[\\(]' },
        { token: 'paren.rparen', regex: '[\\)]' },
        { token: 'text', regex: '\\s+' },
      ],
    }
    this.normalizeRules()
  }

  oop.inherits(CmdbSqlHighlightRules, TextHighlightRules)
  rulesMod.SqlHighlightRules = CmdbSqlHighlightRules as unknown as typeof rulesMod.SqlHighlightRules

  const OrigMode = modeMod.Mode
  function Mode(this: { HighlightRules: unknown }) {
    OrigMode.call(this)
    this.HighlightRules = CmdbSqlHighlightRules
  }
  oop.inherits(Mode, OrigMode)
  modeMod.Mode = Mode as unknown as typeof modeMod.Mode
}

/** 精简 sql-formatter 解析报错：去掉海量期望 token 语法列表与 token JSON 详情 */
function summarizeFormatError(error: unknown): string {
  const raw = String((error as any)?.message || error || '未知错误')
  // 只保留 "Instead, I was expecting..." 之前的核心报错
  let core = raw.split(/instead,?\s+i\s+was\s+expecting/i)[0].trim()
  // 去掉 token 的 JSON 详情，如 token: {"type":"CLOSE_PAREN",...}.
  core = core.replace(/\s*token:\s*\{[^}]*\}\.?\s*/i, ' token ')
  core = core.replace(/\s{2,}/g, ' ').trim()
  if (!core) core = 'SQL 语法错误'
  if (core.length > 160) core = `${core.slice(0, 160)}…`
  return core
}

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
    message.error(`SQL格式化失败: ${summarizeFormatError(error)}`)
  }
}

/** 创建点号处理器，用于 table.field 补全 - 与 Vue 版本对齐 */
export function createDotHandler(editor: ace.Ace.Editor) {
  editor.commands.addCommand({
    name: 'dotAndComplete',
    bindKey: { win: '.', mac: '.' },
    exec: (ed) => {
      // The completer parses the current statement and resolves table aliases.
      ed.insert('.')
      setTimeout(() => {
        ed.execCommand('startAutocomplete')
      }, 50)

      return true
    }
  })
}
