/** "98765 43210" or "098765-43210" -> "+919876543210". Leaves anything else for the server to judge. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  return digits;
}

/** "+919876543210" -> "+91 98765 43210" for display. */
export function formatPhone(e164: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}
