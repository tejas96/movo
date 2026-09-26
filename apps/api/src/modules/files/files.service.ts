import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { FILE_MAX_BYTES, type FileRef } from '@movo/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { loadEnv } from '../../config/env';

export interface UploadedBlob {
  buffer: Buffer;
  size: number;
}

/** Signed urls last until the end of the next hour, so the same photo keeps one url for a while. */
const URL_WINDOW_MS = 60 * 60 * 1000;
const UNUSED_TTL_MS = 24 * 60 * 60 * 1000;

/** Recognises the file by its first bytes, never by the name or the header the phone sent. */
export function sniffImage(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return { mime: 'image/jpeg', ext: 'jpg' };
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return { mime: 'image/png', ext: 'png' };
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return { mime: 'image/webp', ext: 'webp' };
  return null;
}

/**
 * Photos on the server's own disk: ₹0 and one less account. The API streams them through short
 * signed urls, so an <Image> can load them without a login header.
 */
@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly root = resolve(loadEnv().FILES_DIR);
  private readonly secret = `files:${loadEnv().JWT_SECRET}`;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantPrismaService,
  ) {}

  async upload(file: UploadedBlob | undefined): Promise<FileRef> {
    const ctx = requireTenant();
    if (!file || file.size === 0)
      throw ApiException.badRequest('VALIDATION_FAILED', 'Send one photo in the "file" field');
    if (file.size > FILE_MAX_BYTES)
      throw ApiException.badRequest('VALIDATION_FAILED', 'The photo is larger than 5 MB');
    const kind = sniffImage(file.buffer);
    if (!kind) throw ApiException.badRequest('VALIDATION_FAILED', 'Only JPEG, PNG or WebP photos');
    const storageKey = `${ctx.societyId}/${randomUUID()}.${kind.ext}`;
    const path = this.pathOf(storageKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.buffer);
    const row = await this.tenant.client.storedFile.create({
      data: {
        societyId: ctx.societyId,
        ownerMembershipId: ctx.membershipId,
        kind: 'LISTING_IMAGE',
        mime: kind.mime,
        sizeBytes: file.size,
        storageKey,
      },
    });
    return this.ref(row.id);
  }

  /** "/v1/files/<id>?e=<unix>&s=<hmac>". The app puts its API base in front. */
  ref(fileId: string, now = Date.now()): FileRef {
    const e = Math.floor(((Math.floor(now / URL_WINDOW_MS) + 2) * URL_WINDOW_MS) / 1000);
    return { id: fileId, url: `/v1/files/${fileId}?e=${e}&s=${this.sign(fileId, e)}` };
  }

  /** Checks the signature and returns the bytes, or null for anything wrong or expired. */
  async read(fileId: string, e: string, s: string): Promise<{ mime: string; body: Buffer } | null> {
    const exp = Number(e);
    if (!Number.isInteger(exp) || exp * 1000 < Date.now()) return null;
    const want = Buffer.from(this.sign(fileId, exp));
    const got = Buffer.from(String(s));
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
    const row = await this.prisma.storedFile.findUnique({ where: { id: fileId } });
    if (!row) return null;
    try {
      return { mime: row.mime, body: await readFile(this.pathOf(row.storageKey)) };
    } catch {
      return null;
    }
  }

  /** Files uploaded but never attached to anything, older than a day. */
  async removeUnused(now = new Date()): Promise<number> {
    const stale = await this.prisma.storedFile.findMany({
      where: { attachedAt: null, createdAt: { lt: new Date(now.getTime() - UNUSED_TTL_MS) } },
      take: 500,
    });
    for (const f of stale) {
      await rm(this.pathOf(f.storageKey), { force: true });
      await this.prisma.storedFile.delete({ where: { id: f.id } });
    }
    if (stale.length) this.logger.log(`removed ${stale.length} unused uploads`);
    return stale.length;
  }

  /** Deletes the bytes and the row. Used when a photo is taken off a listing. */
  async remove(fileIds: string[]): Promise<void> {
    if (fileIds.length === 0) return;
    const rows = await this.prisma.storedFile.findMany({ where: { id: { in: fileIds } } });
    for (const f of rows) await rm(this.pathOf(f.storageKey), { force: true });
    await this.prisma.storedFile.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  }

  private sign(fileId: string, exp: number): string {
    return createHmac('sha256', this.secret).update(`${fileId}.${exp}`).digest('base64url');
  }

  private pathOf(storageKey: string): string {
    const path = resolve(join(this.root, storageKey));
    if (!path.startsWith(this.root)) throw new Error('Bad storage key');
    return path;
  }
}
