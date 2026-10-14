import {
  AudienceSchema,
  type Locale,
  type NotificationCategory,
  type PermissionKey,
  type Timeframe,
} from '@movo/contracts';
import type { TFunction } from '@movo/i18n';
import type { Logger } from '@nestjs/common';
import type { PrismaService } from '../../common/prisma/prisma.service';
import { can, type TenantContext } from '../../common/tenant/tenant.types';
import { days } from '../../common/util/dates';
import type { Prisma } from '../../generated/prisma/client';
import { matchesAudience } from '../notices/audience';
import type { NotificationsService } from '../notifications/notifications.service';
import type { Recipients } from '../notifications/recipients.service';
import { claimReminder, type ReminderEntity, resetReminders } from './ledger';
import { notOverWhere, pageByStart, UPCOMING_DAYS } from './schedule';

/** The columns meetings and events share. */
export interface ScheduledRow {
  id: string;
  societyId: string;
  audience: Prisma.JsonValue;
  startsAt: Date;
  endsAt: Date | null;
}

/** A scheduled row as the reminder job loads it, with its society's module switch. */
export type DueRow<Row> = Row & {
  society: { timezone: string; modules: { enabled: boolean; settings: Prisma.JsonValue }[] };
};

type FindArgs = {
  where: object;
  orderBy: [{ startsAt: 'asc' | 'desc' }, { id: 'asc' | 'desc' }];
  take: number;
};

export interface ScheduledKind<Row extends ScheduledRow, Kind extends string> {
  entityType: ReminderEntity;
  /** "meeting" / "event", for logs. */
  label: string;
  /** Who sees every item whatever its audience. */
  managePermission: PermissionKey;
  category: NotificationCategory;
  /** Push target: screen name and the id key the app reads. */
  screen: string;
  idKey: string;
  push: (
    t: TFunction,
    locale: Locale,
    timeZone: string,
    row: Row,
    kind: Kind,
    extra?: string,
  ) => { title: string; body: string };
  logger: Logger;
}

/**
 * What meetings and events have in common: who may see one, paged listing by start time,
 * the home window, pushes to the audience and the reminder loop. Each service keeps its own
 * table, statuses and DTOs.
 */
export class ScheduledItems<Row extends ScheduledRow, Kind extends string> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly recipients: Recipients,
    private readonly kind: ScheduledKind<Row, Kind | 'reminder'>,
  ) {}

  visibleTo(ctx: TenantContext, row: Row): boolean {
    return (
      can(ctx, this.kind.managePermission) ||
      matchesAudience(AudienceSchema.parse(row.audience), ctx)
    );
  }

  target(row: Pick<Row, 'id' | 'societyId'>) {
    return { societyId: row.societyId, entityType: this.kind.entityType, entityId: row.id };
  }

  /** A page of items the viewer may see, by start time (see pageByStart). */
  page(
    ctx: TenantContext,
    query: { when: Timeframe; cursor?: string; limit: number },
    timeWhere: object,
    find: (args: FindArgs) => Promise<Row[]>,
  ) {
    return pageByStart({
      when: query.when,
      cursor: query.cursor,
      limit: query.limit,
      fetch: ({ cursorWhere, orderBy, take }) =>
        find({ where: { AND: [timeWhere, cursorWhere] }, orderBy, take }),
      visible: (row) => this.visibleTo(ctx, row),
    });
  }

  /** Items not over yet that start within UPCOMING_DAYS and the viewer may see. */
  async upcoming(
    ctx: TenantContext,
    now: Date,
    find: (args: FindArgs) => Promise<Row[]>,
    extraWhere: object = {},
  ): Promise<Row[]> {
    const rows = await find({
      where: {
        AND: [
          notOverWhere(now),
          { ...extraWhere, startsAt: { lte: new Date(now.getTime() + days(UPCOMING_DAYS)) } },
        ],
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: 20,
    });
    return rows.filter((row) => this.visibleTo(ctx, row));
  }

  /** After create or a move: windows already open count as sent. */
  resetReminders(row: Row, windows: readonly number[]): Promise<void> {
    return resetReminders(this.prisma, this.target(row), row.startsAt, windows);
  }

  /** Tells the item's audience, except the person who acted. */
  async fanOut(ctx: TenantContext, row: Row, kind: Kind, extra?: string): Promise<void> {
    await this.notifications.notifyUsers({
      userIds: await this.recipients.ofAudience(ctx.societyId, AudienceSchema.parse(row.audience)),
      exceptUserId: ctx.userId,
      societyId: ctx.societyId,
      category: this.kind.category,
      render: (t, locale) => this.kind.push(t, locale, ctx.society.timezone, row, kind, extra),
      data: { screen: this.kind.screen, societyId: ctx.societyId, [this.kind.idKey]: row.id },
    });
  }

  /**
   * Reminder job: at most one reminder per item per run, for the most urgent window that
   * opened. Items of societies with the module switched off are skipped.
   */
  async sendDueReminders(
    now: Date,
    rows: DueRow<Row>[],
    opts: {
      windows: (row: DueRow<Row>) => readonly number[];
      /** Users to leave out, e.g. members who said they will not come. */
      skipUserIds?: (row: DueRow<Row>) => Promise<string[]>;
    },
  ): Promise<number> {
    let sent = 0;
    for (const row of rows) {
      const mod = row.society.modules[0];
      if (mod && !mod.enabled) continue;
      const due = await claimReminder(
        this.prisma,
        this.target(row),
        row.startsAt,
        opts.windows(row),
        now,
      );
      if (due === null) continue;
      const [audience, skipped] = await Promise.all([
        this.recipients.ofAudience(row.societyId, AudienceSchema.parse(row.audience)),
        opts.skipUserIds ? opts.skipUserIds(row) : Promise.resolve([]),
      ]);
      const skip = new Set(skipped);
      await this.notifications.notifyUsers({
        userIds: audience.filter((id) => !skip.has(id)),
        societyId: row.societyId,
        category: this.kind.category,
        render: (t, locale) => this.kind.push(t, locale, row.society.timezone, row, 'reminder'),
        data: { screen: this.kind.screen, societyId: row.societyId, [this.kind.idKey]: row.id },
      });
      sent += 1;
    }
    if (sent > 0) this.kind.logger.log(`sent ${sent} ${this.kind.label} reminder(s)`);
    return sent;
  }
}
