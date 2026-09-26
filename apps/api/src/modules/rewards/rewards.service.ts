import {
  type Leaderboard,
  type MemberPoints,
  type PointsReason,
  parseModuleSettings,
} from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can, type TenantContext } from '../../common/tenant/tenant.types';
import type { Prisma } from '../../generated/prisma/client';
import { fyLabel, todayIn } from '../maintenance/billing';
import { loadMemberNames } from '../tenancy/member-names';

export interface AwardInput {
  societyId: string;
  timeZone: string;
  fyStartMonth: number;
  /** The society's rewards module settings, raw. */
  settings: unknown;
  membershipId: string;
  points: number;
  reason: Exclude<PointsReason, 'ADJUSTMENT'>;
  label: string;
  refType: string;
  refId: string;
  byMembershipId: string | null;
}

/**
 * Adds earned points, capped by rewards.maxPointsPerMonth. Returns the points actually added
 * (0 when the cap is reached). Adjustments are not capped and do not use this.
 */
export async function awardPoints(tx: Prisma.TransactionClient, a: AwardInput): Promise<number> {
  if (a.points <= 0) return 0;
  const { maxPointsPerMonth } = parseModuleSettings('rewards', a.settings);
  const today = todayIn(a.timeZone);
  let points = a.points;
  if (maxPointsPerMonth !== null) {
    const earned = await tx.pointsLedger.findMany({
      where: {
        societyId: a.societyId,
        membershipId: a.membershipId,
        reason: { in: ['TASK', 'DUTY'] },
        delta: { gt: 0 },
        financialYear: fyLabel(today, a.fyStartMonth),
      },
      select: { delta: true, createdAt: true },
    });
    const month = today.slice(0, 7);
    const used = earned
      .filter((e) => todayIn(a.timeZone, e.createdAt).slice(0, 7) === month)
      .reduce((s, e) => s + e.delta, 0);
    points = Math.min(points, Math.max(0, maxPointsPerMonth - used));
  }
  if (points <= 0) return 0;
  await tx.pointsLedger.create({
    data: {
      societyId: a.societyId,
      membershipId: a.membershipId,
      delta: points,
      reason: a.reason,
      label: a.label,
      refType: a.refType,
      refId: a.refId,
      financialYear: fyLabel(today, a.fyStartMonth),
      createdByMembershipId: a.byMembershipId,
    },
  });
  return points;
}

export function awardContext(ctx: TenantContext) {
  return {
    societyId: ctx.societyId,
    timeZone: ctx.society.timezone,
    fyStartMonth: ctx.society.fyStartMonth,
    settings: ctx.moduleSettings.rewards,
  };
}

