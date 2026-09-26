import type { Locale } from '@movo/contracts';
import { buildI18nOptions, isLocale, resolveLocale } from '@movo/i18n';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { kv } from '../storage/mmkv';

const LOCALE_KEY = 'locale';

function initialLocale(): Locale {
  const stored = kv.get(LOCALE_KEY);
  if (isLocale(stored)) return stored;
  try {
    return resolveLocale(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'en';
  }
}

export const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init(buildI18nOptions({ locale: initialLocale() }));

export function currentLocale(): Locale {
  return resolveLocale(i18n.language);
}

/** Persists the choice and switches every mounted screen. */
export async function setAppLocale(locale: Locale): Promise<void> {
  kv.set(LOCALE_KEY, locale);
  await i18n.changeLanguage(locale);
}
