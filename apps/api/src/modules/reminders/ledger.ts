import type { PrismaService } from '../../common/prisma/prisma.service';
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
  prisma: PrismaService,
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

/**
 * Claims the most urgent open window. Returns its hours when a reminder should go out now,
 * or null when nothing is due or that reminder was already sent. The job lock keeps this
 * single-writer.
 */
export async function claimReminder(
  prisma: PrismaService,
  target: Target,
  startsAt: Date,
  windows: readonly number[],
  now: Date,
): Promise<number | null> {
  const open = dueWindows(startsAt, now, windows);
  const smallest = open[0];
  if (smallest === undefined) return null;
  const sent = await prisma.reminderSent.findUnique({
    where: {
      entityType_entityId_kind: {
        entityType: target.entityType,
        entityId: target.entityId,
        kind: reminderKind(smallest),
      },
    },
  });
  if (sent) return null;
  await prisma.reminderSent.createMany({
    data: open.map((h) => ({ ...target, kind: reminderKind(h) })),
    skipDuplicates: true,
  });
  return smallest;
}
