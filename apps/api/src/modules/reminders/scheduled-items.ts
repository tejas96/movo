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
import { audienceWhere, matchesAudience } from '../notices/audience';
import type { NotificationsService } from '../notifications/notifications.service';
import type { Recipients } from '../notifications/recipients.service';
import { type ReminderEntity, resetReminders } from './ledger';
import { dueWindows, notOverWhere, pageByStart, reminderKind, UPCOMING_DAYS } from './schedule';

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

  /** Where for the items the viewer may see: everything for managers, else their audience. */
  visibleWhere(ctx: TenantContext): object {
    return can(ctx, this.kind.managePermission) ? {} : audienceWhere(ctx);
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
        find({ where: { AND: [timeWhere, cursorWhere, this.visibleWhere(ctx)] }, orderBy, take }),
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
          this.visibleWhere(ctx),
        ],
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: 20,
    });
    return rows;
  }

  /** After create or a move, in the same transaction: windows already open count as sent. */
  resetReminders(tx: Prisma.TransactionClient, row: Row, windows: readonly number[]) {
    return resetReminders(tx, this.target(row), row.startsAt, windows);
  }

  /**
   * Tells the item's audience, except the person who acted. The push is written in `tx`, the
   * transaction that made the change.
   */
  async fanOut(
    tx: Prisma.TransactionClient,
    ctx: TenantContext,
    row: Row,
    kind: Kind,
    extra?: string,
  ): Promise<void> {
    await this.notifications.notifyUsers(
      {
        userIds: await this.recipients
          .in(tx)
          .ofAudience(ctx.societyId, AudienceSchema.parse(row.audience)),
        exceptUserId: ctx.userId,
        societyId: ctx.societyId,
        category: this.kind.category,
        render: (t, locale) => this.kind.push(t, locale, ctx.society.timezone, row, kind, extra),
        data: { screen: this.kind.screen, societyId: ctx.societyId, [this.kind.idKey]: row.id },
      },
      tx,
    );
  }

  /**
   * Reminder job: at most one reminder per item per run, for the most urgent window that
   * opened. Items of societies with the module switched off are skipped. Per society: one
   * read of the reminders already sent, one audience lookup per distinct audience, then the
   * ReminderSent rows and the pushes in one transaction.
   */
  async sendDueReminders(
    now: Date,
    rows: DueRow<Row>[],
    opts: {
      windows: (row: DueRow<Row>) => readonly number[];
      /** Users to leave out per item id, e.g. members who said they will not come. */
      skipUserIds?: (rows: DueRow<Row>[]) => Promise<Map<string, string[]>>;
    },
  ): Promise<number> {
    const bySociety = new Map<string, DueRow<Row>[]>();
    for (const row of rows) {
      const mod = row.society.modules[0];
      if (mod && !mod.enabled) continue;
      bySociety.set(row.societyId, [...(bySociety.get(row.societyId) ?? []), row]);
    }
    let sent = 0;
    for (const list of bySociety.values()) sent += await this.remindSociety(now, list, opts);
    if (sent > 0) this.kind.logger.log(`sent ${sent} ${this.kind.label} reminder(s)`);
    return sent;
  }

  private async remindSociety(
    now: Date,
    rows: DueRow<Row>[],
    opts: {
      windows: (row: DueRow<Row>) => readonly number[];
      skipUserIds?: (rows: DueRow<Row>[]) => Promise<Map<string, string[]>>;
    },
  ): Promise<number> {
    // The smallest open window is the reminder to send; larger open ones are marked sent with it.
    const due = rows.flatMap((row) => {
      const open = dueWindows(row.startsAt, now, opts.windows(row));
      const smallest = open[0];
      return smallest === undefined ? [] : [{ row, open, kind: reminderKind(smallest) }];
    });
    if (due.length === 0) return 0;
    const already = new Set(
      (
        await this.prisma.reminderSent.findMany({
          where: { entityType: this.kind.entityType, entityId: { in: due.map((d) => d.row.id) } },
          select: { entityId: true, kind: true },
        })
      ).map((r) => `${r.entityId}|${r.kind}`),
    );
    const toSend = due.filter((d) => !already.has(`${d.row.id}|${d.kind}`));
    if (toSend.length === 0) return 0;

    const audiences = new Map<string, Promise<string[]>>();
    const audienceOf = (row: DueRow<Row>) => {
      const audience = AudienceSchema.parse(row.audience);
      const key = JSON.stringify(audience);
      let users = audiences.get(key);
      if (!users) {
        users = this.recipients.ofAudience(row.societyId, audience);
        audiences.set(key, users);
      }
      return users;
    };
    const sendRows = toSend.map((d) => d.row);
    const [userIds, skipped] = await Promise.all([
      Promise.all(sendRows.map(audienceOf)),
      opts.skipUserIds ? opts.skipUserIds(sendRows) : Promise.resolve(new Map<string, string[]>()),
    ]);

    await this.prisma.$transaction(
      async (tx) => {
        await tx.reminderSent.createMany({
          data: toSend.flatMap((d) =>
            d.open.map((h) => ({ ...this.target(d.row), kind: reminderKind(h) })),
          ),
          skipDuplicates: true,
        });
        await this.notifications.notifyMany(
          sendRows.map((row, i) => {
            const skip = new Set(skipped.get(row.id) ?? []);
            return {
              userIds: (userIds[i] ?? []).filter((id) => !skip.has(id)),
              societyId: row.societyId,
              category: this.kind.category,
              render: (t: TFunction, locale: Locale) =>
                this.kind.push(t, locale, row.society.timezone, row, 'reminder'),
              data: {
                screen: this.kind.screen,
                societyId: row.societyId,
                [this.kind.idKey]: row.id,
              },
            };
          }),
          tx,
        );
      },
      { timeout: 60_000 },
    );
    return toSend.length;
  }
}
