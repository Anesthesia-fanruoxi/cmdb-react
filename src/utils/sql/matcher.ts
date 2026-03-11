/**
 * 匹配器
 * 提供模糊匹配、去重、排序功能
 */

import type { MatchResult, Suggestion } from './types'

/**
 * 模糊匹配函数 - 支持首字母匹配、包含匹配、驼峰匹配
 */
export function fuzzyMatch(query: string, target: string): MatchResult {
  // 空查询或空目标不匹配
  if (!query || !target) return { match: false, score: 0 }
  
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
  const parts = t.split(/[_\-\s]+/)
  const initials = parts.map(p => p[0]).join('')
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
