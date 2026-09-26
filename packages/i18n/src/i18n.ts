import { DEFAULT_LOCALE, LOCALES, type Locale } from '@movo/contracts';
import i18next, { type InitOptions, type i18n } from 'i18next';
import { DEFAULT_NAMESPACE, NAMESPACES, resources } from './resources';

export interface CreateI18nOptions {
  locale?: Locale;
  /** Society default locale, tried before English. */
  fallbackLocale?: Locale;
}

/** The init options both the API and the app use, so behaviour is identical on both sides. */
export function buildI18nOptions(options: CreateI18nOptions = {}): InitOptions {
  const fallback = [options.fallbackLocale, DEFAULT_LOCALE].filter((v): v is Locale => Boolean(v));
  return {
    lng: options.locale ?? DEFAULT_LOCALE,
    fallbackLng: Array.from(new Set(fallback)),
    supportedLngs: [...LOCALES],
    ns: NAMESPACES,
    defaultNS: DEFAULT_NAMESPACE,
    resources,
    interpolation: { escapeValue: false },
    returnNull: false,
    initAsync: false,
  };
}

/**
 * Builds an isolated i18next instance. The API builds one per notification render so each
 * recipient gets their own language. The app builds its own with the react plugin attached.
 */
export function createI18n(options: CreateI18nOptions = {}): i18n {
  const instance = i18next.createInstance();
  void instance.init(buildI18nOptions(options));
  return instance;
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Picks the best supported locale from a device or browser tag like "mr-IN". */
export function resolveLocale(
  tag: string | null | undefined,
  fallback: Locale = DEFAULT_LOCALE,
): Locale {
  if (!tag) return fallback;
  const base = tag.toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : fallback;
}
