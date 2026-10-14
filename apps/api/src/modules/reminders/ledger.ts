import type { PrismaService } from '../../common/prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { dueWindows, reminderKind } from './schedule';

export type ReminderEntity = 'Meeting' | 'Event';

interface Target {
  societyId: string;
  entityType: ReminderEntity;
  entityId: string;
}

/**
 * Called when an item is created or moved. Windows that are already open are marked sent,
 * because the "scheduled" or "moved" push already told everyone.
 */
export async function resetReminders(
  prisma: Pick<PrismaService, 'reminderSent'> | Prisma.TransactionClient,
  target: Target,
  startsAt: Date,
  windows: readonly number[],
  now = new Date(),
): Promise<void> {
  await prisma.reminderSent.deleteMany({
    where: { entityType: target.entityType, entityId: target.entityId },
  });
  const open = dueWindows(startsAt, now, windows);
  if (open.length === 0) return;
  await prisma.reminderSent.createMany({
    data: open.map((h) => ({ ...target, kind: reminderKind(h) })),
    skipDuplicates: true,
  });
}
