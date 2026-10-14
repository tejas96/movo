import {
  AudienceSchema,
  type EventRsvp,
  type EventSummary,
  type eventsContract,
  type MyRsvp,
  parseModuleSettings,
  type RouteBody,
  type RouteQuery,
  type SocietyEvent,
  type UpcomingItem,
} from '@movo/contracts';
import { formatDateTime, type TFunction } from '@movo/i18n';
import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import type { TenantContext } from '../../common/tenant/tenant.types';
import { days, iso } from '../../common/util/dates';
import type { SocietyEvent as EventRow, Prisma } from '../../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { Recipients } from '../notifications/recipients.service';
import { assertTimes, isOver, notOverWhere, overWhere } from '../reminders/schedule';
import { ScheduledItems } from '../reminders/scheduled-items';
import { toFlatRef } from '../tenancy/mappers';
import { loadMemberNames } from '../tenancy/member-names';

type CreateBody = RouteBody<typeof eventsContract.create>;
type UpdateBody = RouteBody<typeof eventsContract.update>;
type RsvpBody = RouteBody<typeof eventsContract.rsvp>;
type ListQuery = RouteQuery<typeof eventsContract.list>;

type PushKind = 'published' | 'moved' | 'cancelled' | 'reminder';

/** Events get one reminder, a day before. */
const EVENT_REMINDER_WINDOWS = [24] as const;

interface Counts {
  going: number;
  maybe: number;
  notGoing: number;
  guests: number;
}
const NO_COUNTS: Counts = { going: 0, maybe: 0, notGoing: 0, guests: 0 };

const RESPONSE_ORDER = { GOING: 0, MAYBE: 1, NOT_GOING: 2 } as const;

