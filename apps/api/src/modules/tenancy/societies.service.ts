import {
  DEFAULT_MODULE_ENABLED,
  type Locale,
  MODULE_KEYS,
  platformContract,
  type RouteBody,
  type SocietySettings,
  SocietySettingsSchema,
  societyContract,
} from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can } from '../../common/tenant/tenant.types';
import { readableCode } from '../../common/util/codes';
import type { Prisma, Society } from '../../generated/prisma/client';
import { defaultEmergencyContactRows } from '../emergency/emergency.service';
import { defaultExpenseCategoryRows } from '../expenses/expenses.service';
import { PasswordService } from '../identity/password.service';
import { UsersService } from '../identity/users.service';
import { defaultVendorCategoryRows } from '../vendors/vendors.service';
import { ContextService } from './context.service';
import { toSocietySummary } from './mappers';
import { rolePermissionRows, roleTemplateRows } from './roles.service';

type CreateBody = RouteBody<typeof platformContract.createSociety>;
type UpdateBody = RouteBody<typeof societyContract.update>;

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'society'
  );
}

/** What the audit log keeps about a profile change. */
function profileFields(s: Society) {
  return {
    name: s.name,
    addressLine: s.addressLine,
    city: s.city,
    state: s.state,
    pincode: s.pincode,
    defaultLocale: s.defaultLocale,
    fyStartMonth: s.fyStartMonth,
    settings: s.settings,
  };
}

