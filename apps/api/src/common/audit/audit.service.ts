import type { AuditAction } from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getStore } from '../request-store';

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  societyId?: string | null;
  before?: unknown;
  after?: unknown;
}

type Client = Pick<PrismaService, 'auditLog'> | Prisma.TransactionClient;

/** Append-only. Call it inside the same transaction as the change it records. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, client: Client = this.prisma): Promise<void> {
    const store = getStore();
    await client.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        societyId: entry.societyId ?? store?.tenant?.societyId ?? null,
        actorUserId: store?.user?.id ?? null,
        actorMembershipId: store?.tenant?.membershipId ?? null,
        ...(entry.before === undefined ? {} : { before: entry.before as Prisma.InputJsonValue }),
        ...(entry.after === undefined ? {} : { after: entry.after as Prisma.InputJsonValue }),
        requestId: store?.requestId ?? null,
        ip: store?.ip ?? null,
      },
    });
  }
}