@Injectable()
export class EventsService {
  private readonly items: ScheduledItems<EventRow, PushKind>;

  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    notifications: NotificationsService,
    recipients: Recipients,
  ) {
    this.items = new ScheduledItems<EventRow, PushKind>(prisma, notifications, recipients, {
      entityType: 'Event',
      label: 'event',
      managePermission: 'event.manage',
      category: 'EVENT',
      screen: 'event',
      idKey: 'eventId',
      push: eventPush,
      logger: new Logger(EventsService.name),
    });
  }

  private get db() {
    return this.tenant.client;
  }

  async list(query: ListQuery) {
    const ctx = requireTenant();
    const now = new Date();
    const timeWhere = (
      query.when === 'UPCOMING' ? notOverWhere(now) : overWhere(now)
    ) as Prisma.SocietyEventWhereInput;
    const page = await this.items.page(ctx, query, timeWhere, ({ where, orderBy, take }) =>
      this.db.societyEvent.findMany({
        where: where as Prisma.SocietyEventWhereInput,
        orderBy,
        take,
      }),
    );
    const ids = page.items.map((e) => e.id);
    const [counts, mine] = await Promise.all([this.countsFor(ids), this.myRsvps(ctx, ids)]);
    return {
      items: page.items.map((e) =>
        toSummary(e, counts.get(e.id) ?? NO_COUNTS, mine.get(e.id) ?? null),
      ),
      nextCursor: page.nextCursor,
    };
  }

  async get(eventId: string): Promise<SocietyEvent> {
    const ctx = requireTenant();
    return this.toDto(ctx, await this.requireVisible(ctx, eventId));
  }

  async create(body: CreateBody): Promise<SocietyEvent> {
    const ctx = requireTenant();
    const startsAt = new Date(body.startsAt);
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    assertTimes(startsAt, endsAt, true);
    const rsvpEnabled =
      body.rsvpEnabled ??
      parseModuleSettings('events', ctx.moduleSettings.events).rsvpEnabledByDefault;
    const e = await this.tenant.tx(async (tx) => {
      const row = await tx.societyEvent.create({
        data: {
          societyId: ctx.societyId,
          title: body.title,
          description: body.description || null,
          location: body.location || null,
          startsAt,
          endsAt,
          rsvpEnabled,
          audience: body.audience as Prisma.InputJsonValue,
          createdByMembershipId: ctx.membershipId,
        },
      });
      await this.audit.record(
        {
          action: 'event.created',
          entityType: 'Event',
          entityId: row.id,
          after: { title: row.title, startsAt: body.startsAt },
        },
        tx,
      );
      await this.items.resetReminders(tx, row, EVENT_REMINDER_WINDOWS);
      await this.items.fanOut(tx, ctx, row, 'published');
      return row;
    });
    return this.toDto(ctx, e);
  }

  async update(eventId: string, body: UpdateBody): Promise<SocietyEvent> {
    const ctx = requireTenant();
    const before = await this.requirePublished(eventId);
    const startsAt = body.startsAt ? new Date(body.startsAt) : before.startsAt;
    const endsAt =
      body.endsAt !== undefined ? (body.endsAt ? new Date(body.endsAt) : null) : before.endsAt;
    const moved = startsAt.getTime() !== before.startsAt.getTime();
    assertTimes(startsAt, endsAt, moved);
    const e = await this.tenant.tx(async (tx) => {
      const row = await tx.societyEvent.update({
        where: { id: eventId, societyId: ctx.societyId },
        data: {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description || null } : {}),
          ...(body.location !== undefined ? { location: body.location || null } : {}),
          ...(body.rsvpEnabled !== undefined ? { rsvpEnabled: body.rsvpEnabled } : {}),
          ...(body.audience !== undefined
            ? { audience: body.audience as Prisma.InputJsonValue }
            : {}),
          startsAt,
          endsAt,
        },
      });
      await this.audit.record(
        {
          action: 'event.updated',
          entityType: 'Event',
          entityId: eventId,
          before: { title: before.title, startsAt: before.startsAt.toISOString() },
          after: { title: row.title, startsAt: row.startsAt.toISOString() },
        },
        tx,
      );
      if (moved) {
        await this.items.resetReminders(tx, row, EVENT_REMINDER_WINDOWS);
        await this.items.fanOut(tx, ctx, row, 'moved');
      }
      return row;
    });
    return this.toDto(ctx, e);
  }

  async cancel(eventId: string, reason: string | undefined): Promise<SocietyEvent> {
    const ctx = requireTenant();
    await this.requirePublished(eventId);
    const e = await this.tenant.tx(async (tx) => {
      const row = await tx.societyEvent.update({
        where: { id: eventId, societyId: ctx.societyId },
        data: { status: 'CANCELLED' },
      });
      await this.audit.record(
        {
          action: 'event.cancelled',
          entityType: 'Event',
          entityId: eventId,
          after: { reason: reason ?? null },
        },
        tx,
      );
      await this.items.fanOut(tx, ctx, row, 'cancelled', reason);
      return row;
    });
    return this.toDto(ctx, e);
  }

  async rsvp(eventId: string, body: RsvpBody): Promise<SocietyEvent> {
    const ctx = requireTenant();
    const e = await this.requireVisible(ctx, eventId);
    if (e.status !== 'PUBLISHED' || !e.rsvpEnabled || isOver(e, new Date()))
      throw ApiException.conflict('CONFLICT', 'Answers are closed for this event');
    const guestsCount = body.response === 'GOING' ? body.guestsCount : 0;
    await this.db.eventRsvp.upsert({
      where: { eventId_membershipId: { eventId, membershipId: ctx.membershipId } },
      update: { response: body.response, guestsCount },
      create: {
        eventId,
        membershipId: ctx.membershipId,
        societyId: ctx.societyId,
        response: body.response,
        guestsCount,
      },
    });
    return this.toDto(ctx, e);
  }

  async listRsvps(eventId: string): Promise<EventRsvp[]> {
    const ctx = requireTenant();
    await this.requireVisible(ctx, eventId);
    const rows = await this.db.eventRsvp.findMany({
      where: { eventId },
      include: {
        membership: {
          include: {
            user: { select: { displayName: true } },
            occupancies: {
              where: { toDate: null },
              include: { flat: { include: { building: true } } },
            },
          },
        },
      },
    });
    return rows
      .sort(
        (a, b) =>
          RESPONSE_ORDER[a.response] - RESPONSE_ORDER[b.response] ||
          b.updatedAt.getTime() - a.updatedAt.getTime(),
      )
      .map((r) => ({
        membershipId: r.membershipId,
        displayName: r.membership.user.displayName,
        flats: r.membership.occupancies.map((o) => toFlatRef(o.flat)),
        response: r.response,
        guestsCount: r.guestsCount,
        updatedAt: r.updatedAt.toISOString(),
      }));
  }

  /** Events in the next 14 days that the viewer may see, with the viewer's answer. */
  async forHome(ctx: TenantContext, now = new Date()): Promise<UpcomingItem[]> {
    const visible = await this.items.upcoming(ctx, now, ({ where, orderBy, take }) =>
      this.db.societyEvent.findMany({
        where: where as Prisma.SocietyEventWhereInput,
        orderBy,
        take,
      }),
    );
    const mine = await this.myRsvps(
      ctx,
      visible.map((e) => e.id),
    );
    return visible.map((e) => ({
      kind: 'EVENT' as const,
      id: e.id,
      title: e.title,
      startsAt: e.startsAt.toISOString(),
      endsAt: iso(e.endsAt),
      location: e.location,
      status: e.status,
      myRsvp: mine.get(e.id) ?? null,
    }));
  }

  /** Runs from the reminder job. Members who said they cannot come are skipped. */
  async sendDueReminders(now: Date): Promise<number> {
    const rows = await this.prisma.societyEvent.findMany({
      where: {
        status: 'PUBLISHED',
        startsAt: { gt: now, lte: new Date(now.getTime() + days(1)) },
      },
      include: { society: { include: { modules: { where: { moduleKey: 'events' } } } } },
    });
    return this.items.sendDueReminders(now, rows, {
      windows: () => EVENT_REMINDER_WINDOWS,
      skipUserIds: async (e) => {
        const declined = await this.prisma.eventRsvp.findMany({
          where: { eventId: e.id, response: 'NOT_GOING' },
          select: { membership: { select: { userId: true } } },
        });
        return declined.map((d) => d.membership.userId);
      },
    });
  }

  private async requireVisible(ctx: TenantContext, eventId: string): Promise<EventRow> {
    const e = await this.db.societyEvent.findUnique({ where: { id: eventId } });
    if (!e || !this.items.visibleTo(ctx, e)) throw ApiException.notFound('Event not found');
    return e;
  }

  private async requirePublished(eventId: string): Promise<EventRow> {
    const e = await this.db.societyEvent.findUnique({ where: { id: eventId } });
    if (!e) throw ApiException.notFound('Event not found');
    if (e.status !== 'PUBLISHED')
      throw ApiException.conflict('CONFLICT', 'A cancelled event cannot change');
    return e;
  }

  private async countsFor(eventIds: string[]): Promise<Map<string, Counts>> {
    if (eventIds.length === 0) return new Map();
    const groups = await this.db.eventRsvp.groupBy({
      by: ['eventId', 'response'],
      where: { eventId: { in: eventIds } },
      _count: { _all: true },
      _sum: { guestsCount: true },
    });
    const out = new Map<string, Counts>();
    for (const g of groups) {
      const c = { ...(out.get(g.eventId) ?? NO_COUNTS) };
      if (g.response === 'GOING') {
        c.going += g._count._all;
        c.guests += g._sum.guestsCount ?? 0;
      } else if (g.response === 'MAYBE') c.maybe += g._count._all;
      else c.notGoing += g._count._all;
      out.set(g.eventId, c);
    }
    return out;
  }

  private async myRsvps(ctx: TenantContext, eventIds: string[]): Promise<Map<string, MyRsvp>> {
    if (eventIds.length === 0) return new Map();
    const rows = await this.db.eventRsvp.findMany({
      where: { membershipId: ctx.membershipId, eventId: { in: eventIds } },
    });
    return new Map(
      rows.map((r) => [r.eventId, { response: r.response, guestsCount: r.guestsCount }]),
    );
  }

  private async toDto(ctx: TenantContext, e: EventRow): Promise<SocietyEvent> {
    const [counts, mine, names] = await Promise.all([
      this.countsFor([e.id]),
      this.myRsvps(ctx, [e.id]),
      loadMemberNames(this.prisma, [e.createdByMembershipId]),
    ]);
    const c = counts.get(e.id) ?? NO_COUNTS;
    return {
      ...toSummary(e, c, mine.get(e.id) ?? null),
      description: e.description,
      audience: AudienceSchema.parse(e.audience),
      counts: c,
      createdBy: {
        membershipId: e.createdByMembershipId,
        displayName: names.get(e.createdByMembershipId)?.displayName ?? 'Committee',
      },
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    };
  }
}

