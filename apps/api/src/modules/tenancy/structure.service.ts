import type { Building, Flat, RouteBody, societyContract } from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import type { Prisma } from '../../generated/prisma/client';

const flatInclude = {
  building: true,
  occupancies: { where: { toDate: null }, include: { membership: { include: { user: true } } } },
} satisfies Prisma.FlatInclude;
type FlatRow = Prisma.FlatGetPayload<{ include: typeof flatInclude }>;

export function toFlatDto(f: FlatRow): Flat {
  return {
    id: f.id,
    buildingId: f.buildingId,
    buildingName: f.building?.name ?? null,
    number: f.number,
    floor: f.floor,
    type: f.type,
    areaSqft: f.areaSqft,
    status: f.status,
    occupants: f.occupancies.map((o) => ({
      membershipId: o.membershipId,
      displayName: o.membership.user.displayName,
      relation: o.relation,
      isPrimaryContact: o.isPrimaryContact,
    })),
  };
}

@Injectable()
export class StructureService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  async listBuildings(): Promise<Building[]> {
    const rows = await this.db.building.findMany({
      include: { _count: { select: { flats: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map((b) => ({
      id: b.id,
      name: b.name,
      floorsCount: b.floorsCount,
      sortOrder: b.sortOrder,
      flatCount: b._count.flats,
    }));
  }

  async createBuilding(body: RouteBody<typeof societyContract.createBuilding>): Promise<Building> {
    const count = await this.db.building.count();
    const b = await this.db.building.create({
      data: {
        societyId: requireTenant().societyId,
        name: body.name,
        floorsCount: body.floorsCount ?? null,
        sortOrder: count,
      },
    });
    await this.audit.record({
      action: 'building.created',
      entityType: 'Building',
      entityId: b.id,
      after: { name: b.name },
    });
    return {
      id: b.id,
      name: b.name,
      floorsCount: b.floorsCount,
      sortOrder: b.sortOrder,
      flatCount: 0,
    };
  }

  async updateBuilding(
    buildingId: string,
    body: RouteBody<typeof societyContract.updateBuilding>,
  ): Promise<Building> {
    const before = await this.db.building.findUnique({ where: { id: buildingId } });
    if (!before) throw ApiException.notFound('Building not found');
    const b = await this.db.building.update({
      where: { id: buildingId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.floorsCount !== undefined ? { floorsCount: body.floorsCount } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
      include: { _count: { select: { flats: true } } },
    });
    await this.audit.record({
      action: 'building.updated',
      entityType: 'Building',
      entityId: b.id,
      before: { name: before.name },
      after: { name: b.name },
    });
    return {
      id: b.id,
      name: b.name,
      floorsCount: b.floorsCount,
      sortOrder: b.sortOrder,
      flatCount: b._count.flats,
    };
  }

  async listFlats(buildingId?: string): Promise<Flat[]> {
    const rows = await this.db.flat.findMany({
      where: buildingId ? { buildingId } : {},
      include: flatInclude,
      orderBy: [{ building: { sortOrder: 'asc' } }, { number: 'asc' }],
    });
    return rows.map(toFlatDto);
  }

  async createFlats(body: RouteBody<typeof societyContract.createFlats>): Promise<Flat[]> {
    const buildingIds = [
      ...new Set(body.flats.map((f) => f.buildingId).filter((b): b is string => Boolean(b))),
    ];
    if (buildingIds.length) {
      const found = await this.db.building.count({ where: { id: { in: buildingIds } } });
      if (found !== buildingIds.length) throw ApiException.notFound('Building not found');
    }
    const created = await this.db.flat.createManyAndReturn({
      data: body.flats.map((f) => ({
        societyId: requireTenant().societyId,
        buildingId: f.buildingId ?? null,
        number: f.number,
        floor: f.floor ?? null,
        type: f.type ?? null,
        areaSqft: f.areaSqft ?? null,
      })),
      skipDuplicates: true,
    });
    await this.audit.record({
      action: 'flat.created',
      entityType: 'Flat',
      after: { count: created.length, numbers: created.map((c) => c.number).slice(0, 50) },
    });
    const rows = await this.db.flat.findMany({
      where: { id: { in: created.map((c) => c.id) } },
      include: flatInclude,
      orderBy: { number: 'asc' },
    });
    return rows.map(toFlatDto);
  }

  async updateFlat(
    flatId: string,
    body: RouteBody<typeof societyContract.updateFlat>,
  ): Promise<Flat> {
    const before = await this.db.flat.findUnique({ where: { id: flatId } });
    if (!before) throw ApiException.notFound('Flat not found');
    const f = await this.db.flat.update({
      where: { id: flatId },
      data: {
        ...(body.buildingId !== undefined ? { buildingId: body.buildingId } : {}),
        ...(body.number !== undefined ? { number: body.number } : {}),
        ...(body.floor !== undefined ? { floor: body.floor } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.areaSqft !== undefined ? { areaSqft: body.areaSqft } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
      include: flatInclude,
    });
    await this.audit.record({
      action: 'flat.updated',
      entityType: 'Flat',
      entityId: f.id,
      before: { number: before.number, status: before.status },
      after: { number: f.number, status: f.status },
    });
    return toFlatDto(f);
  }

  async requireFlat(flatId: string) {
    const flat = await this.db.flat.findUnique({
      where: { id: flatId },
      include: { building: true },
    });
    if (!flat) throw ApiException.notFound('Flat not found');
    return flat;
  }
}
