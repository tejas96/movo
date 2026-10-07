import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FileRef } from '@movo/contracts';
import { loadEnv } from '../../config/env';

/**
 * A link stays the same for a whole UTC day and works until the end of the next one, so the
 * phone's image cache can keep a photo all day and the bucket sees fewer reads.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

function sign(fileId: string, exp: number): string {
  return createHmac('sha256', `files:${loadEnv().JWT_SECRET}`)
    .update(`${fileId}.${exp}`)
    .digest('base64url');
}

/** "/v1/files/<id>?e=<unix>&s=<hmac>". The app puts its API base in front. */
export function fileRef(fileId: string, now = Date.now()): FileRef {
  const e = Math.floor(((Math.floor(now / DAY_MS) + 2) * DAY_MS) / 1000);
  return { id: fileId, url: `/v1/files/${fileId}?e=${e}&s=${sign(fileId, e)}` };
}

export function fileUrl(fileId: string | null | undefined): string | null {
  return fileId ? fileRef(fileId).url : null;
}

/** True when the signature matches and the link has not run out. */
export function checkFileSignature(fileId: string, e: string, s: string): boolean {
  const exp = Number(e);
  if (!Number.isInteger(exp) || exp * 1000 < Date.now()) return false;
  const want = Buffer.from(sign(fileId, exp));
  const got = Buffer.from(String(s));
  return want.length === got.length && timingSafeEqual(want, got);
}
