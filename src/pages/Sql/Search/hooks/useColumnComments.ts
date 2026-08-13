/**
 * useColumnComments
 * 查询执行后，根据 SQL 中涉及的表名获取字段备注
 * 支持 db.table 跨库限定名；优先读取本地元数据缓存，未命中再走 API
 * 返回 Map<列名小写, 备注>，同名列取 SQL 中第一张表的备注
 */

import { useState, useEffect, useRef } from 'react';
import { getTableStructure } from '../../../../services/sql/search';
import { getTableFields } from '../../../../utils/sql/cache';

export type CommentMap = Map<string, string>;

interface TableRef {
  db?: string;
  table: string;
}

/** 提取 SQL 中涉及的表引用（支持 FROM / JOIN 与 db.table 限定名） */
function extractTableRefs(sql: string): TableRef[] {
  const refs: TableRef[] = [];
  const seen = new Set<string>();

  const addRef = (raw: string) => {
    const clean = raw.replace(/\.$/, '');
    if (!clean) return;
    const idx = clean.lastIndexOf('.');
    const db = idx > 0 ? clean.slice(0, idx) : undefined;
    const table = idx > 0 ? clean.slice(idx + 1) : clean;
    if (!table) return;
    const key = `${(db || '').toLowerCase()}.${table.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push({ db, table });
  };

  let m: RegExpExecArray | null;

  const fromRegex = /\bFROM\s+([\w.]+)/gi;
  while ((m = fromRegex.exec(sql)) !== null) addRef(m[1]);

  const joinRegex = /\bJOIN\s+([\w.]+)/gi;
  while ((m = joinRegex.exec(sql)) !== null) addRef(m[1]);

  return refs;
}

/** 优先从本地元数据缓存读取字段注释（字段 comment 格式为 `[表名] 注释`） */
function getCachedComments(ref: TableRef, currentDb: string): Map<string, string> | null {
  const fields = getTableFields(ref.table, ref.db);
  if (!fields || fields.length === 0) return null;

  // 裸表名时校验缓存归属库，避免跨库同名表串注释
  if (!ref.db) {
    const owner = fields[0]?.dbName;
    if (owner && owner.toLowerCase() !== currentDb.toLowerCase()) return null;
  }

  const m = new Map<string, string>();
  fields.forEach(f => {
    const comment = (f.comment || '').replace(/^\[[^\]]*\]\s*/, '').trim();
    const fieldName = (f.caption || '').toLowerCase();
    if (fieldName && comment) m.set(fieldName, comment);
  });
  return m.size > 0 ? m : null;
}

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

    const allTables = extractTableRefs(sql);
    if (allTables.length === 0) return;

    let cancelled = false;

    (async () => {
      const map = new Map<string, string>();

      const merge = (entries: Map<string, string>) => {
        entries.forEach((comment, fieldName) => {
          // 已有的不覆盖，保持主表优先
          if (!map.has(fieldName)) map.set(fieldName, comment);
        });
      };

      // 按 SQL 表顺序处理，先到的表优先
      for (const ref of allTables) {
        if (cancelled) break;

        // 1. 优先读本地元数据缓存（按 db.table 分类写入）
        const cached = getCachedComments(ref, dbName);
        if (cached) {
          merge(cached);
          continue;
        }

        // 2. 缓存未命中，回退 API 查询（跨库表使用 SQL 中携带的库名）
        try {
          const res = await getTableStructure({ agent, dbName: ref.db || dbName, tbName: ref.table });
          if (cancelled) break;
          if (res.code === 200 && res.data?.columns) {
            const fetched = new Map<string, string>();
            res.data.columns.forEach((col: any) => {
              const fieldName = (col.field || col.name || '').toLowerCase();
              const comment = (col.comment || '').trim();
              if (fieldName && comment) fetched.set(fieldName, comment);
            });
            merge(fetched);
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
