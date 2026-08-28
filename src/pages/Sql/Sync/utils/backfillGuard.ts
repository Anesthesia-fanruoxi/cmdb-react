/** 解析补全/对比时间：支持 `YYYY-MM-DD HH:mm:ss` / ISO */
export function parseSyncDateTime(raw: string): Date | null {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (m) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4] || 0),
      Number(m[5] || 0),
      Number(m[6] || 0),
    );
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 区间上限：结束时间不超过开始时间 + 1 个自然月（补全/对比共用） */
export function isRangeWithinOneMonth(start: Date, end: Date): boolean {
  if (end.getTime() < start.getTime()) return false;
  const limit = new Date(start.getTime());
  limit.setMonth(limit.getMonth() + 1);
  return end.getTime() <= limit.getTime();
}

/** @deprecated 使用 isRangeWithinOneMonth */
export const isBackfillWithinOneMonth = isRangeWithinOneMonth;
