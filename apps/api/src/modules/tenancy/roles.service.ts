import {
  PERMISSION_KEYS,
  type PermissionKey,
  ROLE_TEMPLATE_KEYS,
  ROLE_TEMPLATE_PERMISSIONS,
  type Role,
  type RoleTemplateKey,
} from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { readableCode } from '../../common/util/codes';
import type { Prisma } from '../../generated/prisma/client';
import { ContextService } from './context.service';

export const ROLE_TEMPLATE_NAMES: Record<RoleTemplateKey, string> = {
  admin: 'Admin',
  committee: 'Committee member',
  treasurer: 'Treasurer',
  resident: 'Resident',
  staff: 'Staff',
};

/** Rows to create for a new society. Used inside the society creation transaction. */
export function roleTemplateRows(societyId: string): Prisma.RoleCreateManyInput[] {
  return ROLE_TEMPLATE_KEYS.map((key, i) => ({
    societyId,
    key,
    name: ROLE_TEMPLATE_NAMES[key],
    isSystem: true,
    sortOrder: i,
  }));
}

export function rolePermissionRows(
  roleIdByKey: Record<string, string>,
): Prisma.RolePermissionCreateManyInput[] {
  const rows: Prisma.RolePermissionCreateManyInput[] = [];
  for (const key of ROLE_TEMPLATE_KEYS) {
    const roleId = roleIdByKey[key];
    if (!roleId) continue;
    for (const permissionKey of ROLE_TEMPLATE_PERMISSIONS[key])
      rows.push({ roleId, permissionKey });
  }
  return rows;
}

const roleInclude = { permissions: true, _count: { select: { members: true } } } as const;
type RoleRow = Prisma.RoleGetPayload<{ include: typeof roleInclude }>;

function toRole(r: RoleRow): Role {
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    isSystem: r.isSystem,
    permissions: r.permissions.map((p) => p.permissionKey as PermissionKey).sort(),
    memberCount: r._count.members,
  };
}

/** Rule 2: nobody can grant a permission they do not hold themselves. */
export function assertCanGrant(permissions: Iterable<PermissionKey>): void {
  const ctx = requireTenant();
  for (const p of permissions)
    if (!ctx.permissions.has(p))
      throw ApiException.forbidden('You cannot give a permission you do not have');
}

@Injectable()
export class RolesService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly context: ContextService,
  ) {}

  async list(): Promise<Role[]> {
    const roles = await this.tenant.client.role.findMany({
      include: roleInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return roles.map(toRole);
  }

  private async assertNameFree(name: string, exceptId?: string): Promise<void> {
    const hit = await this.tenant.client.role.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
    });
    if (hit) throw ApiException.conflict('CONFLICT', 'A role with this name already exists');
  }

  async create(body: { name: string; permissions: PermissionKey[] }): Promise<Role> {
    const ctx = requireTenant();
    const permissions = [...new Set(body.permissions)];
    assertCanGrant(permissions);
    await this.assertNameFree(body.name);
    const last = await this.tenant.client.role.findFirst({ orderBy: { sortOrder: 'desc' } });
    const role = await this.prisma.$transaction(async (tx) => {
      const r = await tx.role.create({
        data: {
          societyId: ctx.societyId,
          key: `custom_${readableCode(8).toLowerCase()}`,
          name: body.name,
          isSystem: false,
          sortOrder: (last?.sortOrder ?? 0) + 1,
          permissions: { create: permissions.map((permissionKey) => ({ permissionKey })) },
        },
        include: roleInclude,
      });
      await this.audit.record(
        {
          action: 'role.created',
          entityType: 'Role',
          entityId: r.id,
          after: { name: r.name, permissions },
        },
        tx,
      );
      return r;
    });
    return toRole(role);
  }

  async update(
    roleId: string,
    body: { name?: string | undefined; permissions?: PermissionKey[] | undefined },
  ): Promise<Role> {
    const ctx = requireTenant();
    const before = await this.tenant.client.role.findUnique({
      where: { id: roleId },
      include: roleInclude,
    });
    if (!before) throw ApiException.notFound('Role not found');
    if (body.name !== undefined) await this.assertNameFree(body.name, roleId);
    const current = new Set(before.permissions.map((p) => p.permissionKey as PermissionKey));
    const next = body.permissions ? new Set(body.permissions) : current;
    if (before.key === 'admin' && body.permissions && next.size !== PERMISSION_KEYS.length)
      throw ApiException.forbidden('The admin role always has every permission');
    // You can add or remove only the permissions you hold yourself.
    assertCanGrant([...next].filter((p) => !current.has(p)));
    assertCanGrant([...current].filter((p) => !next.has(p)));

    const role = await this.prisma.$transaction(async (tx) => {
      if (body.permissions) {
        await tx.rolePermission.deleteMany({ where: { roleId } });
        await tx.rolePermission.createMany({
          data: [...next].map((permissionKey) => ({ roleId, permissionKey })),
        });
      }
      const r = await tx.role.update({
        where: { id: roleId, societyId: ctx.societyId },
        data: body.name !== undefined ? { name: body.name } : {},
        include: roleInclude,
      });
      await this.audit.record(
        {
          action: 'role.updated',
          entityType: 'Role',
          entityId: roleId,
          before: { name: before.name, permissions: [...current].sort() },
          after: { name: r.name, permissions: [...next].sort() },
        },
        tx,
      );
      return r;
    });
    this.context.invalidateSociety(ctx.societyId);
    return toRole(role);
  }

  async remove(roleId: string): Promise<void> {
    const ctx = requireTenant();
    const role = await this.tenant.client.role.findUnique({
      where: { id: roleId },
      include: { ...roleInclude, _count: { select: { members: true, invitations: true } } },
    });
    if (!role) throw ApiException.notFound('Role not found');
    if (role.isSystem) throw ApiException.forbidden('Built-in roles cannot be deleted');
    if (role._count.members > 0 || role._count.invitations > 0)
      throw ApiException.conflict('ROLE_IN_USE', 'Move its members to another role first');
    await this.prisma.$transaction(async (tx) => {
      await tx.role.delete({ where: { id: roleId, societyId: ctx.societyId } });
      await this.audit.record(
        {
          action: 'role.deleted',
          entityType: 'Role',
          entityId: roleId,
          before: { name: role.name, permissions: role.permissions.map((p) => p.permissionKey) },
        },
        tx,
      );
    });
  }

  async requireRoles(ids: string[]) {
    const roles = await this.tenant.client.role.findMany({
      where: { id: { in: ids } },
      include: { permissions: true },
    });
    if (roles.length !== new Set(ids).size) throw ApiException.notFound('Role not found');
    return roles;
  }

  async residentRole() {
    const role = await this.tenant.client.role.findFirst({ where: { key: 'resident' } });
    if (!role) throw new Error('Society has no resident role');
    return role;
  }
}
