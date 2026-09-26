import {
  DEFAULT_MODULE_ENABLED,
  type MeContext,
  type MembershipContext,
  MODULE_KEYS,
  type ModuleKey,
  type PermissionKey,
  parseModuleSettings,
  SocietySettingsSchema,
} from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { TenantContext } from '../../common/tenant/tenant.types';
import { TtlCache } from '../../common/tenant/tenant-cache';
import { iso } from '../../common/util/dates';
import type { Prisma } from '../../generated/prisma/client';
import { UsersService } from '../identity/users.service';
import { toSocietySummary } from './mappers';

const TENANT_TTL_MS = 60_000;

const contextInclude = {
  society: { include: { modules: true } },
  roles: { include: { role: { include: { permissions: true } } } },
  occupancies: { where: { toDate: null }, include: { flat: { include: { building: true } } } },
} satisfies Prisma.MembershipInclude;

type MembershipForContext = Prisma.MembershipGetPayload<{ include: typeof contextInclude }>;

export type TenantLookup =
  | { kind: 'none' }
  | { kind: 'inactive' }
  | { kind: 'ok'; ctx: TenantContext };

/** Builds the app's navigation context and the per-request tenant context. Both from the same rows. */
@Injectable()
export class ContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly cache: TtlCache,
  ) {}

  async getMeContext(userId: string): Promise<MeContext> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: { in: ['ACTIVE', 'SUSPENDED'] } },
      include: contextInclude,
      orderBy: { createdAt: 'asc' },
    });
    const pending = await this.prisma.joinRequest.findMany({
      where: { userId, status: 'PENDING' },
      include: { society: true, flat: { include: { building: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const platformAdmin = await this.prisma.platformAdmin.findUnique({ where: { userId } });
    return {
      user: this.users.toDto(user),
      memberships: memberships.map((m) => this.toMembershipContext(m)),
      pendingJoinRequests: pending.map((r) => ({
        id: r.id,
        society: toSocietySummary(r.society),
        flatNumber: r.flat.number,
        buildingName: r.flat.building?.name ?? null,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      isPlatformAdmin: Boolean(platformAdmin),
    };
  }

  async lookupTenant(userId: string, societyId: string): Promise<TenantLookup> {
    const key = `tenant:${userId}:${societyId}`;
    const cached = this.cache.get<TenantLookup>(key);
    if (cached) return cached;
    const membership = await this.prisma.membership.findUnique({
      where: { societyId_userId: { societyId, userId } },
      include: contextInclude,
    });
    let result: TenantLookup;
    if (!membership || membership.status === 'LEFT' || membership.society.status !== 'ACTIVE')
      result = { kind: 'none' };
    else if (membership.status !== 'ACTIVE') result = { kind: 'inactive' };
    else {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { locale: true },
      });
      result = { kind: 'ok', ctx: this.toTenantContext(membership, user.locale) };
    }
    this.cache.set(key, result, TENANT_TTL_MS);
    return result;
  }

  invalidateUser(userId: string): void {
    this.cache.deleteByPrefix(`tenant:${userId}:`);
  }

  invalidateSociety(societyId: string): void {
    // Keys are tenant:<user>:<society>; a society-wide change flushes everything. Cheap at our size.
    this.cache.deleteByPrefix('tenant:');
    void societyId;
  }

  private modulesOf(
    m: MembershipForContext,
  ): { key: ModuleKey; enabled: boolean; settings: Record<string, unknown> }[] {
    const rows = new Map(m.society.modules.map((r) => [r.moduleKey, r]));
    return MODULE_KEYS.map((key) => {
      const row = rows.get(key);
      const enabled = row ? row.enabled : DEFAULT_MODULE_ENABLED[key];
      const settings = parseModuleSettings(key, row?.settings ?? {}) as Record<string, unknown>;
      return { key, enabled, settings };
    });
  }

  private permissionsOf(m: MembershipForContext): PermissionKey[] {
    const set = new Set<PermissionKey>();
    for (const mr of m.roles)
      for (const p of mr.role.permissions) set.add(p.permissionKey as PermissionKey);
    return [...set].sort();
  }

  toMembershipContext(m: MembershipForContext): MembershipContext {
    return {
      id: m.id,
      status: m.status,
      society: toSocietySummary(m.society),
      societySettings: SocietySettingsSchema.parse(m.society.settings ?? {}),
      roles: m.roles.map((r) => ({ id: r.role.id, key: r.role.key, name: r.role.name })),
      permissions: this.permissionsOf(m),
      flats: m.occupancies.map((o) => ({
        id: o.flat.id,
        number: o.flat.number,
        buildingId: o.flat.buildingId,
        buildingName: o.flat.building?.name ?? null,
        relation: o.relation,
        isPrimaryContact: o.isPrimaryContact,
      })),
      modules: this.modulesOf(m),
      joinedAt: iso(m.joinedAt),
    };
  }

  private toTenantContext(
    m: MembershipForContext,
    userLocale: TenantContext['userLocale'],
  ): TenantContext {
    const modules = this.modulesOf(m);
    const moduleSettings: TenantContext['moduleSettings'] = {};
    for (const mod of modules) moduleSettings[mod.key] = mod.settings;
    return {
      societyId: m.societyId,
      membershipId: m.id,
      userId: m.userId,
      society: { ...toSocietySummary(m.society), fyStartMonth: m.society.fyStartMonth },
      societySettings: SocietySettingsSchema.parse(m.society.settings ?? {}),
      roles: m.roles.map((r) => ({ id: r.role.id, key: r.role.key, name: r.role.name })),
      permissions: new Set(this.permissionsOf(m)),
      enabledModules: new Set(modules.filter((x) => x.enabled).map((x) => x.key)),
      moduleSettings,
      flatIds: m.occupancies.map((o) => o.flatId),
      buildingIds: [
        ...new Set(
          m.occupancies.map((o) => o.flat.buildingId).filter((b): b is string => Boolean(b)),
        ),
      ],
      roleIds: m.roles.map((r) => r.roleId),
      userLocale,
    };
  }
}
