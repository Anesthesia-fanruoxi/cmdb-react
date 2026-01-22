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
