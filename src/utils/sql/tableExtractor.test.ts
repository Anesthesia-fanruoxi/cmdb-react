/**
 * SQL 真实源表名提取测试
 * 覆盖 extractSourceTables：别名、子查询、CTE、函数 FROM 过滤等场景
 */

import { describe, it, expect } from 'vitest';
import { extractSourceTables } from './tableExtractor';

describe('extractSourceTables', () => {
  it('提取单表', () => {
    expect(extractSourceTables('EXPLAIN SELECT * FROM sys_order')).toEqual(['sys_order']);
  });

  it('JOIN 多表带别名时返回真实表名并按出现顺序去重', () => {
    const sql = [
      'EXPLAIN SELECT p.plan_no, d.paid_amount',
      'FROM sys_credit_repayment_plan p',
      'LEFT JOIN sys_credit_repayment_detail d ON p.id = d.plan_id',
      'LEFT JOIN sys_credit_repayment_plan p1 ON p1.id = d.next_plan_id',
      'WHERE p.status = 1',
    ].join('\n');
    expect(extractSourceTables(sql)).toEqual([
      'sys_credit_repayment_plan',
      'sys_credit_repayment_detail',
    ]);
  });

  it('忽略字符串字面量与注释中的 FROM / JOIN', () => {
    const sql = "EXPLAIN SELECT * FROM t1 WHERE note = 'join fake from x' -- from zz";
    expect(extractSourceTables(sql)).toEqual(['t1']);
  });

  it('过滤 EXTRACT / TRIM 等函数内的 FROM', () => {
    const sql = "EXPLAIN SELECT EXTRACT(YEAR FROM create_time) AS y, TRIM(BOTH ',' FROM name) AS n FROM t1";
    expect(extractSourceTables(sql)).toEqual(['t1']);
  });

  it('支持子查询并跳过派生表本身', () => {
    const sql = 'EXPLAIN SELECT * FROM (SELECT * FROM inner_t WHERE id > 0) x JOIN t2 ON x.id = t2.id';
    expect(extractSourceTables(sql)).toEqual(['inner_t', 't2']);
  });

  it('过滤 CTE 名称，保留 CTE 内部真实表', () => {
    const sql = 'EXPLAIN WITH cte AS (SELECT * FROM base_t) SELECT * FROM cte JOIN t2 ON cte.id = t2.id';
    expect(extractSourceTables(sql)).toEqual(['base_t', 't2']);
  });

  it('支持逗号连缀多表与 USING 连接', () => {
    const sql = 'EXPLAIN SELECT * FROM t1 a, t2 b JOIN t3 USING (id)';
    expect(extractSourceTables(sql)).toEqual(['t1', 't2', 't3']);
  });

  it('忽略 DUAL 与尾部多余分号', () => {
    expect(extractSourceTables('EXPLAIN SELECT 1 FROM DUAL;')).toEqual([]);
  });

  it('保留跨库限定表名', () => {
    const sql = 'EXPLAIN SELECT * FROM db1.t1 JOIN db2.t2 ON db1.t1.id = db2.t2.id';
    expect(extractSourceTables(sql)).toEqual(['db1.t1', 'db2.t2']);
  });
});