@Injectable()
export class SocietiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantPrismaService,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    private readonly context: ContextService,
  ) {}

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    for (let i = 2; i < 100; i++) {
      const hit = await this.prisma.society.findUnique({ where: { slug } });
      if (!hit) return slug;
      slug = `${base}-${i}`;
    }
    throw new Error('Could not allocate slug');
  }

  private async uniqueJoinCode(): Promise<string> {
    for (let i = 0; i < 20; i++) {
      const code = readableCode(6);
      const hit = await this.prisma.society.findUnique({ where: { joinCode: code } });
      if (!hit) return code;
    }
    throw new Error('Could not allocate join code');
  }

  /** Platform admin creates a society with template roles, default modules and its first admin. */
  async create(body: CreateBody) {
    const identifier = this.users.parseIdentifier(body.admin.identifier);
    if (!identifier)
      throw ApiException.badRequest(
        'VALIDATION_FAILED',
        'Admin identifier is not a phone or email',
      );
    let adminUser = await this.users.findByIdentifier(identifier);
    let adminUserCreated = false;
    if (!adminUser) {
      if (!body.admin.password) {
        throw ApiException.badRequest(
          'VALIDATION_FAILED',
          'This admin has no account yet. Provide a password to create one.',
        );
      }
      adminUser = await this.prisma.user.create({
        data: {
          email: identifier.kind === 'email' ? identifier.value : null,
          phone: identifier.kind === 'phone' ? identifier.value : null,
          displayName: body.admin.displayName,
          locale: (body.admin.locale ?? body.defaultLocale) as Locale,
          credentials: {
            create: {
              type: 'PASSWORD',
              secretHash: await this.passwords.hash(body.admin.password),
            },
          },
        },
      });
      adminUserCreated = true;
    }
    const slug = await this.uniqueSlug(body.slug ?? slugify(body.name));
    const joinCode = await this.uniqueJoinCode();
    const adminUserId = adminUser.id;

    const result = await this.prisma.$transaction(async (tx) => {
      const society = await tx.society.create({
        data: {
          name: body.name,
          slug,
          city: body.city ?? null,
          state: body.state ?? null,
          pincode: body.pincode ?? null,
          addressLine: body.addressLine ?? null,
          defaultLocale: body.defaultLocale,
          timezone: body.timezone,
          fyStartMonth: body.fyStartMonth,
          joinCode,
          settings: SocietySettingsSchema.parse({}) as Prisma.InputJsonValue,
        },
      });
      await tx.role.createMany({ data: roleTemplateRows(society.id) });
      const roles = await tx.role.findMany({ where: { societyId: society.id } });
      const byKey = Object.fromEntries(roles.map((r) => [r.key, r.id]));
      await tx.rolePermission.createMany({ data: rolePermissionRows(byKey) });
      await tx.societyModule.createMany({
        data: MODULE_KEYS.map((key) => ({
          societyId: society.id,
          moduleKey: key,
          enabled: DEFAULT_MODULE_ENABLED[key],
          settings: {},
        })),
      });
      await tx.vendorCategory.createMany({ data: defaultVendorCategoryRows(society.id) });
      await tx.emergencyContact.createMany({ data: defaultEmergencyContactRows(society.id) });
      await tx.expenseCategory.createMany({ data: defaultExpenseCategoryRows(society.id) });
      const adminRoleId = byKey.admin;
      if (!adminRoleId) throw new Error('admin role missing');
      const membership = await tx.membership.create({
        data: {
          societyId: society.id,
          userId: adminUserId,
          status: 'ACTIVE',
          joinedAt: new Date(),
          roles: { create: { roleId: adminRoleId } },
        },
      });
      await this.audit.record(
        {
          action: 'society.created',
          entityType: 'Society',
          entityId: society.id,
          societyId: society.id,
          after: { name: society.name, slug },
        },
        tx,
      );
      return { society, membership };
    });
    this.context.invalidateUser(adminUserId);
    return {
      society: toSocietySummary(result.society),
      joinCode,
      adminMembershipId: result.membership.id,
      adminUserCreated,
    };
  }

  async listAll() {
    const societies = await this.prisma.society.findMany({
      include: {
        _count: { select: { memberships: { where: { status: 'ACTIVE' } }, flats: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return societies.map((s) => ({
      ...toSocietySummary(s),
      memberCount: s._count.memberships,
      flatCount: s._count.flats,
      joinCode: s.joinCode,
    }));
  }

  async profile() {
    const ctx = requireTenant();
    const society = await this.prisma.society.findUniqueOrThrow({
      where: { id: ctx.societyId },
      include: {
        _count: {
          select: { buildings: true, flats: true, memberships: { where: { status: 'ACTIVE' } } },
        },
      },
    });
    return this.toProfile(society, society._count, can(ctx, 'member.manage'));
  }

  async update(body: UpdateBody) {
    const ctx = requireTenant();
    const before = await this.prisma.society.findUniqueOrThrow({ where: { id: ctx.societyId } });
    const currentSettings = SocietySettingsSchema.parse(before.settings ?? {});
    const nextSettings: SocietySettings = body.settings
      ? SocietySettingsSchema.parse({
          ...currentSettings,
          ...body.settings,
          tenancy: { ...currentSettings.tenancy, ...(body.settings.tenancy ?? {}) },
        })
      : currentSettings;
    const joinCode = body.rotateJoinCode ? await this.uniqueJoinCode() : undefined;
    const society = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.society.update({
        where: { id: ctx.societyId },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.city !== undefined ? { city: body.city } : {}),
          ...(body.state !== undefined ? { state: body.state } : {}),
          ...(body.pincode !== undefined ? { pincode: body.pincode } : {}),
          ...(body.addressLine !== undefined ? { addressLine: body.addressLine } : {}),
          ...(body.defaultLocale !== undefined ? { defaultLocale: body.defaultLocale } : {}),
          ...(body.fyStartMonth !== undefined ? { fyStartMonth: body.fyStartMonth } : {}),
          ...(joinCode ? { joinCode } : {}),
          settings: nextSettings as Prisma.InputJsonValue,
        },
        include: {
          _count: {
            select: { buildings: true, flats: true, memberships: { where: { status: 'ACTIVE' } } },
          },
        },
      });
      await this.audit.record(
        {
          action: 'society.settings.updated',
          entityType: 'Society',
          entityId: ctx.societyId,
          before: profileFields(before),
          after: { ...profileFields(updated), joinCodeRotated: Boolean(joinCode) },
        },
        tx,
      );
      return updated;
    });
    this.context.invalidateSociety(ctx.societyId);
    return this.toProfile(society, society._count, true);
  }

  private toProfile(
    s: Society,
    counts: { buildings: number; flats: number; memberships: number },
    showJoinCode: boolean,
  ) {
    return {
      ...toSocietySummary(s),
      state: s.state,
      pincode: s.pincode,
      addressLine: s.addressLine,
      fyStartMonth: s.fyStartMonth,
      joinCode: showJoinCode ? s.joinCode : null,
      settings: SocietySettingsSchema.parse(s.settings ?? {}),
      counts: { buildings: counts.buildings, flats: counts.flats, members: counts.memberships },
    };
  }

  /** Used by tenant routes that need the raw row without the tenant client (settings, timezone). */
  tenantSociety(): Promise<Society> {
    return this.prisma.society.findUniqueOrThrow({ where: { id: requireTenant().societyId } });
  }

  get db() {
    return this.tenant.client;
  }
}
