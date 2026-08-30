/** 格式化为本地 `YYYY-MM-DD HH:mm:ss` */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatSyncDateTime(d: Date): string {
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 本周一起点（周一 00:00） */
function startOfWeekMonday(d: Date): Date {
  const day = startOfDay(d);
  const wd = day.getDay(); // 0=日 … 6=六
  const offset = wd === 0 ? 6 : wd - 1;
  day.setDate(day.getDate() - offset);
  return day;
}

export type CompareQuickRangeKey =
  | 'today'
  | 'yesterday'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisWeek'
  | 'lastWeek';

export const COMPARE_QUICK_RANGES: {
  key: CompareQuickRangeKey;
  label: string;
}[] = [
  { key: 'today', label: '今天' },
  { key: 'yesterday', label: '昨天' },
  { key: 'thisWeek', label: '本周' },
  { key: 'lastWeek', label: '上周' },
  { key: 'thisMonth', label: '本月' },
  { key: 'lastMonth', label: '上月' },
];

/** 半开区间 [start, end) */
export function getCompareQuickRange(
  key: CompareQuickRangeKey,
  now = new Date(),
): { start: string; end: string } {
  const today = startOfDay(now);

  if (key === 'today') {
    // [今日 00:00, 当前整点) —— 截止到「上一个完整小时」的结束边界（非整点减 1 小时）
    const start = today;
    const end = new Date(now);
    end.setMinutes(0, 0, 0);
    if (end.getTime() <= start.getTime()) {
      // 当天 0 点后尚未跨过整点：退到当前时刻，避免空区间
      return { start: formatSyncDateTime(start), end: formatSyncDateTime(now) };
    }
    return { start: formatSyncDateTime(start), end: formatSyncDateTime(end) };
  }

  if (key === 'yesterday') {
    const start = new Date(today);
    start.setDate(start.getDate() - 1);
    return { start: formatSyncDateTime(start), end: formatSyncDateTime(today) };
  }

  if (key === 'thisWeek') {
    // [本周一 00:00, 今天 00:00)
    const start = startOfWeekMonday(today);
    return { start: formatSyncDateTime(start), end: formatSyncDateTime(today) };
  }

  if (key === 'lastWeek') {
    const thisMon = startOfWeekMonday(today);
    const start = new Date(thisMon);
    start.setDate(start.getDate() - 7);
    return { start: formatSyncDateTime(start), end: formatSyncDateTime(thisMon) };
  }

  if (key === 'thisMonth') {
    // [本月 1 日 00:00, 今天 00:00)
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: formatSyncDateTime(start), end: formatSyncDateTime(today) };
  }

  // lastMonth
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 1);
  return { start: formatSyncDateTime(start), end: formatSyncDateTime(end) };
}
