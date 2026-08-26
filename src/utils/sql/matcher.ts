/**
 * 匹配器
 * 提供模糊匹配、去重、排序功能
 */

import type { MatchResult, Suggestion } from './types'

/**
 * 连拼关键字匹配（LEFT JOIN 等）
 * 只允许从前端词开始匹配，不因后半段（JOIN）或词中字符误匹配
 * 允许：left / leftj / leftjoin / left j / lj
 * 不允许：j / join / i（RIGHT 中的 i）单独命中 LEFT JOIN / RIGHT JOIN
 */
export function matchCompoundKeyword(query: string, phrase: string): MatchResult {
  if (!query || !phrase) return { match: false, score: 0 }

  const q = query.toLowerCase()
  const words = phrase.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { match: false, score: 0 }

  const phraseLower = words.join(' ')
  const compact = words.join('')
  const qCompact = q.replace(/\s+/g, '')

  // 1. 完整短语前缀（含空格）："left" / "left " / "left j"
  if (phraseLower.startsWith(q) || `${phraseLower} `.startsWith(q)) {
    return { match: true, score: 200 - Math.min(phraseLower.length, 50) }
  }

  // 2. 去空格连拼前缀：leftj / leftjoin
  if (qCompact && compact.startsWith(qCompact)) {
    return { match: true, score: 195 - Math.min(compact.length, 50) }
  }

  // 3. 按词递进前缀：必须从第一个词开始
  const qParts = q.split(/\s+/).filter(Boolean)
  if (qParts.length > 0 && qParts.length <= words.length) {
    let ok = true
    for (let i = 0; i < qParts.length; i++) {
      if (!words[i].startsWith(qParts[i])) {
        ok = false
        break
      }
    }
    if (ok) {
      return { match: true, score: 190 - Math.min(qParts.length, 20) }
    }
  }

  // 4. 各词首字母前缀：lj → LEFT JOIN（必须从头匹配，j 单独不能命中）
  const initials = words.map(w => w[0] || '').join('')
  if (qCompact && initials.startsWith(qCompact)) {
    return { match: true, score: 75 }
  }

  return { match: false, score: 0 }
}

/**
 * 模糊匹配函数 - 支持首字母匹配、包含匹配、驼峰匹配
 * 多词目标走连拼规则，避免后半段/词中字符误匹配
 */
export function fuzzyMatch(query: string, target: string): MatchResult {
  // 空查询或空目标不匹配
  if (!query || !target) return { match: false, score: 0 }

  // 连拼短语：只做前置匹配
  if (/\s/.test(target)) {
    return matchCompoundKeyword(query, target)
  }
  
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  
  // 完全匹配前缀 - 最高分
  if (t.startsWith(q)) {
    return { match: true, score: 200 - Math.min(t.length, 50) }
  }
  
  // 包含匹配 - 位置越靠前分数越高
  const includeIndex = t.indexOf(q)
  if (includeIndex !== -1) {
    return { match: true, score: 100 - Math.min(includeIndex, 50) }
  }
  
  // 首字母匹配（如 "ct" 匹配 "created_time"）
  const parts = t.split(/[_\-]+/)
  const initials = parts.map(p => p[0]).join('')
  if (initials.startsWith(q)) {
    return { match: true, score: 75 }
  }
  if (initials.includes(q)) {
    return { match: true, score: 70 }
  }
  
  // 驼峰匹配（如 "cT" 匹配 "createdTime"）
  const camelParts = target.split(/(?=[A-Z])/)
  const camelInitials = camelParts.map(p => p[0]?.toLowerCase()).join('')
  if (camelInitials.includes(q)) {
    return { match: true, score: 60 }
  }
  
  // 字符顺序匹配 - 匹配越紧凑分数越高
  let qi = 0
  let firstMatchPos = -1
  let lastMatchPos = -1
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      if (firstMatchPos === -1) firstMatchPos = i
      lastMatchPos = i
      qi++
    }
  }
  if (qi === q.length) {
    const span = lastMatchPos - firstMatchPos + 1
    return { match: true, score: 50 - Math.min(span - q.length, 30) }
  }
  
  return { match: false, score: 0 }
}

/**
 * 对建议列表进行去重处理
 */
export function deduplicateSuggestions(suggestions: Suggestion[]): Suggestion[] {
  if (!Array.isArray(suggestions)) return []
  
  const uniqueMap = new Map<string, Suggestion>()
  
  suggestions.forEach(suggestion => {
    if (suggestion.meta && suggestion.meta.toLowerCase().includes('field')) {
      const key = `${suggestion.caption.toLowerCase()}|${suggestion.meta}`
      if (!uniqueMap.has(key) || suggestion.score > uniqueMap.get(key)!.score) {
        uniqueMap.set(key, suggestion)
      }
    } else {
      const key = suggestion.caption.toLowerCase()
      if (!uniqueMap.has(key) || suggestion.score > uniqueMap.get(key)!.score) {
        uniqueMap.set(key, suggestion)
      }
    }
  })
  
  // 先按分数降序，同分按字母升序
  return Array.from(uniqueMap.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.caption.localeCompare(b.caption)
    })
}
