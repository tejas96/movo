import { formatDate } from '@movo/i18n';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { dateOnly, dbDate } from '../../common/util/dates';
import { NotificationsService } from '../notifications/notifications.service';
import { Recipients } from '../notifications/recipients.service';
import { type DutyRow, type DutyWithParticipants, participantIdOf, type Tx } from './duty-plan';

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
    for (const r of rows) {
      await db.responsibilityAssignment.update({
        where: { id: r.id },
        data: { status: 'ACTIVE' },
      });
      await this.tell(duty, participantIdOf(r), 'start', dateOnly(r.periodEnd), tx);
    }
    return rows.length;
  }

  async tell(
    duty: DutyRow,
    participantId: string,
    kind: 'start' | 'remind' | 'missed',
    endDate: string,
    tx?: Tx,
  ) {
    const recipients = tx ? this.recipients.in(tx) : this.recipients;
    await this.notifications.notifyUsers(
      {
        userIds:
          duty.participantKind === 'FLAT'
            ? await recipients.ofFlat(participantId)
            : await recipients.ofMemberships([participantId], { activeOnly: true }),
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
      },
      tx,
    );
  }
}
