import { formatDate } from '@movo/i18n';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { dateOnly, dbDate } from '../../common/util/dates';
import { NotificationsService } from '../notifications/notifications.service';
import { Recipients } from '../notifications/recipients.service';
import { type DutyRow, type DutyWithParticipants, participantIdOf } from './duty-plan';

/** Starting turns and telling participants, used by requests and by the hourly job. */
@Injectable()
export class DutyTurns {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly recipients: Recipients,
  ) {}

  /** Starts turns whose first day has come and tells the participant. */
  async activate(duty: DutyWithParticipants, today: string): Promise<number> {
    const rows = await this.prisma.responsibilityAssignment.findMany({
      where: {
        responsibilityId: duty.id,
        status: 'UPCOMING',
        periodStart: { lte: dbDate(today) },
      },
    });
    for (const r of rows) {
      await this.prisma.responsibilityAssignment.update({
        where: { id: r.id },
        data: { status: 'ACTIVE' },
      });
      await this.tell(duty, participantIdOf(r), 'start', dateOnly(r.periodEnd));
    }
    return rows.length;
  }

  async tell(
    duty: DutyRow,
    participantId: string,
    kind: 'start' | 'remind' | 'missed',
    endDate: string,
  ) {
    await this.notifications.notifyUsers({
      userIds:
        duty.participantKind === 'FLAT'
          ? await this.recipients.ofFlat(participantId)
          : await this.recipients.ofMemberships([participantId], { activeOnly: true }),
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
    });
  }
}