@Injectable()
export class RewardsService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  private fy(ctx: TenantContext): string {
    return fyLabel(todayIn(ctx.society.timezone), ctx.society.fyStartMonth);
  }

  async mine(): Promise<MemberPoints> {
    const ctx = requireTenant();
    return this.pointsOf(ctx, ctx.membershipId);
  }

  async member(membershipId: string): Promise<MemberPoints> {
    const ctx = requireTenant();
    const m = await this.db.membership.findUnique({ where: { id: membershipId } });
    if (!m) throw ApiException.notFound('Member not found');
    return this.pointsOf(ctx, membershipId);
  }

  async adjust(membershipId: string, delta: number, note: string): Promise<MemberPoints> {
    const ctx = requireTenant();
    const m = await this.db.membership.findUnique({ where: { id: membershipId } });
    if (!m) throw ApiException.notFound('Member not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.pointsLedger.create({
        data: {
          societyId: ctx.societyId,
          membershipId,
          delta,
          reason: 'ADJUSTMENT',
          label: note,
          financialYear: this.fy(ctx),
          createdByMembershipId: ctx.membershipId,
        },
      });
      await this.audit.record(
        {
          action: 'points.adjusted',
          entityType: 'Membership',
          entityId: membershipId,
          after: { delta, note },
        },
        tx,
      );
    });
    return this.pointsOf(ctx, membershipId);
  }

  async leaderboard(): Promise<Leaderboard> {
    const ctx = requireTenant();
    const mode = parseModuleSettings('rewards', ctx.moduleSettings.rewards).leaderboard;
    if (mode === 'OFF' && !can(ctx, 'reward.adjust'))
      throw ApiException.forbidden('Your committee has not turned on the leaderboard');
    const fy = this.fy(ctx);
    const rows = await this.ranked(fy);
    const shown = mode === 'TOP_5' && !can(ctx, 'reward.adjust') ? rows.slice(0, 5) : rows;
    const members = await this.db.membership.findMany({
      where: { id: { in: shown.map((r) => r.membershipId) } },
      include: {
        user: { select: { displayName: true } },
        occupancies: {
          where: { toDate: null },
          include: { flat: { include: { building: true } } },
          take: 1,
        },
      },
    });
    const byId = new Map(members.map((m) => [m.id, m]));
    return {
      financialYear: fy,
      rows: shown.map((r) => {
        const m = byId.get(r.membershipId);
        const flat = m?.occupancies[0]?.flat;
        return {
          rank: r.rank,
          membershipId: r.membershipId,
          displayName: m?.user.displayName ?? '',
          flat: flat
            ? flat.building
              ? `${flat.building.name}-${flat.number}`
              : flat.number
            : null,
          points: r.points,
        };
      }),
    };
  }

  /** Points this year, for Home. */
  async pointsThisYear(ctx: TenantContext): Promise<number> {
    const agg = await this.db.pointsLedger.aggregate({
      where: { membershipId: ctx.membershipId, financialYear: this.fy(ctx) },
      _sum: { delta: true },
    });
    return agg._sum.delta ?? 0;
  }

  /** Members with points this year, highest first. Equal points share a rank. */
  private async ranked(fy: string) {
    const groups = await this.db.pointsLedger.groupBy({
      by: ['membershipId'],
      where: { financialYear: fy },
      _sum: { delta: true },
    });
    const sorted = groups
      .map((g) => ({ membershipId: g.membershipId, points: g._sum.delta ?? 0 }))
      .filter((g) => g.points > 0)
      .sort((a, b) => b.points - a.points);
    let rank = 0;
    let last = Number.POSITIVE_INFINITY;
    return sorted.map((g, i) => {
      if (g.points < last) rank = i + 1;
      last = g.points;
      return { ...g, rank };
    });
  }

  private async pointsOf(ctx: TenantContext, membershipId: string): Promise<MemberPoints> {
    const fy = this.fy(ctx);
    const [entries, yearAgg, allAgg, names] = await Promise.all([
      this.db.pointsLedger.findMany({
        where: { membershipId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
      }),
      this.db.pointsLedger.aggregate({
        where: { membershipId, financialYear: fy },
        _sum: { delta: true },
      }),
      this.db.pointsLedger.aggregate({ where: { membershipId }, _sum: { delta: true } }),
      loadMemberNames(this.prisma, [membershipId]),
    ]);
    const by = await loadMemberNames(
      this.prisma,
      entries.map((e) => e.createdByMembershipId),
    );
    const mode = parseModuleSettings('rewards', ctx.moduleSettings.rewards).leaderboard;
    const rank =
      mode === 'OFF'
        ? null
        : ((await this.ranked(fy)).find((r) => r.membershipId === membershipId)?.rank ?? null);
    return {
      membershipId,
      displayName: names.get(membershipId)?.displayName ?? '',
      financialYear: fy,
      points: yearAgg._sum.delta ?? 0,
      allTimePoints: allAgg._sum.delta ?? 0,
      rank,
      entries: entries.map((e) => ({
        id: e.id,
        delta: e.delta,
        reason: e.reason,
        label: e.label,
        refId: e.refId,
        financialYear: e.financialYear,
        by: e.createdByMembershipId
          ? {
              membershipId: e.createdByMembershipId,
              displayName: by.get(e.createdByMembershipId)?.displayName ?? 'Committee',
            }
          : null,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }
}
