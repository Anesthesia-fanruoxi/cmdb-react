/**
 * 自定义渲染器
 * 用于 Ace 编辑器的自动补全列表渲染和文档提示
 */

import type { Suggestion } from './types'

/** 创建自定义渲染器（两列：名称 + 类型） */
export function createCustomRenderer() {
  return {
    renderItem: function(item: Suggestion, str: string, _prefix: string, parent: HTMLElement) {
      const el = parent.appendChild(document.createElement('div'))
      el.className = 'ace_autocomplete_item'
      
      // 字段名/表名容器
      const nameContainer = document.createElement('div')
      nameContainer.style.flexGrow = '1'
      nameContainer.style.overflow = 'hidden'
      nameContainer.style.textOverflow = 'ellipsis'
      nameContainer.style.whiteSpace = 'nowrap'
      
      const text = document.createTextNode(str)
      nameContainer.appendChild(text)
      el.appendChild(nameContainer)
      
      // 类型标签
      if (item.meta) {
        const typeEl = document.createElement('span')
        typeEl.className = 'ace_autocomplete_type'
        typeEl.textContent = item.meta
        el.appendChild(typeEl)
      }
      
      return el
    }
  }
}

/** 获取文档提示 HTML */
export function getDocTooltip(item: Suggestion): void {
  if (!item.caption) return
  
  // 提取表名
  const tableMatch = item.comment?.match(/\[([^\]]+)\]/)
  const tableName = item.tableName || (tableMatch ? tableMatch[1] : '')
  const commentText = item.comment?.replace(/\[[^\]]+\]\s*/, '') || ''
  
  let html = '<div class="doc-content">'
  
  // 字段名和类型
  html += '<div class="doc-header">'
  html += `<span class="doc-field-name">${item.caption}</span>`
  if (item.meta && item.meta !== 'keyword' && item.meta !== 'table') {
    html += `<code class="doc-type">${item.meta}</code>`
  }
  html += '</div>'
  
  // 表名
  if (tableName) {
    html += `<div class="doc-table"><span class="doc-label">表:</span> <span class="doc-value">${tableName}</span></div>`
  }
  
  // 注释
  if (commentText) {
    html += `<div class="doc-comment">${commentText}</div>`
  }
  
  // 主键标识
  if (item.isPrimaryKey) {
    html += '<div class="doc-badge">\u{1F511} 主键</div>'
  }
  
  html += '</div>'
  item.docHTML = html
}
