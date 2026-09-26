import { formatDate, formatRelative } from '@movo/i18n';
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
