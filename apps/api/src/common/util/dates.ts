export const minutes = (n: number): number => n * 60 * 1000;
export const hours = (n: number): number => minutes(n * 60);
export const days = (n: number): number => hours(n * 24);
export const addMs = (date: Date, ms: number): Date => new Date(date.getTime() + ms);
export const iso = (date: Date | null | undefined): string | null =>
  date ? date.toISOString() : null;

// ---------- calendar dates ----------
// A calendar date is an ISO string ("2026-10-10") in the society's time zone, so date maths
// below needs no clock or time zone.

export interface Ymd {
  y: number;
  m: number;
  d: number;
}

export const pad2 = (n: number): string => String(n).padStart(2, '0');
export const ymd = (s: string): Ymd => {
  const [y, m, d] = s.split('-').map(Number);
  return { y: y ?? 0, m: m ?? 1, d: d ?? 1 };
};
export const fmt = ({ y, m, d }: Ymd): string => `${y}-${pad2(m)}-${pad2(d)}`;
export const daysInMonth = (y: number, m: number): number =>
  new Date(Date.UTC(y, m, 0)).getUTCDate();

export function addDays(date: string, n: number): string {
  const { y, m, d } = ymd(date);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return fmt({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
}

export function diffDays(a: string, b: string): number {
  const A = ymd(a);
  const B = ymd(b);
  return Math.round((Date.UTC(A.y, A.m - 1, A.d) - Date.UTC(B.y, B.m - 1, B.d)) / 86_400_000);
}

/** Today's date in a time zone, as YYYY-MM-DD. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** "2026-27" for a date, given the month the financial year starts (4 = April). */
export function fyLabel(date: string, fyStartMonth: number): string {
  const { y, m } = ymd(date);
  const start = m >= fyStartMonth ? y : y - 1;
  return fyStartMonth === 1 ? String(start) : `${start}-${pad2((start + 1) % 100)}`;
}

/** Prisma @db.Date values come back as UTC midnight. */
export const dateOnly = (d: Date): string => d.toISOString().slice(0, 10);
export const dbDate = (s: string): Date => new Date(`${s}T00:00:00Z`);
