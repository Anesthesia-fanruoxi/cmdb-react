/**
 * 日期时间工具函数
 * 统一使用上海时区（UTC+8）
 */

/**
 * 获取当前时间（上海时区）
 */
export function getNow(): Date {
  return new Date();
}

/**
 * 格式化日期时间为 yymmddhhmmss
 * @param date 日期对象，默认为当前时间
 * @returns 格式化后的字符串，如 260120154237
 */
export function formatDateTime(date: Date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  
  return `${yy}${mm}${dd}${hh}${min}${ss}`;
}

/**
 * 格式化日期为 yyyy-mm-dd
 * @param date 日期对象，默认为当前时间
 * @returns 格式化后的字符串，如 2026-01-20
 */
export function formatDate(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 格式化日期时间为 yyyy-mm-dd hh:mm:ss
 * @param date 日期对象，默认为当前时间
 * @returns 格式化后的字符串，如 2026-01-20 15:42:37
 */
export function formatFullDateTime(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

/**
 * 格式化日期时间为 ISO 格式（本地时区）
 * @param date 日期对象，默认为当前时间
 * @returns 格式化后的字符串，如 2026-01-20T15:42:37+08:00
 */
export function formatISODateTime(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  
  // 获取时区偏移（分钟）
  const offset = -date.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offset) / 60);
  const offsetMinutes = Math.abs(offset) % 60;
  const offsetSign = offset >= 0 ? '+' : '-';
  const offsetStr = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
  
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}${offsetStr}`;
}

/**
 * 格式化时间戳为标准日期时间
 * @param timestamp 时间戳（毫秒）
 * @returns 格式化后的字符串，如 2026-01-20 15:42:37，如果时间戳无效则返回 '-'
 */
export function formatTimestamp(timestamp?: number): string {
  if (!timestamp) return '-';
  return formatFullDateTime(new Date(timestamp));
}

/**
 * 格式化毫秒耗时为分秒格式
 * @param milliseconds 毫秒数
 * @returns 格式化后的字符串，如 "3分12秒"，如果耗时无效则返回 '-'
 */
export function formatDuration(milliseconds?: number): string {
  if (!milliseconds || milliseconds < 0) return '-';
  
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  if (minutes > 0) {
    return `${minutes}分${seconds}秒`;
  }
  return `${seconds}秒`;
}

/**
 * 计算距离现在的时间差（相对时间）
 * @param timestamp 时间戳（毫秒）
 * @returns 格式化后的相对时间字符串，如 "刚刚"、"5分钟前"、"2小时前"、"3天前"
 */
export function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return '-';
  
  const now = Date.now();
  const diff = now - timestamp;
  
  // 如果是未来时间
  if (diff < 0) return '未来';
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  
  if (seconds < 60) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  if (months < 12) return `${months}个月前`;
  return `${years}年前`;
}
