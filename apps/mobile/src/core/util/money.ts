import { formatDate, formatMoney } from '@movo/i18n';
import { currentLocale } from '../i18n';

/** ₹2,500 from integer paise, in the app language. */
export function money(paise: number): string {
  return formatMoney(paise, currentLocale());
}

/** "2,500" or "2500.50" typed by a person → paise. Null when it is not a positive amount. */
export function parseRupees(text: string): number | null {
  const clean = text.replace(/[,₹\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const paise = Math.round(Number(clean) * 100);
  return paise > 0 ? paise : null;
}

/** Paise → "2500" or "2500.50" for an input field. */
export function rupeesText(paise: number): string {
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

/** A calendar date like 2026-10-10 → "10 Oct 2026". */
export function day(date: string | null | undefined, style: 'short' | 'medium' = 'medium'): string {
  if (!date) return '';
  return formatDate(`${date}T00:00:00Z`, currentLocale(), style, 'UTC');
}

/** YYYY-MM-DD for a phone-local Date. */
export function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A key that stays the same while one form is open, so a retried save is not counted twice. */
export function newIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
