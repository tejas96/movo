import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../generated/prisma/client';
import { currentTenant } from '../request-store';
import { PrismaService } from './prisma.service';

/** Models that carry a societyId and must always be filtered by it. */
export const TENANT_MODELS: ReadonlySet<string> = new Set([
  'Building',
  'Flat',
  'Membership',
  'Role',
  'FlatOccupancy',
  'Invitation',
  'JoinRequest',
  'SocietyModule',
  'Notice',
  'ParkingSlot',
  'ParkingAllocation',
  'Vehicle',
  'VendorCategory',
  'Vendor',
  'EmergencyContact',
  'Alert',
]);

const READ_OPS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);
const WRITE_WHERE_OPS = new Set(['update', 'updateMany', 'delete', 'deleteMany', 'upsert']);
const CREATE_OPS = new Set(['create', 'createMany', 'createManyAndReturn']);

type AnyArgs = Record<string, unknown> & {
  where?: Record<string, unknown>;
  data?: unknown;
  create?: unknown;
};

function injectWhere(args: AnyArgs, societyId: string): void {
  args.where = { ...(args.where ?? {}), societyId };
}

function injectData(data: unknown, societyId: string): unknown {
  if (Array.isArray(data)) return data.map((d) => ({ ...(d as object), societyId }));
  if (data && typeof data === 'object') return { ...(data as object), societyId };
  return data;
}

/**
 * Lock 1 of tenant isolation. Every query on a tenant model gets `societyId` from the request
 * context. No context = error, never a cross-tenant read.
 */
@Injectable()
export class TenantPrismaService {
  readonly client: PrismaClient;

  constructor(prisma: PrismaService) {
    this.client = prisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!TENANT_MODELS.has(model)) return query(args);
            const tenant = currentTenant();
            if (!tenant)
              throw new Error(
                `Tenant-scoped query on ${model}.${operation} without a tenant context`,
              );
            const a = args as AnyArgs;
            if (READ_OPS.has(operation) || WRITE_WHERE_OPS.has(operation))
              injectWhere(a, tenant.societyId);
            if (CREATE_OPS.has(operation)) a.data = injectData(a.data, tenant.societyId);
            if (operation === 'upsert') a.create = injectData(a.create, tenant.societyId);
            return query(a);
          },
        },
      },
    }) as unknown as PrismaClient;
  }
}
