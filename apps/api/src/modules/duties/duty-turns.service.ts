import { formatDate } from '@movo/i18n';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { dateOnly, dbDate } from '../../common/util/dates';
import { NotificationsService, type NotifyInput } from '../notifications/notifications.service';
import { Recipients } from '../notifications/recipients.service';
import { type DutyRow, type DutyWithParticipants, participantIdOf, type Tx } from './duty-plan';

export type TellKind = 'start' | 'remind' | 'missed';
export interface Tell {
  duty: DutyRow;
  participantId: string;
  kind: TellKind;
  endDate: string;
}

/**
 * Starting turns and telling participants, used by requests and by the hourly job. Requests
 * pass their transaction, so the turn change and its push commit together.
 */
@Injectable()
export class DutyTurns {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly recipients: Recipients,
  ) {}

  /** Starts turns whose first day has come and tells the participant. */
  async activate(duty: DutyWithParticipants, today: string, tx?: Tx): Promise<number> {
    const db = tx ?? this.prisma;
    const rows = await db.responsibilityAssignment.findMany({
      where: {
        responsibilityId: duty.id,
        status: 'UPCOMING',
        periodStart: { lte: dbDate(today) },
      },
    });
    if (rows.length === 0) return 0;
    await db.responsibilityAssignment.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { status: 'ACTIVE' },
    });
    await this.tellMany(
      rows.map((r) => ({
        duty,
        participantId: participantIdOf(r),
        kind: 'start' as const,
        endDate: dateOnly(r.periodEnd),
      })),
      tx,
    );
    return rows.length;
  }

  tell(duty: DutyRow, participantId: string, kind: TellKind, endDate: string, tx?: Tx) {
    return this.tellMany([{ duty, participantId, kind, endDate }], tx);
  }

  /** Pushes for many turns with two recipient lookups and one notification write. */
  async tellMany(items: readonly Tell[], tx?: Tx): Promise<void> {
    if (items.length === 0) return;
    const recipients = tx ? this.recipients.in(tx) : this.recipients;
    const flatIds = items.filter((i) => i.duty.participantKind === 'FLAT');
    const memberIds = items.filter((i) => i.duty.participantKind !== 'FLAT');
    const byFlat = flatIds.length
      ? await recipients.ofFlats(flatIds.map((i) => i.participantId))
      : new Map<string, string[]>();
    const byMember = memberIds.length
      ? await recipients.byMembership(
          memberIds.map((i) => i.participantId),
          { activeOnly: true },
        )
      : new Map<string, string>();
    const inputs = items.map((i) => {
      const member = byMember.get(i.participantId);
      const userIds =
        i.duty.participantKind === 'FLAT'
          ? (byFlat.get(i.participantId) ?? [])
          : member
            ? [member]
            : [];
      return this.push(i, userIds);
    });
    await this.notifications.notifyMany(inputs, tx);
  }

  private push({ duty, kind, endDate }: Tell, userIds: string[]): NotifyInput {
    return {
      userIds,
      societyId: duty.societyId,
      category: 'DUTY',
      render: (t, locale) => {
        const date = formatDate(dbDate(endDate), locale, 'short', 'UTC');
        return kind === 'start'
          ? {
              title: t('duties:push.startTitle', { title: duty.title }),
              body: t('duties:push.startBody', { date }),
            }
          : kind === 'remind'
            ? {
                title: t('duties:push.remindTitle', { title: duty.title }),
                body: t('duties:push.remindBody', { date }),
              }
            : {
                title: t('duties:push.missedTitle', { title: duty.title }),
                body: t('duties:push.missedBody', { date }),
              };
      },
      data: { screen: 'duty', societyId: duty.societyId, dutyId: duty.id },
    };
  }
}
