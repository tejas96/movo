import { describe, expect, it } from 'vitest';
import { financialYear, formatMoney, formatRelative, initials } from './format';
import { createI18n, resolveLocale } from './i18n';
import { en, NAMESPACES, resources } from './resources';

type Tree = Record<string, unknown>;
const keysOf = (obj: Tree, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keysOf(v as Tree, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

describe('resources', () => {
  it('hi and mr have every English key', () => {
    for (const ns of NAMESPACES) {
      const expected = keysOf(en[ns] as Tree).sort();
      expect(keysOf(resources.hi[ns] as Tree).sort(), `hi/${ns}`).toEqual(expected);
      expect(keysOf(resources.mr[ns] as Tree).sort(), `mr/${ns}`).toEqual(expected);
    }
  });
  it('translates and pluralises', () => {
    const t = createI18n({ locale: 'mr' }).getFixedT('mr', 'home');
    expect(t('needsYou')).toBe('आज तुमच्यासाठी');
    const en = createI18n({ locale: 'en' }).getFixedT('en', 'home');
    expect(en('attention.JOIN_REQUESTS_PENDING.title', { count: 1 })).toBe(
      '1 join request waiting',
    );
    expect(en('attention.JOIN_REQUESTS_PENDING.title', { count: 3 })).toBe(
      '3 join requests waiting',
    );
  });
  it('resolves device tags', () => {
    expect(resolveLocale('mr-IN')).toBe('mr');
    expect(resolveLocale('fr-FR')).toBe('en');
  });
});

describe('format', () => {
  it('formats rupees with Indian grouping', () => {
    expect(formatMoney(124000000)).toBe('₹12,40,000');
    expect(formatMoney(250050)).toBe('₹2,500.50');
  });
  it('relative time without Intl.RelativeTimeFormat', () => {
    const now = new Date('2026-10-01T12:00:00Z');
    expect(formatRelative('2026-10-01T11:58:00Z', 'en', now)).toBe('2 min ago');
    expect(formatRelative('2026-10-01T09:00:00Z', 'en', now)).toBe('3 h ago');
    expect(formatRelative('2026-10-03T12:00:00Z', 'en', now)).toBe('in 2 d');
    expect(formatRelative('2026-09-30T12:00:00Z', 'mr', now)).toBe('1 दिवसांपूर्वी');
  });
  it('initials and financial year', () => {
    expect(initials('Tejas Patil')).toBe('TP');
    expect(initials('Anita')).toBe('AN');
    expect(financialYear(new Date('2026-10-01'))).toBe('2026-27');
    expect(financialYear(new Date('2027-02-01'))).toBe('2026-27');
  });
});
