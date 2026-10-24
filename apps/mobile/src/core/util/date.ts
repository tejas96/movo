/**
 * Every date and time the app shows goes through this file (lint blocks raw `Intl` elsewhere;
 * Hermes on Android has no Intl.RelativeTimeFormat, so relative time comes from @movo/i18n).
 *
 * Time-zone policy, one rule for the whole app:
 * - An instant (an ISO timestamp such as 2026-10-03T13:30:00Z: meetings, events, orders,
 *   alerts, audit rows) is shown in the society's time zone. That is the active society's
 *   `timezone`, set by useActiveMembership through setSocietyTimeZone(); until it is known,
 *   Asia/Kolkata. The phone's own zone is never used to show an instant, so every member of a
 *   society sees the same day and time, wherever their phone is set.
 * - A calendar date (YYYY-MM-DD: due dates, bill dates, payment dates) has no zone and is shown
 *   as the date it is (formatted at UTC midnight, so it never shifts a day).
 * - Date pickers (DateTimeSheet) work on phone-local Date objects. isoDay() and fromIsoDay()
 *   convert between those and calendar dates with the phone's fields, so the day a person
 *   picks is the day that is saved.
 */
import {
  formatDate,
  formatDateTime,
  formatPeriod,
  formatRelative,
  formatTime,
  intlTag,
} from '@movo/i18n';
import { currentLocale } from '../i18n';

const FALLBACK_TIME_ZONE = 'Asia/Kolkata';
let societyTimeZone = FALLBACK_TIME_ZONE;

/** Called when the active society changes. An empty or unknown zone falls back to Asia/Kolkata. */
export function setSocietyTimeZone(timeZone: string | null | undefined): void {
  societyTimeZone = timeZone && isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE;
}

/** The zone instants are shown in (see the policy at the top). */
export function displayTimeZone(): string {
  return societyTimeZone;
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

/** BCP 47 tag of the app language, for pickers. */
export function localeTag(): string {
  return intlTag(currentLocale());
}

// ---- Instants (ISO timestamps), in the society's zone ----

/** "5 min ago", "in 2 d". No zone involved. */
export function relative(iso: string | null | undefined): string {
  if (!iso) return '';
  return formatRelative(iso, currentLocale());
}

/** "3 Oct" */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return formatDate(iso, currentLocale(), 'short', societyTimeZone);
}

/** "3 Oct 2026" */
export function mediumDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return formatDate(iso, currentLocale(), 'medium', societyTimeZone);
}

/** "Sat, 3 Oct, 7:00 pm" */
export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return formatDateTime(iso, currentLocale(), societyTimeZone);
}

function sameDay(a: string, b: string): boolean {
  const locale = currentLocale();
  return (
    formatDate(a, locale, 'medium', societyTimeZone) ===
    formatDate(b, locale, 'medium', societyTimeZone)
  );
}

/** "Sat, 3 Oct, 7:00 pm – 8:00 pm", or both dates when it ends on another day. */
export function whenRange(startsAt: string, endsAt: string | null): string {
  const start = dateTime(startsAt);
  if (!endsAt) return start;
  const end = sameDay(startsAt, endsAt)
    ? formatTime(endsAt, currentLocale(), societyTimeZone)
    : dateTime(endsAt);
  return `${start} – ${end}`;
}

/** "Sat, 7:00 pm – 8:00 pm", for rows that show the date in a DateBlock. */
export function timeRange(startsAt: string, endsAt: string | null): string {
  const locale = currentLocale();
  const weekday = new Intl.DateTimeFormat(intlTag(locale), {
    weekday: 'short',
    timeZone: societyTimeZone,
  }).format(new Date(startsAt));
  const start = `${weekday}, ${formatTime(startsAt, locale, societyTimeZone)}`;
  if (!endsAt) return start;
  const end = sameDay(startsAt, endsAt)
    ? formatTime(endsAt, locale, societyTimeZone)
    : dateTime(endsAt);
  return `${start} – ${end}`;
}

/** Day number and short month for a DateBlock. */
export function dayAndMonth(iso: string): { day: string; month: string } {
  const tag = intlTag(currentLocale());
  const date = new Date(iso);
  return {
    day: new Intl.DateTimeFormat(tag, { day: 'numeric', timeZone: societyTimeZone }).format(date),
    month: new Intl.DateTimeFormat(tag, { month: 'short', timeZone: societyTimeZone }).format(date),
  };
}

/** "12:30 pm" when it is today, otherwise "Sat, 3 Oct, 12:30 pm". */
export function shortWhen(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  return sameDay(iso, now.toISOString())
    ? formatTime(iso, currentLocale(), societyTimeZone)
    : dateTime(iso);
}

/** Time and day apart, for small tiles: { time: "8:30 am", day: "28 Sept" }. */
export function timeAndDay(iso: string): { time: string; day: string } {
  const locale = currentLocale();
  return {
    time: formatTime(iso, locale, societyTimeZone),
    day: formatDate(iso, locale, 'short', societyTimeZone),
  };
}

/** Greeting for the society's time of day. */
export function greetingKey(now: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const text = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: societyTimeZone,
  }).format(now);
  const parsed = Number.parseInt(text, 10);
  const h = Number.isNaN(parsed) ? now.getHours() : parsed % 24;
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

// ---- Calendar dates (YYYY-MM-DD) and months: no zone ----

/** A calendar date like 2026-10-10 → "10 Oct 2026" ("10 Oct" with 'short'). */
export function day(date: string | null | undefined, style: 'short' | 'medium' = 'medium'): string {
  if (!date) return '';
  return formatDate(`${date}T00:00:00Z`, currentLocale(), style, 'UTC');
}

/** Full month name for month 1–12, e.g. "April". */
export function monthName(month: number): string {
  return new Intl.DateTimeFormat(localeTag(), { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2026, month - 1, 1)),
  );
}

/** Short month name for month 1–12, e.g. "Apr", for chart labels. */
export function shortMonth(month: number): string {
  return new Intl.DateTimeFormat(localeTag(), { month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2026, month - 1, 1)),
  );
}

/** Billing period label: "Oct 2026", "Q1 2026-27", "2026-27". */
export function periodLabel(key: string): string {
  return formatPeriod(key, currentLocale());
}

// ---- Picker dates (phone-local Date) <-> calendar dates ----

/** YYYY-MM-DD for a phone-local Date from a picker. */
export function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A phone-local Date for YYYY-MM-DD. A missing part falls back to this year, January, the 1st. */
export function fromIsoDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? new Date().getFullYear(), (m ?? 1) - 1, d ?? 1);
}