function toSummary(e: EventRow, c: Counts, myRsvp: MyRsvp | null): EventSummary {
  return {
    id: e.id,
    title: e.title,
    startsAt: e.startsAt.toISOString(),
    endsAt: iso(e.endsAt),
    location: e.location,
    status: e.status,
    rsvpEnabled: e.rsvpEnabled,
    goingCount: c.going + c.guests,
    myRsvp,
  };
}

function eventPush(
  t: TFunction,
  locale: Parameters<typeof formatDateTime>[1],
  timeZone: string,
  e: Pick<EventRow, 'title' | 'startsAt' | 'location'>,
  kind: PushKind,
  extra?: string,
): { title: string; body: string } {
  const when = formatDateTime(e.startsAt, locale, timeZone);
  const whenAndWhere = [when, e.location].filter(Boolean).join(' · ');
  const vars = { title: e.title, when };
  switch (kind) {
    case 'published':
      return { title: t('events:push.publishedTitle', vars), body: whenAndWhere };
    case 'moved':
      return {
        title: t('events:push.movedTitle', vars),
        body: [t('events:push.movedBody', vars), e.location].filter(Boolean).join(' · '),
      };
    case 'cancelled':
      return {
        title: t('events:push.cancelledTitle', vars),
        body: extra ?? t('events:push.cancelledBody', vars),
      };
    case 'reminder':
      return { title: t('events:push.reminderTitle', vars), body: whenAndWhere };
  }
}
