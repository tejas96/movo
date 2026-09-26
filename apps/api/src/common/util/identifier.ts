import { E164_PHONE } from '@movo/contracts';

export type Identifier = { kind: 'email'; value: string } | { kind: 'phone'; value: string };

/**
 * Accepts what people type: "98765 43210", "098765-43210", "+91 98765 43210", "You@Example.com".
 * Returns a normalised email or E.164 phone, or null when it is neither.
 */
export function normalizeIdentifier(raw: string, defaultCountryCode = '+91'): Identifier | null {
  const value = raw.trim();
  if (value.includes('@')) {
    const email = value.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { kind: 'email', value: email } : null;
  }
  let digits = value.replace(/[\s\-().]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith('+')) {
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    if (digits.length === 10) digits = `${defaultCountryCode}${digits}`;
    else if (digits.length === 12 && digits.startsWith('91')) digits = `+${digits}`;
    else return null;
  }
  return E164_PHONE.test(digits) ? { kind: 'phone', value: digits } : null;
}
