/**
 * useColumnComments
 * 查询执行后，根据 SQL 中涉及的表名获取字段备注
 * 返回 Map<列名小写, 备注>，同名列取 SQL 中第一张表的备注
 */

import { useState, useEffect, useRef } from 'react';
import { extractAllTablesFromSql } from '../../../../utils/sql/tableExtractor';
import { getTableStructure } from '../../../../services/sql/search';

export type CommentMap = Map<string, string>;

export function useColumnComments(
  sql: string,
  agent: string,
  dbName: string,
  queryId: string
): CommentMap {
  const [commentMap, setCommentMap] = useState<CommentMap>(new Map());
  const prevQueryId = useRef('');

  useEffect(() => {
    if (!queryId || queryId === prevQueryId.current) return;
    if (!sql.trim() || !agent || !dbName) return;

    prevQueryId.current = queryId;

    const fromTables = extractAllTablesFromSql(sql).map(t => t.name);
    const joinRegex = /\bJOIN\s+(\w+)\b/gi;
    let m: RegExpExecArray | null;
    const joinTables: string[] = [];
    while ((m = joinRegex.exec(sql)) !== null) joinTables.push(m[1]);
    const allTables = [...new Set([...fromTables, ...joinTables])];

    if (allTables.length === 0) return;

    let cancelled = false;

    (async () => {
      const map = new Map<string, string>();

      // 按 SQL 表顺序串行，先到的表优先
      for (const tableName of allTables) {
        if (cancelled) break;
        try {
          const res = await getTableStructure({ agent, dbName, tbName: tableName });
          if (cancelled) break;
          if (res.code === 200 && res.data?.columns) {
            res.data.columns.forEach((col: any) => {
              const fieldName = (col.field || col.name || '').toLowerCase();
              const comment = (col.comment || '').trim();
              // 已有的不覆盖，保持主表优先
              if (fieldName && comment && !map.has(fieldName)) {
                map.set(fieldName, comment);
              }
            });
          }
        } catch {
          // 单张表失败不影响其他
        }
      }

      if (!cancelled) setCommentMap(map);
    })();

    return () => { cancelled = true; };
  }, [queryId, sql, agent, dbName]);

  return commentMap;
}
