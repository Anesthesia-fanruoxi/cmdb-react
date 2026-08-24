/**
 * 查询结果复制格式化：数据 / INSERT 语句
 */

/** SQL 字符串转义：反斜杠与单引号 */
const escapeSqlString = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/'/g, "''");

/**
 * 智能推断值格式：
 * - null/undefined → NULL
 * - number → 原样（不加引号）
 * - boolean → 1/0
 * - object → JSON 字符串（加引号）
 * - string → 加引号并转义（即使是数字形态也保持字符串，避免前导零丢失）
 */
export const formatSqlValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'object') return `'${escapeSqlString(JSON.stringify(value))}'`;
  return `'${escapeSqlString(String(value))}'`;
};

/** 列名加反引号 */
const quoteColumn = (col: string): string => `\`${col.replace(/`/g, '``')}\``;

/**
 * 生成 INSERT 语句（每行一条）
 */
export function buildInsertStatements(tableName: string, columns: string[], rows: unknown[][]): string {
  const cols = columns.map(quoteColumn).join(', ');
  return rows.map(row => {
    const values = columns.map((_, i) => formatSqlValue(row[i])).join(', ');
    return `INSERT INTO ${tableName} (${cols}) VALUES (${values});`;
  }).join('\n');
}

const cleanIdentifier = (s: string): string => s.replace(/[`"[\]]/g, '');

/**
 * 从 SQL 中解析表名（支持 db.table）
 * 依次尝试 FROM / INSERT INTO / UPDATE，取第一个命中
 */
export function extractTableNameFromSql(sql: string): string {
  if (!sql) return '';
  const patterns = [
    /\bFROM\s+([`"[\w$.\]]+)/i,
    /\bINSERT\s+(?:IGNORE\s+)?INTO\s+([`"[\w$.\]]+)/i,
    /\bUPDATE\s+([`"[\w$.\]]+)/i
  ];
  for (const re of patterns) {
    const m = sql.match(re);
    if (m) return cleanIdentifier(m[1]);
  }
  return '';
}
