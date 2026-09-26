import type { Locale } from '@movo/contracts';

const INTL_TAG: Record<Locale, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };

export function intlTag(locale: Locale): string {
  return INTL_TAG[locale];
}

/** ₹12,40,000 style, always from integer paise. */
export function formatMoney(
  paise: number,
  locale: Locale = 'en',
  options: { compact?: boolean } = {},
): string {
  const rupees = paise / 100;
  const fmt = new Intl.NumberFormat(INTL_TAG[locale], {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    ...(options.compact ? { notation: 'compact' as const } : {}),
  });
  return fmt.format(rupees);
}

export function formatNumber(value: number, locale: Locale = 'en'): string {
  return new Intl.NumberFormat(INTL_TAG[locale]).format(value);
}

export function formatDate(
  value: string | Date,
  locale: Locale = 'en',
  style: 'short' | 'medium' | 'long' | 'weekday' = 'medium',
  timeZone = 'Asia/Kolkata',
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const opts: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { day: 'numeric', month: 'short' }
      : style === 'medium'
        ? { day: 'numeric', month: 'short', year: 'numeric' }
        : style === 'weekday'
          ? { weekday: 'short', day: 'numeric', month: 'short' }
          : { day: 'numeric', month: 'long', year: 'numeric' };
  return new Intl.DateTimeFormat(INTL_TAG[locale], { ...opts, timeZone }).format(date);
}

export function formatTime(
  value: string | Date,
  locale: Locale = 'en',
  timeZone = 'Asia/Kolkata',
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(INTL_TAG[locale], {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(date);
}

/** "Sat, 3 Oct, 6:00 pm". Used in pushes and in meeting and event rows. */
export function formatDateTime(
  value: string | Date,
  locale: Locale = 'en',
  timeZone = 'Asia/Kolkata',
): string {
  return `${formatDate(value, locale, 'weekday', timeZone)}, ${formatTime(value, locale, timeZone)}`;
}

/**
 * Billing period label: "Oct 2026" for 2026-10, "Q1 2026-27" for 2026-27-Q1,
 * "H2 2026-27" for 2026-27-H2, "2026-27" for a year.
 */
export function formatPeriod(key: string, locale: Locale = 'en'): string {
  const month = /^(\d{4})-(\d{2})$/.exec(key);
  if (month) {
    const date = new Date(Date.UTC(Number(month[1]), Number(month[2]) - 1, 1));
    return new Intl.DateTimeFormat(INTL_TAG[locale], {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }
  const part = /^(\d{4}-\d{2})-([QH]\d)$/.exec(key);
  return part ? `${part[2]} ${part[1]}` : key;
}

type RelUnit = 'now' | 'minute' | 'hour' | 'day' | 'month';

/**
 * Hermes (Android) has no Intl.RelativeTimeFormat, so relative times are built from short
 * unit words per locale. Digits stay Latin, like the rest of the UI numbers.
 */
const REL: Record<
  Locale,
  {
    now: string;
    past: Record<Exclude<RelUnit, 'now'>, string>;
    future: Record<Exclude<RelUnit, 'now'>, string>;
  }
> = {
  en: {
    now: 'just now',
    past: { minute: '{n} min ago', hour: '{n} h ago', day: '{n} d ago', month: '{n} mo ago' },
    future: { minute: 'in {n} min', hour: 'in {n} h', day: 'in {n} d', month: 'in {n} mo' },
  },
  hi: {
    now: 'अभी',
    past: { minute: '{n} मिनट पहले', hour: '{n} घंटे पहले', day: '{n} दिन पहले', month: '{n} महीने पहले' },
    future: { minute: '{n} मिनट में', hour: '{n} घंटे में', day: '{n} दिन में', month: '{n} महीने में' },
  },
  mr: {
    now: 'आत्ताच',
    past: {
      minute: '{n} मिनिटांपूर्वी',
      hour: '{n} तासांपूर्वी',
      day: '{n} दिवसांपूर्वी',
      month: '{n} महिन्यांपूर्वी',
    },
    future: { minute: '{n} मिनिटांत', hour: '{n} तासांत', day: '{n} दिवसांत', month: '{n} महिन्यांत' },
  },
};

/** "2 h ago", "3 d ago", "in 5 min". Works on Hermes and Node alike. */
export function formatRelative(
  value: string | Date,
  locale: Locale = 'en',
  now: Date = new Date(),
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const diffSec = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  const words = REL[locale];
  if (abs < 60) return words.now;
  const [unit, n]: [Exclude<RelUnit, 'now'>, number] =
    abs < 3600
      ? ['minute', Math.round(abs / 60)]
      : abs < 86400
        ? ['hour', Math.round(abs / 3600)]
        : abs < 86400 * 30
          ? ['day', Math.round(abs / 86400)]
          : ['month', Math.round(abs / (86400 * 30))];
  const template = diffSec < 0 ? words.past[unit] : words.future[unit];
  return template.replace('{n}', String(n));
}

/** First two letters for an avatar, from a display name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? '');
  return (first + second).toUpperCase();
}

/** Financial year label like 2026-27 for a date, given the start month (4 = April). */
export function financialYear(date: Date, startMonth = 4): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const startYear = m >= startMonth ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}
