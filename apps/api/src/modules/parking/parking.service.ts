import type {
  MyParking,
  ParkingSlot,
  parkingContract,
  RouteBody,
  RouteQuery,
  Vehicle,
} from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { isUniqueViolation } from '../../common/errors/prisma-errors';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can, type TenantContext } from '../../common/tenant/tenant.types';
import type { Prisma } from '../../generated/prisma/client';
import { toFlatRef } from '../tenancy/mappers';
import { seesAllSlots, seesAllVehicles } from './visibility';

const flatWithBuilding = { include: { building: true } } as const;

const slotInclude = {
  allocations: { where: { toDate: null }, include: { flat: flatWithBuilding } },
} satisfies Prisma.ParkingSlotInclude;
type SlotRow = Prisma.ParkingSlotGetPayload<{ include: typeof slotInclude }>;

const vehicleInclude = { flat: flatWithBuilding } satisfies Prisma.VehicleInclude;
type VehicleRow = Prisma.VehicleGetPayload<{ include: typeof vehicleInclude }>;

const byCode = (a: { code: string }, b: { code: string }) =>
  a.code.localeCompare(b.code, 'en', { numeric: true });

export function toSlotDto(s: SlotRow): ParkingSlot {
  const a = s.allocations[0];
  return {
    id: s.id,
    code: s.code,
    type: s.type,
    level: s.level,
    status: s.status,
    allocation: a
      ? {
          id: a.id,
          flat: toFlatRef(a.flat),
          fromDate: a.fromDate.toISOString(),
          notes: a.notes,
        }
      : null,
  };
}

export function toVehicleDto(v: VehicleRow): Vehicle {
  return {
    id: v.id,
    flat: toFlatRef(v.flat),
    registrationNo: v.registrationNo,
    type: v.type,
    makeModel: v.makeModel,
    color: v.color,
    createdAt: v.createdAt.toISOString(),
  };
}

