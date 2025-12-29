/**
 * SQL Search 工具函数测试
 */

import { describe, it, expect } from 'vitest';
import { processBigInt } from './processBigInt';
import { handleQueryData } from './handleQueryData';

describe('processBigInt', () => {
  it('应该返回 null 和 undefined 不变', () => {
    expect(processBigInt(null)).toBe(null);
    expect(processBigInt(undefined)).toBe(undefined);
  });

  it('应该保持安全整数不变', () => {
    expect(processBigInt(42)).toBe(42);
    expect(processBigInt(0)).toBe(0);
    expect(processBigInt(-100)).toBe(-100);
    expect(processBigInt(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('应该将超出安全范围的整数转换为字符串', () => {
    const bigInt = Number.MAX_SAFE_INTEGER + 1;
    expect(processBigInt(bigInt)).toBe(String(bigInt));
  });

  it('应该保持字符串不变', () => {
    expect(processBigInt('hello')).toBe('hello');
    expect(processBigInt('')).toBe('');
  });

  it('应该递归处理数组', () => {
    const input = [1, Number.MAX_SAFE_INTEGER + 1, 'text'];
    const result = processBigInt(input) as unknown[];
    expect(result[0]).toBe(1);
    expect(typeof result[1]).toBe('string');
    expect(result[2]).toBe('text');
  });

  it('应该递归处理对象', () => {
    const bigInt = Number.MAX_SAFE_INTEGER + 1;
    const input = { id: bigInt, name: 'test', count: 10 };
    const result = processBigInt(input) as Record<string, unknown>;
    expect(typeof result.id).toBe('string');
    expect(result.name).toBe('test');
    expect(result.count).toBe(10);
  });

  it('应该处理嵌套结构', () => {
    const bigInt = Number.MAX_SAFE_INTEGER + 1;
    const input = {
      data: [{ id: bigInt, values: [1, bigInt] }]
    };
    const result = processBigInt(input) as Record<string, unknown>;
    const data = result.data as Record<string, unknown>[];
    expect(typeof data[0].id).toBe('string');
    const values = data[0].values as unknown[];
    expect(values[0]).toBe(1);
    expect(typeof values[1]).toBe('string');
  });
});

describe('handleQueryData', () => {
  it('应该处理单结果集响应', () => {
    const data = {
      rows: [[1, 'test'], [2, 'test2']],
      columns: ['id', 'name'],
      total: 2,
      took: 100,
      query_id: 'q1',
      db_name: 'testdb'
    };

    const result = handleQueryData(data, 'defaultdb', 'SELECT * FROM test');

    expect(result.allResults).toHaveLength(1);
    expect(result.allResults[0].data).toEqual([[1, 'test'], [2, 'test2']]);
    expect(result.allResults[0].columns).toEqual(['id', 'name']);
    expect(result.allResults[0].total).toBe(2);
    expect(result.allResults[0].took).toBe(100);
    expect(result.allResults[0].queryId).toBe('q1');
    expect(result.allResults[0].db_name).toBe('testdb');
    expect(result.queryResults).toEqual([[1, 'test'], [2, 'test2']]);
    expect(result.resultColumns).toEqual(['id', 'name']);
  });

  it('应该处理多结果集响应', () => {
    const data = {
      results: [
        { rows: [[1]], columns: ['id'], total: 1, took: 50, query_id: 'q1' },
        { rows: [[2]], columns: ['count'], total: 1, took: 30, query_id: 'q2' }
      ]
    };

    const result = handleQueryData(data, 'defaultdb', '');

    expect(result.allResults).toHaveLength(2);
    expect(result.allResults[0].name).toBe('结果集 1');
    expect(result.allResults[1].name).toBe('结果集 2');
    expect(result.queryResults).toEqual([[1]]);
    expect(result.resultColumns).toEqual(['id']);
  });

  it('应该处理空响应', () => {
    const data = {};

    const result = handleQueryData(data, 'defaultdb', 'SELECT 1');

    expect(result.allResults).toHaveLength(1);
    expect(result.allResults[0].data).toEqual([]);
    expect(result.allResults[0].columns).toEqual([]);
    expect(result.queryResults).toEqual([]);
  });

  it('应该使用默认数据库名', () => {
    const data = { rows: [[1]], columns: ['id'] };

    const result = handleQueryData(data, 'mydb', '');

    expect(result.allResults[0].db_name).toBe('mydb');
  });

  it('应该处理包含大整数的结果', () => {
    const bigInt = Number.MAX_SAFE_INTEGER + 1;
    const data = {
      rows: [[bigInt, 'test']],
      columns: ['id', 'name'],
      total: 1,
      took: 10
    };

    const result = handleQueryData(data, '', '');

    expect(typeof result.queryResults[0][0]).toBe('string');
    expect(result.queryResults[0][1]).toBe('test');
  });
});
