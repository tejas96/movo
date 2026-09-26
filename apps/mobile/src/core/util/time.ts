import { formatDate, formatDateTime, formatRelative, formatTime, intlTag } from '@movo/i18n';
import { currentLocale } from '../i18n';

export function relative(iso: string | null | undefined): string {
  if (!iso) return '';
  return formatRelative(iso, currentLocale());
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return formatDate(iso, currentLocale(), 'short');
}

export function mediumDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return formatDate(iso, currentLocale(), 'medium');
}

export function greetingKey(now = new Date()): 'morning' | 'afternoon' | 'evening' {
  const h = now.getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

const TZ = 'Asia/Kolkata';

/** "Sat, 3 Oct, 7:00 pm" */
export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return formatDateTime(iso, currentLocale(), TZ);
}

/** "Sat, 3 Oct, 7:00 pm – 8:00 pm", or both dates when it ends on another day. */
export function whenRange(startsAt: string, endsAt: string | null): string {
  const start = dateTime(startsAt);
  if (!endsAt) return start;
  const sameDay =
    formatDate(startsAt, currentLocale(), 'medium', TZ) ===
    formatDate(endsAt, currentLocale(), 'medium', TZ);
  return `${start} – ${sameDay ? formatTime(endsAt, currentLocale(), TZ) : dateTime(endsAt)}`;
}

/** "Sat, 7:00 pm – 8:00 pm", for rows that show the date in a DateBlock. */
export function timeRange(startsAt: string, endsAt: string | null): string {
  const locale = currentLocale();
  const weekday = new Intl.DateTimeFormat(intlTag(locale), {
    weekday: 'short',
    timeZone: TZ,
  }).format(new Date(startsAt));
  const start = `${weekday}, ${formatTime(startsAt, locale, TZ)}`;
  if (!endsAt) return start;
  const sameDay =
    formatDate(startsAt, locale, 'medium', TZ) === formatDate(endsAt, locale, 'medium', TZ);
  return `${start} – ${sameDay ? formatTime(endsAt, locale, TZ) : dateTime(endsAt)}`;
}

/** Day number and short month for a DateBlock. */
export function dayAndMonth(iso: string): { day: string; month: string } {
  const tag = intlTag(currentLocale());
  return {
    day: new Intl.DateTimeFormat(tag, { day: 'numeric', timeZone: TZ }).format(new Date(iso)),
    month: new Intl.DateTimeFormat(tag, { month: 'short', timeZone: TZ }).format(new Date(iso)),
  };
}

export function localeTag(): string {
  return intlTag(currentLocale());
}
