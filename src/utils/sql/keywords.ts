/**
 * SQL 关键词定义
 * 按子句类型分类
 */

// SQL关键词分类
export const SQL_KEYWORDS = {
  // 初始提示词（SQL语句起始词）
  INITIAL: [
    'SELECT', 'WITH', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TRUNCATE', 'SHOW'
  ],
  
  // SELECT子句后的提示词
  SELECT: [
    'DISTINCT', 'ALL', 'TOP', '*', 'AS', 'FROM'
  ],
  
  // FROM子句后的提示词
  FROM: [
    'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN'
  ],
  
  // WHERE子句后的提示词
  WHERE: [
    'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL', 'EXISTS', 'ALL', 'ANY'
  ],
  
  // JOIN子句后的提示词
  JOIN: [
    'ON', 'USING'
  ],
  
  // ORDER BY 子句后的提示词
  ORDER_BY: [
    'ASC', 'DESC', 'NULLS FIRST', 'NULLS LAST'
  ],
  
  // GROUP BY 子句后的提示词
  GROUP_BY: [
    'HAVING', 'ORDER BY', 'LIMIT'
  ],
  
  // 条件操作符
  OPERATORS: [
    '=', '<', '>', '<=', '>=', '<>', '!=', 'LIKE', 'IN', 'BETWEEN', 'IS'
  ],
  
  // 聚合函数
  FUNCTIONS: [
    'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'GROUP_CONCAT',
    'CONCAT', 'SUBSTRING', 'TRIM', 'UPPER', 'LOWER', 'DATE_FORMAT',
    'NOW', 'CURRENT_DATE', 'CURRENT_TIME', 'IFNULL', 'COALESCE',
    'CAST', 'CONVERT', 'CASE', 'IF', 'NULLIF',
    'ABS', 'CEIL', 'FLOOR', 'ROUND', 'MOD',
    'LENGTH', 'CHAR_LENGTH', 'LEFT', 'RIGHT', 'REPLACE', 'REVERSE',
    'DATE', 'TIME', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND',
    'DATE_ADD', 'DATE_SUB', 'DATEDIFF', 'TIMESTAMPDIFF'
  ],
  
  // 数据类型
  DATA_TYPES: [
    'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT',
    'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL',
    'CHAR', 'VARCHAR', 'TEXT', 'LONGTEXT', 'MEDIUMTEXT',
    'DATE', 'TIME', 'DATETIME', 'TIMESTAMP',
    'BOOLEAN', 'BOOL', 'BLOB', 'JSON'
  ]
} as const

// SQL 关键字列表（用于别名验证）
export const SQL_KEYWORDS_LIST = [
  'SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'HAVING', 'ORDER', 'LIMIT',
  'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'ON', 'AS', 'AND', 'OR',
  'IN', 'BETWEEN', 'LIKE', 'IS', 'NOT', 'NULL', 'UNION', 'ALL', 'CASE', 'WHEN',
  'THEN', 'ELSE', 'END', 'EXISTS', 'DISTINCT', 'SET', 'VALUES', 'INTO',
  'UPDATE', 'DELETE', 'INSERT', 'CREATE', 'DROP', 'ALTER', 'TRUNCATE',
  'INDEX', 'TABLE', 'DATABASE', 'VIEW', 'TRIGGER', 'PROCEDURE', 'FUNCTION'
]
