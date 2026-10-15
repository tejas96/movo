import { expensesContract, type IncomeEntry, type RouteBody } from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { mayCall, type TenantContext } from '../../common/tenant/tenant.types';
import { dateOnly, dbDate, fyLabel, todayIn } from '../../common/util/dates';
import { loadMemberNames } from '../tenancy/member-names';
import { checkNotFuture } from './expense-rules';

type IncomeBody = RouteBody<typeof expensesContract.createIncome>;

/** Money the society received outside maintenance (hall rent, interest, donations). */
@Injectable()
export class IncomeService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  async listIncome(fy: string | undefined): Promise<IncomeEntry[]> {
    const ctx = requireTenant();
    const year = fy ?? fyLabel(todayIn(ctx.society.timezone), ctx.society.fyStartMonth);
    const rows = await this.db.incomeEntry.findMany({
      where: { financialYear: year },
      orderBy: [{ receivedOn: 'desc' }, { createdAt: 'desc' }],
    });
    const names = await loadMemberNames(
      this.prisma,
      rows.map((r) => r.createdByMembershipId),
    );
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      amountPaise: r.amountPaise,
      receivedOn: dateOnly(r.receivedOn),
      description: r.description,
      createdBy: {
        membershipId: r.createdByMembershipId,
        displayName: names.get(r.createdByMembershipId)?.displayName ?? 'Committee',
      },
      createdAt: r.createdAt.toISOString(),
      canRemove: mayRemoveIncome(ctx),
    }));
  }

  async createIncome(body: IncomeBody): Promise<IncomeEntry> {
    const ctx = requireTenant();
    checkNotFuture(ctx, body.receivedOn);
    const row = await this.db.incomeEntry.create({
      data: {
        societyId: ctx.societyId,
        kind: body.kind,
        amountPaise: body.amountPaise,
        receivedOn: dbDate(body.receivedOn),
        description: body.description || null,
        financialYear: fyLabel(body.receivedOn, ctx.society.fyStartMonth),
        createdByMembershipId: ctx.membershipId,
      },
    });
    await this.audit.record({
      action: 'income.created',
      entityType: 'IncomeEntry',
      entityId: row.id,
      after: { kind: row.kind, amountPaise: row.amountPaise },
    });
    const names = await loadMemberNames(this.prisma, [ctx.membershipId]);
    return {
      id: row.id,
      kind: row.kind,
      amountPaise: row.amountPaise,
      receivedOn: dateOnly(row.receivedOn),
      description: row.description,
      createdBy: {
        membershipId: ctx.membershipId,
        displayName: names.get(ctx.membershipId)?.displayName ?? 'Committee',
      },
      createdAt: row.createdAt.toISOString(),
      canRemove: mayRemoveIncome(ctx),
    };
  }

  async deleteIncome(id: string): Promise<void> {
    const row = await this.db.incomeEntry.findUnique({ where: { id } });
    if (!row) throw ApiException.notFound('Income not found');
    await this.db.incomeEntry.delete({ where: { id } });
    await this.audit.record({
      action: 'income.deleted',
      entityType: 'IncomeEntry',
      entityId: id,
      before: { kind: row.kind, amountPaise: row.amountPaise },
    });
  }
}

/** The delete route's own permission. */
function mayRemoveIncome(ctx: TenantContext): boolean {
  return mayCall(ctx, expensesContract.deleteIncome);
}