@Injectable()
export class ParkingService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  async mine(): Promise<MyParking> {
    const ctx = requireTenant();
    const [flats, slots, vehicles] = await Promise.all([
      this.db.flat.findMany({ where: { id: { in: ctx.flatIds } }, include: { building: true } }),
      this.db.parkingSlot.findMany({
        where: { allocations: { some: { toDate: null, flatId: { in: ctx.flatIds } } } },
        include: slotInclude,
      }),
      this.db.vehicle.findMany({
        where: { flatId: { in: ctx.flatIds } },
        include: vehicleInclude,
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return {
      flats: ctx.flatIds
        .map((id) => flats.find((f) => f.id === id))
        .filter((f): f is NonNullable<typeof f> => Boolean(f))
        .map((f) => ({
          flat: toFlatRef(f),
          slots: slots
            .filter((s) => s.allocations[0]?.flatId === f.id)
            .sort(byCode)
            .map(toSlotDto),
          vehicles: vehicles.filter((v) => v.flatId === f.id).map(toVehicleDto),
        })),
      canSeeAll: seesAllSlots(ctx),
    };
  }

  async listSlots(query: RouteQuery<typeof parkingContract.listSlots>): Promise<ParkingSlot[]> {
    const ctx = requireTenant();
    if (!seesAllSlots(ctx)) throw ApiException.forbidden();
    const rows = await this.db.parkingSlot.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.free === 'true' ? { allocations: { none: { toDate: null } } } : {}),
        ...(query.free === 'false' ? { allocations: { some: { toDate: null } } } : {}),
      },
      include: slotInclude,
    });
    return rows.sort(byCode).map(toSlotDto);
  }

  async createSlots(body: RouteBody<typeof parkingContract.createSlots>): Promise<ParkingSlot[]> {
    const ctx = requireTenant();
    const codes = body.slots.map((s) => s.code.toUpperCase());
    if (new Set(codes).size !== codes.length)
      throw ApiException.validation([{ path: ['slots'], message: 'Slot codes repeat' }]);
    const created = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.parkingSlot.createManyAndReturn({
        data: body.slots.map((s, i) => ({
          societyId: ctx.societyId,
          code: codes[i] ?? s.code,
          type: s.type,
          level: s.level ?? null,
        })),
      });
      await this.audit.record(
        {
          action: 'parking.slot.created',
          entityType: 'ParkingSlot',
          after: { codes },
        },
        tx,
      );
      return rows;
    });
    return created
      .map((s) => ({ ...s, allocations: [] }))
      .sort(byCode)
      .map(toSlotDto);
  }

  async updateSlot(
    slotId: string,
    body: RouteBody<typeof parkingContract.updateSlot>,
  ): Promise<ParkingSlot> {
    const before = await this.requireSlot(slotId);
    const row = await this.db.parkingSlot.update({
      where: { id: slotId },
      data: {
        ...(body.code !== undefined ? { code: body.code.toUpperCase() } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.level !== undefined ? { level: body.level } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
      include: slotInclude,
    });
    await this.audit.record({
      action: 'parking.slot.updated',
      entityType: 'ParkingSlot',
      entityId: slotId,
      before: { code: before.code, type: before.type, status: before.status },
      after: { code: row.code, type: row.type, status: row.status },
    });
    return toSlotDto(row);
  }

  async allocate(
    slotId: string,
    body: RouteBody<typeof parkingContract.allocate>,
  ): Promise<ParkingSlot> {
    const ctx = requireTenant();
    const slot = await this.requireSlot(slotId);
    if (slot.status === 'BLOCKED')
      throw ApiException.conflict('CONFLICT', 'A blocked slot cannot be given to a flat');
    if (slot.allocations.length > 0)
      throw ApiException.conflict('SLOT_TAKEN', 'This slot already belongs to a flat');
    const flat = await this.db.flat.findUnique({ where: { id: body.flatId } });
    if (!flat) throw ApiException.notFound('Flat not found');
    try {
      await this.prisma.$transaction(async (tx) => {
        const a = await tx.parkingAllocation.create({
          data: {
            societyId: ctx.societyId,
            slotId,
            flatId: body.flatId,
            notes: body.notes ?? null,
            allocatedByMembershipId: ctx.membershipId,
          },
        });
        await this.audit.record(
          {
            action: 'parking.allocated',
            entityType: 'ParkingSlot',
            entityId: slotId,
            after: { allocationId: a.id, flatId: body.flatId, code: slot.code },
          },
          tx,
        );
      });
    } catch (e) {
      if (isUniqueViolation(e))
        throw ApiException.conflict('SLOT_TAKEN', 'This slot already belongs to a flat');
      throw e;
    }
    return toSlotDto(await this.requireSlot(slotId));
  }

  /** Idempotent: freeing a free slot returns it unchanged. */
  async release(slotId: string): Promise<ParkingSlot> {
    const ctx = requireTenant();
    const slot = await this.requireSlot(slotId);
    const active = slot.allocations[0];
    if (!active) return toSlotDto(slot);
    await this.prisma.$transaction(async (tx) => {
      await tx.parkingAllocation.updateMany({
        where: { id: active.id, societyId: ctx.societyId, toDate: null },
        data: { toDate: new Date() },
      });
      await this.audit.record(
        {
          action: 'parking.released',
          entityType: 'ParkingSlot',
          entityId: slotId,
          before: { allocationId: active.id, flatId: active.flatId, code: slot.code },
        },
        tx,
      );
    });
    return toSlotDto(await this.requireSlot(slotId));
  }

  async listVehicles(query: RouteQuery<typeof parkingContract.listVehicles>): Promise<Vehicle[]> {
    const ctx = requireTenant();
    const all = seesAllVehicles(ctx);
    if (query.flatId && !all && !ctx.flatIds.includes(query.flatId)) return [];
    const flatFilter = query.flatId
      ? { flatId: query.flatId }
      : all
        ? {}
        : { flatId: { in: ctx.flatIds } };
    const q = query.q ? query.q.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
    const rows = await this.db.vehicle.findMany({
      where: { ...flatFilter, ...(q ? { registrationNo: { contains: q } } : {}) },
      include: vehicleInclude,
      orderBy: { registrationNo: 'asc' },
      take: 200,
    });
    return rows.map(toVehicleDto);
  }

  async createVehicle(body: RouteBody<typeof parkingContract.createVehicle>): Promise<Vehicle> {
    const ctx = requireTenant();
    this.assertOwnFlatOrManager(ctx, body.flatId);
    const flat = await this.db.flat.findUnique({ where: { id: body.flatId } });
    if (!flat) throw ApiException.notFound('Flat not found');
    await this.assertRegistrationFree(body.registrationNo);
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const v = await tx.vehicle.create({
          data: {
            societyId: ctx.societyId,
            flatId: body.flatId,
            registrationNo: body.registrationNo,
            type: body.type,
            makeModel: body.makeModel ?? null,
            color: body.color ?? null,
          },
          include: vehicleInclude,
        });
        await this.audit.record(
          {
            action: 'vehicle.created',
            entityType: 'Vehicle',
            entityId: v.id,
            after: { registrationNo: v.registrationNo, flatId: v.flatId },
          },
          tx,
        );
        return v;
      });
      return toVehicleDto(row);
    } catch (e) {
      if (isUniqueViolation(e))
        throw ApiException.conflict('VEHICLE_EXISTS', 'This vehicle is already registered');
      throw e;
    }
  }

  async updateVehicle(
    vehicleId: string,
    body: RouteBody<typeof parkingContract.updateVehicle>,
  ): Promise<Vehicle> {
    const ctx = requireTenant();
    const before = await this.requireVehicle(vehicleId);
    this.assertOwnFlatOrManager(ctx, before.flatId);
    if (body.registrationNo && body.registrationNo !== before.registrationNo)
      await this.assertRegistrationFree(body.registrationNo);
    try {
      const v = await this.db.vehicle.update({
        where: { id: vehicleId },
        data: {
          ...(body.registrationNo !== undefined ? { registrationNo: body.registrationNo } : {}),
          ...(body.type !== undefined ? { type: body.type } : {}),
          ...(body.makeModel !== undefined ? { makeModel: body.makeModel } : {}),
          ...(body.color !== undefined ? { color: body.color } : {}),
        },
        include: vehicleInclude,
      });
      await this.audit.record({
        action: 'vehicle.updated',
        entityType: 'Vehicle',
        entityId: v.id,
        before: { registrationNo: before.registrationNo },
        after: { registrationNo: v.registrationNo },
      });
      return toVehicleDto(v);
    } catch (e) {
      if (isUniqueViolation(e))
        throw ApiException.conflict('VEHICLE_EXISTS', 'This vehicle is already registered');
      throw e;
    }
  }

  async deleteVehicle(vehicleId: string): Promise<void> {
    const ctx = requireTenant();
    const v = await this.requireVehicle(vehicleId);
    this.assertOwnFlatOrManager(ctx, v.flatId);
    await this.prisma.$transaction(async (tx) => {
      await tx.vehicle.deleteMany({ where: { id: vehicleId, societyId: ctx.societyId } });
      await this.audit.record(
        {
          action: 'vehicle.deleted',
          entityType: 'Vehicle',
          entityId: vehicleId,
          before: { registrationNo: v.registrationNo, flatId: v.flatId },
        },
        tx,
      );
    });
  }

  private assertOwnFlatOrManager(ctx: TenantContext, flatId: string): void {
    if (!ctx.flatIds.includes(flatId) && !can(ctx, 'parking.manage'))
      throw ApiException.forbidden('You can only manage vehicles of your own flat');
  }

  private async assertRegistrationFree(registrationNo: string): Promise<void> {
    const hit = await this.db.vehicle.findFirst({ where: { registrationNo } });
    if (hit) throw ApiException.conflict('VEHICLE_EXISTS', 'This vehicle is already registered');
  }

  private async requireSlot(slotId: string): Promise<SlotRow> {
    const s = await this.db.parkingSlot.findUnique({ where: { id: slotId }, include: slotInclude });
    if (!s) throw ApiException.notFound('Slot not found');
    return s;
  }

  private async requireVehicle(vehicleId: string): Promise<VehicleRow> {
    const v = await this.db.vehicle.findUnique({
      where: { id: vehicleId },
      include: vehicleInclude,
    });
    if (!v) throw ApiException.notFound('Vehicle not found');
    return v;
  }
}
