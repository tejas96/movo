import { randomUUID } from 'node:crypto';
import { FILE_MAX_BYTES, type FileRef, type UploadKind } from '@movo/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import type { TenantContext } from '../../common/tenant/tenant.types';
import type { Prisma } from '../../generated/prisma/client';
import { FileStore } from './file-store';
import { checkFileSignature, fileRef } from './file-url';

export interface UploadedBlob {
  buffer: Buffer;
  size: number;
}

/** What a photo is attached to. Exactly one key. */
export type FileLink = { expenseId: string } | { paymentId: string } | { taskId: string };

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
 * Photos: bytes in the FileStore (disk or a bucket), one StoredFile row each. The API streams
 * them through signed urls, so an <Image> can load them without a login header.
 */
@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantPrismaService,
    private readonly store: FileStore,
  ) {}

  /** A society photo, not attached yet. It goes after a day unless something claims it. */
  async upload(file: UploadedBlob | undefined, kind: UploadKind): Promise<FileRef> {
    const ctx = requireTenant();
    const { buffer, type } = this.check(file);
    const storageKey = `${ctx.societyId}/${randomUUID()}.${type.ext}`;
    await this.store.put(storageKey, buffer, type.mime);
    const row = await this.tenant.client.storedFile.create({
      data: {
        societyId: ctx.societyId,
        ownerMembershipId: ctx.membershipId,
        kind,
        mime: type.mime,
        sizeBytes: buffer.length,
        storageKey,
      },
    });
    return fileRef(row.id);
  }

  /** Stores a profile photo and returns its id. It belongs to the person, not to a society. */
  async uploadAvatar(file: UploadedBlob | undefined): Promise<string> {
    const { buffer, type } = this.check(file);
    const storageKey = `avatars/${randomUUID()}.${type.ext}`;
    await this.store.put(storageKey, buffer, type.mime);
    const row = await this.prisma.storedFile.create({
      data: {
        kind: 'AVATAR',
        mime: type.mime,
        sizeBytes: buffer.length,
        storageKey,
        attachedAt: new Date(),
      },
    });
    return row.id;
  }

  /**
   * Checks that every id is an unused upload of this kind by the caller, in this society.
   * Returns the ids without repeats, in the order given.
   */
  async claim(ctx: TenantContext, ids: readonly string[], kind: UploadKind): Promise<string[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    const found = await this.tenant.client.storedFile.count({
      where: { id: { in: unique }, ownerMembershipId: ctx.membershipId, kind, attachedAt: null },
    });
    if (found !== unique.length) throw ApiException.notFound('Photo not found');
    return unique;
  }

  /** Attaches the photos to a record in this order. Call inside the record's transaction. */
  async link(tx: Prisma.TransactionClient, ids: readonly string[], to: FileLink): Promise<void> {
    const now = new Date();
    for (const [sortOrder, id] of ids.entries())
      await tx.storedFile.update({ where: { id }, data: { ...to, sortOrder, attachedAt: now } });
  }

  /** Photo ids on a record, in order. */
  async linked(to: FileLink): Promise<string[]> {
    const rows = await this.tenant.client.storedFile.findMany({
      where: to,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /**
   * For an edit that sends the full new list: claims the new photos and says which old ones to
   * remove after the transaction.
   */
  async plan(
    ctx: TenantContext,
    current: readonly string[],
    next: readonly string[],
    kind: UploadKind,
  ): Promise<{ final: string[]; dropped: string[] }> {
    const keep = new Set(current);
    const final = [...new Set(next)];
    await this.claim(
      ctx,
      final.filter((id) => !keep.has(id)),
      kind,
    );
    return { final, dropped: current.filter((id) => !final.includes(id)) };
  }

  ref(fileId: string, now = Date.now()): FileRef {
    return fileRef(fileId, now);
  }

  /** Checks the signature and returns the bytes, or null for anything wrong or expired. */
  async read(fileId: string, e: string, s: string): Promise<{ mime: string; body: Buffer } | null> {
    if (!checkFileSignature(fileId, e, s)) return null;
    const row = await this.prisma.storedFile.findUnique({ where: { id: fileId } });
    if (!row) return null;
    const body = await this.store.get(row.storageKey);
    return body ? { mime: row.mime, body } : null;
  }

  /** Files uploaded but never attached to anything, older than a day. */
  async removeUnused(now = new Date()): Promise<number> {
    const stale = await this.prisma.storedFile.findMany({
      where: { attachedAt: null, createdAt: { lt: new Date(now.getTime() - UNUSED_TTL_MS) } },
      take: 500,
    });
    for (const f of stale) {
      await this.store.remove(f.storageKey);
      await this.prisma.storedFile.delete({ where: { id: f.id } });
    }
    if (stale.length) this.logger.log(`removed ${stale.length} unused uploads`);
    return stale.length;
  }

  /** Deletes the bytes and the rows. Used when a photo is taken off something. */
  async remove(fileIds: readonly string[]): Promise<void> {
    if (fileIds.length === 0) return;
    const rows = await this.prisma.storedFile.findMany({ where: { id: { in: [...fileIds] } } });
    for (const f of rows) {
      try {
        await this.store.remove(f.storageKey);
      } catch (error) {
        // The row goes anyway; a stray object costs a few KB, a stray row breaks nothing either.
        this.logger.warn(
          `could not remove ${f.storageKey}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    await this.prisma.storedFile.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  }

  private check(file: UploadedBlob | undefined): {
    buffer: Buffer;
    type: { mime: string; ext: string };
  } {
    if (!file || file.size === 0)
      throw ApiException.badRequest('VALIDATION_FAILED', 'Send one photo in the "file" field');
    if (file.size > FILE_MAX_BYTES)
      throw ApiException.badRequest('VALIDATION_FAILED', 'The photo is larger than 5 MB');
    const type = sniffImage(file.buffer);
    if (!type) throw ApiException.badRequest('VALIDATION_FAILED', 'Only JPEG, PNG or WebP photos');
    return { buffer: file.buffer, type };
  }
}
