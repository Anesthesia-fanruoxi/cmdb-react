/**
 * 自定义渲染器
 * 用于 Ace 编辑器的自动补全列表渲染和文档提示
 */

import type { Suggestion } from './types'

/** 根据类型获取图标字符 */
export function getIconForType(meta: string): string {
  switch (meta) {
    case 'keyword':
      return '⚡' // 关键字 - 闪电
    case 'function':
      return 'ƒ' // 函数
    case 'table':
      return '📋' // 表
    case 'field':
      return '●' // 字段
    case 'alias':
      return '§' // 别名
    default:
      return '•'
  }
}

/** 根据类型获取中文描述 */
export function getTypeLabel(meta: string): string {
  switch (meta) {
    case 'keyword':
      return '关键字'
    case 'function':
      return '函数'
    case 'table':
      return '表'
    case 'field':
      return '字段'
    case 'alias':
      return '别名'
    default:
      return meta || '项'
  }
}

/** 根据类型获取图标颜色 */
export function getColorForType(meta: string): string {
  switch (meta) {
    case 'keyword':
      return '#569CD6' // 蓝色
    case 'function':
      return '#DCDCAA' // 黄色
    case 'table':
      return '#4EC9B0' // 青色
    case 'field':
      return '#9CDCFE' // 浅蓝色
    case 'alias':
      return '#C586C0' // 紫色
    default:
      return '#808080'
  }
}

/** 创建自定义渲染器（图标 + 名称 + 类型） */
export function createCustomRenderer() {
  console.log('✅ 自定义渲染器已创建')
  return function(item: Suggestion, str: string) {
    console.log('🎨 渲染项:', { caption: item.caption, meta: item.meta, str, dbName: (item as any).dbName })
    
    const el = document.createElement('div')
    el.className = 'ace_autocomplete_item'
    
    // 图标
    const iconEl = document.createElement('span')
    iconEl.className = 'ace_autocomplete_icon'
    iconEl.textContent = getIconForType(item.meta || '')
    iconEl.style.backgroundColor = getColorForType(item.meta || '')
    el.appendChild(iconEl)
    
    // 字段名/表名
    const nameEl = document.createElement('span')
    nameEl.textContent = str
    nameEl.style.flex = '1'
    nameEl.style.overflow = 'hidden'
    nameEl.style.textOverflow = 'ellipsis'
    el.appendChild(nameEl)
    
    // 类型标签 (如果没显示在控件的右侧,这里也可以作为一种补充显示)
    // 但为了保持 UI 简洁,我们主要靠 SqlEditor.tsx 在右侧显示中文标签和库信息
    
    return el
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
