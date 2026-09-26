import {
  type BillingPlan,
  LateFeeRuleSchema,
  type maintenanceContract,
  type PaymentInstruction,
  type RouteBody,
  UPI_ID,
} from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can } from '../../common/tenant/tenant.types';
import type { Prisma } from '../../generated/prisma/client';
import { toFlatRef } from '../tenancy/mappers';
import { dateOnly, dbDate, toInstruction } from './ledger';

type PlanBody = RouteBody<typeof maintenanceContract.createPlan>;
type PlanPatch = RouteBody<typeof maintenanceContract.updatePlan>;
type InstructionBody = RouteBody<typeof maintenanceContract.createInstruction>;
type InstructionPatch = RouteBody<typeof maintenanceContract.updateInstruction>;

const planInclude = {
  overrides: { include: { flat: { include: { building: true } } } },
} satisfies Prisma.BillingPlanInclude;
type PlanRow = Prisma.BillingPlanGetPayload<{ include: typeof planInclude }>;

/** Billing plans and "how to pay" details: the treasurer's settings. */
@Injectable()
export class PlansService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  async listPlans(): Promise<BillingPlan[]> {
    const rows = await this.db.billingPlan.findMany({
      include: planInclude,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map(toPlan);
  }

  async createPlan(body: PlanBody): Promise<BillingPlan> {
    const ctx = requireTenant();
    checkDates(body.activeFrom, body.activeTo ?? null);
    const row = await this.db.billingPlan.create({
      data: {
        societyId: ctx.societyId,
        name: body.name,
        frequency: body.frequency,
        amountRule: body.amountRule,
        amountPaise: body.amountPaise,
        dueDay: body.dueDay,
        generateDaysBefore: body.generateDaysBefore,
        lateFee: body.lateFee as Prisma.InputJsonValue,
        activeFrom: dbDate(body.activeFrom),
        activeTo: body.activeTo ? dbDate(body.activeTo) : null,
        isActive: body.isActive,
      },
      include: planInclude,
    });
    await this.audit.record({
      action: 'billing_plan.created',
      entityType: 'BillingPlan',
      entityId: row.id,
      after: { name: row.name, amountPaise: row.amountPaise, frequency: row.frequency },
    });
    return toPlan(row);
  }

  async updatePlan(planId: string, body: PlanPatch): Promise<BillingPlan> {
    const before = await this.requirePlan(planId);
    const activeFrom = body.activeFrom ?? dateOnly(before.activeFrom);
    const activeTo =
      body.activeTo !== undefined
        ? body.activeTo
        : before.activeTo
          ? dateOnly(before.activeTo)
          : null;
    checkDates(activeFrom, activeTo);
    const row = await this.db.billingPlan.update({
      where: { id: planId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.frequency !== undefined ? { frequency: body.frequency } : {}),
        ...(body.amountRule !== undefined ? { amountRule: body.amountRule } : {}),
        ...(body.amountPaise !== undefined ? { amountPaise: body.amountPaise } : {}),
        ...(body.dueDay !== undefined ? { dueDay: body.dueDay } : {}),
        ...(body.generateDaysBefore !== undefined
          ? { generateDaysBefore: body.generateDaysBefore }
          : {}),
        ...(body.lateFee !== undefined ? { lateFee: body.lateFee as Prisma.InputJsonValue } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        activeFrom: dbDate(activeFrom),
        activeTo: activeTo ? dbDate(activeTo) : null,
      },
      include: planInclude,
    });
    await this.audit.record({
      action: 'billing_plan.updated',
      entityType: 'BillingPlan',
      entityId: planId,
      before: { amountPaise: before.amountPaise, isActive: before.isActive },
      after: { amountPaise: row.amountPaise, isActive: row.isActive },
    });
    return toPlan(row);
  }

  async setOverride(
    planId: string,
    flatId: string,
    amountPaise: number | null,
  ): Promise<BillingPlan> {
    await this.requirePlan(planId);
    const flat = await this.db.flat.findUnique({ where: { id: flatId } });
    if (!flat) throw ApiException.notFound('Flat not found');
    if (amountPaise === null) {
      await this.db.flatChargeOverride.deleteMany({ where: { planId, flatId } });
    } else {
      await this.db.flatChargeOverride.upsert({
        where: { planId_flatId: { planId, flatId } },
        update: { amountPaise },
        create: { planId, flatId, societyId: flat.societyId, amountPaise },
      });
    }
    await this.audit.record({
      action: 'billing_plan.override_set',
      entityType: 'BillingPlan',
      entityId: planId,
      after: { flatId, amountPaise },
    });
    return toPlan(await this.requirePlan(planId));
  }

  async listInstructions(): Promise<PaymentInstruction[]> {
    const ctx = requireTenant();
    const rows = await this.db.paymentInstruction.findMany({
      where: can(ctx, 'maintenance.settings.manage') ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toInstruction);
  }

  async createInstruction(body: InstructionBody): Promise<PaymentInstruction> {
    const ctx = requireTenant();
    checkUpi(body.kind, body.value);
    const count = await this.db.paymentInstruction.count();
    const row = await this.db.paymentInstruction.create({
      data: {
        societyId: ctx.societyId,
        kind: body.kind,
        label: body.label,
        value: body.value,
        payeeName: body.payeeName || null,
        isActive: body.isActive,
        sortOrder: count,
      },
    });
    await this.audit.record({
      action: 'payment_instruction.created',
      entityType: 'PaymentInstruction',
      entityId: row.id,
      after: { kind: row.kind, label: row.label },
    });
    return toInstruction(row);
  }

  async updateInstruction(id: string, body: InstructionPatch): Promise<PaymentInstruction> {
    const before = await this.db.paymentInstruction.findUnique({ where: { id } });
    if (!before) throw ApiException.notFound('Payment detail not found');
    if (body.value !== undefined) checkUpi(before.kind, body.value);
    const row = await this.db.paymentInstruction.update({
      where: { id },
      data: {
        ...(body.label !== undefined ? { label: body.label } : {}),
        ...(body.value !== undefined ? { value: body.value } : {}),
        ...(body.payeeName !== undefined ? { payeeName: body.payeeName || null } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });
    await this.audit.record({
      action: 'payment_instruction.updated',
      entityType: 'PaymentInstruction',
      entityId: id,
      after: { label: row.label, isActive: row.isActive },
    });
    return toInstruction(row);
  }

  async deleteInstruction(id: string): Promise<void> {
    const { count } = await this.db.paymentInstruction.deleteMany({ where: { id } });
    if (count === 0) throw ApiException.notFound('Payment detail not found');
    await this.audit.record({
      action: 'payment_instruction.deleted',
      entityType: 'PaymentInstruction',
      entityId: id,
    });
  }

  private async requirePlan(planId: string): Promise<PlanRow> {
    const plan = await this.db.billingPlan.findUnique({
      where: { id: planId },
      include: planInclude,
    });
    if (!plan) throw ApiException.notFound('Plan not found');
    return plan;
  }
}

function checkDates(from: string, to: string | null) {
  if (to && to < from)
    throw ApiException.validation([
      { path: ['activeTo'], message: 'Must be after the start', in: 'body' },
    ]);
}

function checkUpi(kind: string, value: string) {
  if (kind === 'UPI' && !UPI_ID.test(value.trim()))
    throw ApiException.validation([
      { path: ['value'], message: 'A UPI id looks like name@bank', in: 'body' },
    ]);
}

function toPlan(p: PlanRow): BillingPlan {
  return {
    id: p.id,
    name: p.name,
    frequency: p.frequency,
    amountRule: p.amountRule,
    amountPaise: p.amountPaise,
    dueDay: p.dueDay,
    generateDaysBefore: p.generateDaysBefore,
    lateFee: LateFeeRuleSchema.parse(p.lateFee),
    activeFrom: dateOnly(p.activeFrom),
    activeTo: p.activeTo ? dateOnly(p.activeTo) : null,
    isActive: p.isActive,
    overrides: p.overrides
      .map((o) => ({ flat: toFlatRef(o.flat), amountPaise: o.amountPaise }))
      .sort((a, b) => a.flat.number.localeCompare(b.flat.number, undefined, { numeric: true })),
    createdAt: p.createdAt.toISOString(),
  };
}
