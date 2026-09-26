import { randomBytes, randomInt } from 'node:crypto';

/** No 0/O/1/I so codes can be read out loud. */
const READABLE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function readableCode(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += READABLE[randomInt(READABLE.length)];
  return out;
}

export function numericCode(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += String(randomInt(10));
  return out;
}

export function secureToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}
