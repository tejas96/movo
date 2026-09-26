import {
  AudienceSchema,
  type Meeting,
  type MeetingSummary,
  type meetingsContract,
  parseModuleSettings,
  type RouteBody,
  type RouteQuery,
  type UpcomingItem,
} from '@movo/contracts';
import { formatDateTime, type TFunction } from '@movo/i18n';
import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can, type TenantContext } from '../../common/tenant/tenant.types';
import { days, iso } from '../../common/util/dates';
import type {
  Meeting as MeetingRow,
  MeetingUpdate as MeetingUpdateRow,
  Prisma,
} from '../../generated/prisma/client';
import { audienceUserIds, matchesAudience } from '../notices/audience';
import { NotificationsService } from '../notifications/notifications.service';
import { claimReminder, resetReminders } from '../reminders/ledger';
import {
  assertTimes,
  notOverWhere,
  overWhere,
  pageByStart,
  UPCOMING_DAYS,
} from '../reminders/schedule';
import { loadMemberNames } from '../tenancy/member-names';

type CreateBody = RouteBody<typeof meetingsContract.create>;
type UpdateBody = RouteBody<typeof meetingsContract.update>;
type ListQuery = RouteQuery<typeof meetingsContract.list>;

type PushKind = 'scheduled' | 'moved' | 'note' | 'cancelled' | 'reminder';

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  private visibleTo(ctx: TenantContext, m: MeetingRow): boolean {
    return can(ctx, 'meeting.manage') || matchesAudience(AudienceSchema.parse(m.audience), ctx);
  }

  private windows(ctx: TenantContext): number[] {
    return parseModuleSettings('meetings', ctx.moduleSettings.meetings).reminderHoursBefore;
  }

  async list(query: ListQuery) {
    const ctx = requireTenant();
    const now = new Date();
    const timeWhere: Prisma.MeetingWhereInput =
      query.when === 'UPCOMING'
        ? { AND: [notOverWhere(now), { status: { not: 'COMPLETED' } }] }
        : { OR: [...overWhere(now).OR, { status: 'COMPLETED' }] };
    const page = await pageByStart({
      when: query.when,
      cursor: query.cursor,
      limit: query.limit,
      fetch: ({ cursorWhere, orderBy, take }) =>
        this.db.meeting.findMany({
          where: { AND: [timeWhere, cursorWhere as Prisma.MeetingWhereInput] },
          orderBy,
          take,
        }),
      visible: (m) => this.visibleTo(ctx, m),
    });
    return { items: page.items.map(toSummary), nextCursor: page.nextCursor };
  }

  async get(meetingId: string): Promise<Meeting> {
    const ctx = requireTenant();
    const m = await this.db.meeting.findUnique({ where: { id: meetingId } });
    if (!m || !this.visibleTo(ctx, m)) throw ApiException.notFound('Meeting not found');
    return this.toDto(m);
  }

  async create(body: CreateBody): Promise<Meeting> {
    const ctx = requireTenant();
    const startsAt = new Date(body.startsAt);
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    assertTimes(startsAt, endsAt, true);
    const m = await this.prisma.$transaction(async (tx) => {
      const row = await tx.meeting.create({
        data: {
          societyId: ctx.societyId,
          title: body.title,
          agenda: body.agenda || null,
          location: body.location || null,
          startsAt,
          endsAt,
          audience: body.audience as Prisma.InputJsonValue,
          createdByMembershipId: ctx.membershipId,
        },
      });
      await this.audit.record(
        {
          action: 'meeting.created',
          entityType: 'Meeting',
          entityId: row.id,
          after: { title: row.title, startsAt: body.startsAt },
        },
        tx,
      );
      return row;
    });
    await resetReminders(this.prisma, this.target(m), m.startsAt, this.windows(ctx));
    await this.fanOut(ctx, m, 'scheduled');
    return this.toDto(m);
  }

  async update(meetingId: string, body: UpdateBody): Promise<Meeting> {
    const ctx = requireTenant();
    const before = await this.requireScheduled(meetingId);
    const startsAt = body.startsAt ? new Date(body.startsAt) : before.startsAt;
    const endsAt =
      body.endsAt !== undefined ? (body.endsAt ? new Date(body.endsAt) : null) : before.endsAt;
    const moved = startsAt.getTime() !== before.startsAt.getTime();
    assertTimes(startsAt, endsAt, moved);
    const m = await this.prisma.$transaction(async (tx) => {
      const row = await tx.meeting.update({
        where: { id: meetingId, societyId: ctx.societyId },
        data: {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.agenda !== undefined ? { agenda: body.agenda || null } : {}),
          ...(body.location !== undefined ? { location: body.location || null } : {}),
          ...(body.audience !== undefined
            ? { audience: body.audience as Prisma.InputJsonValue }
            : {}),
          startsAt,
          endsAt,
        },
      });
      if (moved) {
        await tx.meetingUpdate.create({
          data: {
            societyId: ctx.societyId,
            meetingId,
            kind: 'RESCHEDULED',
            body: body.note ?? null,
            previousStartsAt: before.startsAt,
            createdByMembershipId: ctx.membershipId,
          },
        });
      }
      await this.audit.record(
        {
          action: moved ? 'meeting.rescheduled' : 'meeting.updated',
          entityType: 'Meeting',
          entityId: meetingId,
          before: { title: before.title, startsAt: before.startsAt.toISOString() },
          after: { title: row.title, startsAt: row.startsAt.toISOString() },
        },
        tx,
      );
      return row;
    });
    if (moved) {
      await resetReminders(this.prisma, this.target(m), m.startsAt, this.windows(ctx));
      await this.fanOut(ctx, m, 'moved', body.note);
    }
    return this.toDto(m);
  }

  async addNote(meetingId: string, note: string): Promise<Meeting> {
    const ctx = requireTenant();
    const m = await this.requireScheduled(meetingId);
    await this.prisma.$transaction(async (tx) => {
      await tx.meetingUpdate.create({
        data: {
          societyId: ctx.societyId,
          meetingId,
          kind: 'NOTE',
          body: note,
          createdByMembershipId: ctx.membershipId,
        },
      });
      await this.audit.record(
        { action: 'meeting.note_added', entityType: 'Meeting', entityId: meetingId },
        tx,
      );
    });
    await this.fanOut(ctx, m, 'note', note);
    return this.toDto(m);
  }

  async cancel(meetingId: string, note: string | undefined): Promise<Meeting> {
    const ctx = requireTenant();
    await this.requireScheduled(meetingId);
    const m = await this.close(ctx, meetingId, 'CANCELLED', note);
    await this.fanOut(ctx, m, 'cancelled', note);
    return this.toDto(m);
  }

  async complete(meetingId: string, note: string | undefined): Promise<Meeting> {
    const ctx = requireTenant();
    const before = await this.requireScheduled(meetingId);
    if (before.startsAt.getTime() > Date.now())
      throw ApiException.conflict('CONFLICT', 'This meeting has not started yet');
    return this.toDto(await this.close(ctx, meetingId, 'COMPLETED', note));
  }

  /** Scheduled or cancelled meetings in the next 14 days that the viewer may see. */
  async forHome(ctx: TenantContext, now = new Date()): Promise<UpcomingItem[]> {
    const rows = await this.db.meeting.findMany({
      where: {
        AND: [
          notOverWhere(now),
          {
            status: { not: 'COMPLETED' },
            startsAt: { lte: new Date(now.getTime() + days(UPCOMING_DAYS)) },
          },
        ],
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: 20,
    });
    return rows
      .filter((m) => this.visibleTo(ctx, m))
      .map((m) => ({ kind: 'MEETING' as const, ...toSummary(m) }));
  }

  /**
   * Runs from the reminder job, outside any request. Sends at most one reminder per meeting
   * per run, for the most urgent window that opened.
   */
  async sendDueReminders(now: Date): Promise<number> {
    const maxWindow = days(7);
    const rows = await this.prisma.meeting.findMany({
      where: {
        status: 'SCHEDULED',
        startsAt: { gt: now, lte: new Date(now.getTime() + maxWindow) },
      },
      include: { society: { include: { modules: { where: { moduleKey: 'meetings' } } } } },
    });
    let sent = 0;
    for (const m of rows) {
      const mod = m.society.modules[0];
      if (mod && !mod.enabled) continue;
      const windows = parseModuleSettings('meetings', mod?.settings).reminderHoursBefore;
      const due = await claimReminder(this.prisma, this.target(m), m.startsAt, windows, now);
      if (due === null) continue;
      const userIds = await audienceUserIds(
        this.prisma,
        m.societyId,
        AudienceSchema.parse(m.audience),
      );
      await this.notifications.notifyUsers({
        userIds,
        societyId: m.societyId,
        category: 'MEETING',
        render: (t, locale) => meetingPush(t, locale, m.society.timezone, m, 'reminder'),
        data: { screen: 'meeting', societyId: m.societyId, meetingId: m.id },
      });
      sent += 1;
    }
    if (sent > 0) this.logger.log(`sent ${sent} meeting reminder(s)`);
    return sent;
  }

  private async close(
    ctx: TenantContext,
    meetingId: string,
    status: 'CANCELLED' | 'COMPLETED',
    note: string | undefined,
  ): Promise<MeetingRow> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.meeting.update({
        where: { id: meetingId, societyId: ctx.societyId },
        data: { status },
      });
      await tx.meetingUpdate.create({
        data: {
          societyId: ctx.societyId,
          meetingId,
          kind: status,
          body: note ?? null,
          createdByMembershipId: ctx.membershipId,
        },
      });
      await this.audit.record(
        {
          action: status === 'CANCELLED' ? 'meeting.cancelled' : 'meeting.completed',
          entityType: 'Meeting',
          entityId: meetingId,
          after: { status, note: note ?? null },
        },
        tx,
      );
      return row;
    });
  }

  private async requireScheduled(meetingId: string): Promise<MeetingRow> {
    const m = await this.db.meeting.findUnique({ where: { id: meetingId } });
    if (!m) throw ApiException.notFound('Meeting not found');
    if (m.status !== 'SCHEDULED')
      throw ApiException.conflict('CONFLICT', 'Only a scheduled meeting can change');
    return m;
  }

  private target(m: MeetingRow) {
    return { societyId: m.societyId, entityType: 'Meeting' as const, entityId: m.id };
  }

  private async fanOut(
    ctx: TenantContext,
    m: MeetingRow,
    kind: PushKind,
    extra?: string,
  ): Promise<void> {
    const recipients = await audienceUserIds(
      this.prisma,
      ctx.societyId,
      AudienceSchema.parse(m.audience),
    );
    await this.notifications.notifyUsers({
      userIds: recipients.filter((id) => id !== ctx.userId),
      societyId: ctx.societyId,
      category: 'MEETING',
      render: (t, locale) => meetingPush(t, locale, ctx.society.timezone, m, kind, extra),
      data: { screen: 'meeting', societyId: ctx.societyId, meetingId: m.id },
    });
  }

  private async toDto(m: MeetingRow): Promise<Meeting> {
    const updates = await this.db.meetingUpdate.findMany({
      where: { meetingId: m.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const names = await loadMemberNames(this.prisma, [
      m.createdByMembershipId,
      ...updates.map((u) => u.createdByMembershipId),
    ]);
    const actor = (id: string) => ({
      membershipId: id,
      displayName: names.get(id)?.displayName ?? 'Committee',
    });
    return {
      ...toSummary(m),
      agenda: m.agenda,
      audience: AudienceSchema.parse(m.audience),
      createdBy: actor(m.createdByMembershipId),
      updates: updates.map((u: MeetingUpdateRow) => ({
        id: u.id,
        kind: u.kind,
        body: u.body,
        previousStartsAt: iso(u.previousStartsAt),
        createdBy: actor(u.createdByMembershipId),
        createdAt: u.createdAt.toISOString(),
      })),
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }
}

function toSummary(m: MeetingRow): MeetingSummary {
  return {
    id: m.id,
    title: m.title,
    startsAt: m.startsAt.toISOString(),
    endsAt: iso(m.endsAt),
    location: m.location,
    status: m.status,
  };
}

function meetingPush(
  t: TFunction,
  locale: Parameters<typeof formatDateTime>[1],
  timeZone: string,
  m: Pick<MeetingRow, 'title' | 'startsAt' | 'location'>,
  kind: PushKind,
  extra?: string,
): { title: string; body: string } {
  const when = formatDateTime(m.startsAt, locale, timeZone);
  const whenAndWhere = [when, m.location].filter(Boolean).join(' · ');
  const vars = { title: m.title, when };
  switch (kind) {
    case 'scheduled':
      return { title: t('meetings:push.scheduledTitle', vars), body: whenAndWhere };
    case 'moved':
      return {
        title: t('meetings:push.movedTitle', vars),
        body: [t('meetings:push.movedBody', vars), m.location, extra].filter(Boolean).join(' · '),
      };
    case 'note':
      return { title: t('meetings:push.noteTitle', vars), body: extra ?? '' };
    case 'cancelled':
      return {
        title: t('meetings:push.cancelledTitle', vars),
        body: extra ?? t('meetings:push.cancelledBody', vars),
      };
    case 'reminder':
      return { title: t('meetings:push.reminderTitle', vars), body: whenAndWhere };
  }
}
