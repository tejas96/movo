import {
  AudienceSchema,
  type Notice,
  type NoticeSummary,
  type noticesContract,
  type RouteBody,
  type RouteQuery,
} from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can, type TenantContext } from '../../common/tenant/tenant.types';
import { iso } from '../../common/util/dates';
import { decodeCursor, encodeCursor } from '../../common/util/pagination';
import type { Notice as NoticeRow, Prisma } from '../../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { audienceUserIds, matchesAudience } from './audience';

type CreateBody = RouteBody<typeof noticesContract.create>;
type UpdateBody = RouteBody<typeof noticesContract.update>;
type ListQuery = RouteQuery<typeof noticesContract.list>;

const WINDOW = 150;

@Injectable()
export class NoticesService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  private canManage(ctx: TenantContext): boolean {
    return can(ctx, 'notice.publish') || can(ctx, 'notice.manage_all');
  }

  private visibleTo(ctx: TenantContext, n: NoticeRow): boolean {
    if (this.canManage(ctx)) return true;
    return matchesAudience(AudienceSchema.parse(n.audience), ctx);
  }

  async list(query: ListQuery) {
    const ctx = requireTenant();
    if (query.status !== 'PUBLISHED' && !this.canManage(ctx)) throw ApiException.forbidden();
    const now = new Date();
    const cursor = decodeCursor(query.cursor);
    const base: Prisma.NoticeWhereInput = {
      status: query.status,
      ...(query.category ? { category: query.category } : {}),
      ...(query.status === 'PUBLISHED'
        ? { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
        : {}),
    };
    const sortField = query.status === 'PUBLISHED' ? 'publishedAt' : 'createdAt';

    // Pinned notices come whole on the first page; the cursor walks the unpinned ones.
    const pinned = cursor
      ? []
      : await this.db.notice.findMany({
          where: { ...base, isPinned: true },
          orderBy: [{ [sortField]: 'desc' }, { id: 'desc' }],
        });
    const unpinned = await this.db.notice.findMany({
      where: {
        ...base,
        isPinned: false,
        ...(cursor
          ? {
              AND: [
                {
                  OR: [
                    { [sortField]: { lt: cursor.at } },
                    { [sortField]: cursor.at, id: { lt: cursor.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ [sortField]: 'desc' }, { id: 'desc' }],
      take: WINDOW,
    });
    const visibleUnpinned = unpinned.filter((n) => this.visibleTo(ctx, n));
    const pageUnpinned = visibleUnpinned.slice(0, query.limit);
    const last = pageUnpinned[pageUnpinned.length - 1];
    const hasMore = visibleUnpinned.length > query.limit || unpinned.length === WINDOW;
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            at: (sortField === 'publishedAt' ? last.publishedAt : last.createdAt) ?? last.createdAt,
            id: last.id,
          })
        : null;
    const rows = [...pinned.filter((n) => this.visibleTo(ctx, n)), ...pageUnpinned];
    const reads = await this.readsFor(
      ctx.membershipId,
      rows.map((r) => r.id),
    );
    const names = await this.authorNames(rows.map((r) => r.createdByMembershipId));
    return {
      items: rows.map((n) =>
        this.toSummary(
          n,
          reads.get(n.id) ?? null,
          names.get(n.createdByMembershipId) ?? 'Committee',
        ),
      ),
      nextCursor,
    };
  }

  async get(noticeId: string): Promise<Notice> {
    const ctx = requireTenant();
    const n = await this.db.notice.findUnique({ where: { id: noticeId } });
    if (!n || !this.visibleTo(ctx, n) || (n.status !== 'PUBLISHED' && !this.canManage(ctx)))
      throw ApiException.notFound('Notice not found');
    let readAt: Date | null = null;
    if (n.status === 'PUBLISHED') {
      const read = await this.prisma.noticeRead.upsert({
        where: { noticeId_membershipId: { noticeId, membershipId: ctx.membershipId } },
        update: {},
        create: { noticeId, membershipId: ctx.membershipId },
      });
      readAt = read.readAt;
    }
    return this.toDto(
      n,
      readAt,
      await this.authorName(n.createdByMembershipId),
      this.canManage(ctx) ? await this.prisma.noticeRead.count({ where: { noticeId } }) : null,
    );
  }

  async create(body: CreateBody): Promise<Notice> {
    const ctx = requireTenant();
    const publishedAt = body.publish ? new Date() : null;
    const n = await this.prisma.$transaction(async (tx) => {
      if (body.isPinned) await this.enforcePinLimit(tx, ctx);
      const row = await tx.notice.create({
        data: {
          societyId: ctx.societyId,
          title: body.title,
          body: body.body,
          category: body.category,
          priority: body.priority,
          audience: body.audience as Prisma.InputJsonValue,
          isPinned: body.isPinned,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
          status: body.publish ? 'PUBLISHED' : 'DRAFT',
          publishedAt,
          createdByMembershipId: ctx.membershipId,
        },
      });
      await this.audit.record(
        {
          action: body.publish ? 'notice.published' : 'notice.updated',
          entityType: 'Notice',
          entityId: row.id,
          after: { title: row.title, status: row.status },
        },
        tx,
      );
      return row;
    });
    if (n.status === 'PUBLISHED') await this.fanOut(ctx, n);
    return this.toDto(n, null, await this.authorName(n.createdByMembershipId), 0);
  }

  async update(noticeId: string, body: UpdateBody): Promise<Notice> {
    const ctx = requireTenant();
    const before = await this.requireEditable(ctx, noticeId);
    const n = await this.prisma.$transaction(async (tx) => {
      if (body.isPinned && !before.isPinned) await this.enforcePinLimit(tx, ctx);
      const row = await tx.notice.update({
        where: { id: noticeId, societyId: ctx.societyId },
        data: {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.body !== undefined ? { body: body.body } : {}),
          ...(body.category !== undefined ? { category: body.category } : {}),
          ...(body.priority !== undefined ? { priority: body.priority } : {}),
          ...(body.audience !== undefined
            ? { audience: body.audience as Prisma.InputJsonValue }
            : {}),
          ...(body.isPinned !== undefined ? { isPinned: body.isPinned } : {}),
          ...(body.expiresAt !== undefined
            ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }
            : {}),
        },
      });
      await this.audit.record(
        {
          action: 'notice.updated',
          entityType: 'Notice',
          entityId: row.id,
          before: { title: before.title },
          after: { title: row.title },
        },
        tx,
      );
      return row;
    });
    return this.toDto(
      n,
      null,
      await this.authorName(n.createdByMembershipId),
      await this.prisma.noticeRead.count({ where: { noticeId } }),
    );
  }

  async publish(noticeId: string): Promise<Notice> {
    const ctx = requireTenant();
    const before = await this.requireEditable(ctx, noticeId);
    if (before.status !== 'DRAFT')
      throw ApiException.conflict('CONFLICT', 'Only drafts can be published');
    const n = await this.prisma.$transaction(async (tx) => {
      const row = await tx.notice.update({
        where: { id: noticeId, societyId: ctx.societyId },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      });
      await this.audit.record(
        {
          action: 'notice.published',
          entityType: 'Notice',
          entityId: row.id,
          after: { title: row.title },
        },
        tx,
      );
      return row;
    });
    await this.fanOut(ctx, n);
    return this.toDto(n, null, await this.authorName(n.createdByMembershipId), 0);
  }

  async archive(noticeId: string): Promise<Notice> {
    const ctx = requireTenant();
    await this.requireEditable(ctx, noticeId);
    const n = await this.db.notice.update({
      where: { id: noticeId },
      data: { status: 'ARCHIVED', isPinned: false },
    });
    await this.audit.record({ action: 'notice.archived', entityType: 'Notice', entityId: n.id });
    return this.toDto(
      n,
      null,
      await this.authorName(n.createdByMembershipId),
      await this.prisma.noticeRead.count({ where: { noticeId } }),
    );
  }

  async setPinned(noticeId: string, isPinned: boolean): Promise<Notice> {
    const ctx = requireTenant();
    const before = await this.requireEditable(ctx, noticeId);
    const n = await this.prisma.$transaction(async (tx) => {
      if (isPinned && !before.isPinned) await this.enforcePinLimit(tx, ctx);
      const row = await tx.notice.update({
        where: { id: noticeId, societyId: ctx.societyId },
        data: { isPinned },
      });
      await this.audit.record(
        { action: 'notice.pinned', entityType: 'Notice', entityId: row.id, after: { isPinned } },
        tx,
      );
      return row;
    });
    return this.toDto(
      n,
      null,
      await this.authorName(n.createdByMembershipId),
      await this.prisma.noticeRead.count({ where: { noticeId } }),
    );
  }

  async markRead(noticeId: string): Promise<void> {
    const ctx = requireTenant();
    const n = await this.db.notice.findUnique({ where: { id: noticeId } });
    if (n?.status !== 'PUBLISHED' || !this.visibleTo(ctx, n))
      throw ApiException.notFound('Notice not found');
    await this.prisma.noticeRead.upsert({
      where: { noticeId_membershipId: { noticeId, membershipId: ctx.membershipId } },
      update: {},
      create: { noticeId, membershipId: ctx.membershipId },
    });
  }

  /** Pinned, then latest published notices the viewer may see, plus unread important ones. Used by Home. */
  async forHome(
    ctx: TenantContext,
    limit = 3,
  ): Promise<{ notices: NoticeSummary[]; unreadImportant: NoticeRow[] }> {
    const now = new Date();
    const rows = await this.db.notice.findMany({
      where: { status: 'PUBLISHED', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      take: 40,
    });
    const visible = rows.filter(
      (n) => matchesAudience(AudienceSchema.parse(n.audience), ctx) || this.canManage(ctx),
    );
    const reads = await this.readsFor(
      ctx.membershipId,
      visible.map((r) => r.id),
    );
    const names = await this.authorNames(visible.map((r) => r.createdByMembershipId));
    const top = visible.slice(0, limit);
    const unreadImportant = visible.filter((n) => n.priority !== 'NORMAL' && !reads.has(n.id));
    return {
      notices: top.map((n) =>
        this.toSummary(
          n,
          reads.get(n.id) ?? null,
          names.get(n.createdByMembershipId) ?? 'Committee',
        ),
      ),
      unreadImportant,
    };
  }

  private async requireEditable(ctx: TenantContext, noticeId: string): Promise<NoticeRow> {
    const n = await this.db.notice.findUnique({ where: { id: noticeId } });
    if (!n) throw ApiException.notFound('Notice not found');
    if (n.createdByMembershipId !== ctx.membershipId && !can(ctx, 'notice.manage_all'))
      throw ApiException.forbidden('Only the author or a notice manager can change this');
    return n;
  }

  /** Oldest pinned notice is unpinned when the society's pin limit would be exceeded. */
  private async enforcePinLimit(tx: Prisma.TransactionClient, ctx: TenantContext): Promise<void> {
    const max = Number(
      (ctx.moduleSettings.notices as { maxPinned?: number } | undefined)?.maxPinned ?? 3,
    );
    const pinned = await tx.notice.findMany({
      where: { societyId: ctx.societyId, isPinned: true, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'asc' },
    });
    const excess = pinned.length - max + 1;
    if (excess > 0) {
      await tx.notice.updateMany({
        where: { id: { in: pinned.slice(0, excess).map((p) => p.id) } },
        data: { isPinned: false },
      });
    }
  }

  private async fanOut(ctx: TenantContext, n: NoticeRow): Promise<void> {
    const audience = AudienceSchema.parse(n.audience);
    const recipients = await audienceUserIds(this.prisma, ctx.societyId, audience);
    await this.notifications.notifyUsers({
      userIds: recipients.filter((id) => id !== ctx.userId),
      societyId: ctx.societyId,
      category: 'NOTICE',
      render: () => ({
        title:
          n.priority === 'NORMAL'
            ? n.title
            : `${n.priority === 'EMERGENCY' ? '🚨 ' : '❗ '}${n.title}`,
        body: n.body.slice(0, 140),
      }),
      data: { screen: 'notice', societyId: ctx.societyId, noticeId: n.id, priority: n.priority },
    });
  }

  private async readsFor(membershipId: string, noticeIds: string[]): Promise<Map<string, Date>> {
    if (noticeIds.length === 0) return new Map();
    const reads = await this.prisma.noticeRead.findMany({
      where: { membershipId, noticeId: { in: noticeIds } },
    });
    return new Map(reads.map((r) => [r.noticeId, r.readAt]));
  }

  private async authorNames(membershipIds: string[]): Promise<Map<string, string>> {
    const ids = [...new Set(membershipIds)];
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.membership.findMany({
      where: { id: { in: ids } },
      include: { user: true },
    });
    return new Map(rows.map((m) => [m.id, m.user.displayName]));
  }

  private async authorName(membershipId: string): Promise<string> {
    return (await this.authorNames([membershipId])).get(membershipId) ?? 'Committee';
  }

  private toSummary(n: NoticeRow, readAt: Date | null, authorName: string): NoticeSummary {
    return {
      id: n.id,
      title: n.title,
      category: n.category,
      priority: n.priority,
      isPinned: n.isPinned,
      status: n.status,
      publishedAt: iso(n.publishedAt),
      readAt: iso(readAt),
      createdBy: { membershipId: n.createdByMembershipId, displayName: authorName },
    };
  }

  private toDto(
    n: NoticeRow,
    readAt: Date | null,
    authorName: string,
    readCount: number | null,
  ): Notice {
    return {
      ...this.toSummary(n, readAt, authorName),
      body: n.body,
      audience: AudienceSchema.parse(n.audience),
      expiresAt: iso(n.expiresAt),
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
      readCount,
    };
  }
}
